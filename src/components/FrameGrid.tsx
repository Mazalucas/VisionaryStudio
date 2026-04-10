import React, { useState, useEffect } from 'react';
import { auth, db, storage, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, getDoc, getDocs, writeBatch, serverTimestamp, setDoc, deleteField } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { geminiService } from '../geminiService';
import { openaiService } from '../openaiService';
import { getImageProvider, getTextProvider } from '@/lib/apiKeysStorage';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Trash2, Eye, Download, CheckCircle2, Circle, RefreshCw, Image as ImageIcon, Edit3, Upload as UploadIcon, RotateCcw, Clapperboard, Loader2, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface Frame {
  id: string;
  frameNumber: string;
  originalDescription: string;
  narratedText: string;
  visualIntent: string;
  category: string;
  status: 'pending' | 'selected' | 'generated' | 'skipped';
  generatedImageUrl?: string;
  generationPrompt?: string;
  localStyleImageUrls?: string[];
  localStyleReferenceId?: string;
  storagePath?: string;
  isChunked?: boolean;
  activeGenerationId?: string;
}

export interface FrameGeneration {
  id: string;
  storagePath: string;
  downloadUrl: string;
  generationPrompt?: string;
  quality?: 'standard' | 'high';
  createdAt?: { seconds?: number; nanoseconds?: number };
}

const MAX_GENERATIONS_PER_FRAME = 20;

async function pruneOldGenerations(projectId: string, frameId: string) {
  const gensRef = collection(db, 'projects', projectId, 'frames', frameId, 'generations');
  const snap = await getDocs(query(gensRef, orderBy('createdAt', 'asc')));
  const excess = snap.size - MAX_GENERATIONS_PER_FRAME;
  if (excess <= 0) return;
  const toDelete = snap.docs.slice(0, excess);
  for (const d of toDelete) {
    const data = d.data() as { storagePath?: string };
    if (data.storagePath) {
      try {
        await deleteObject(ref(storage, data.storagePath));
      } catch (e) {
        console.error('Error deleting old generation file:', e);
      }
    }
    await deleteDoc(d.ref);
  }
}

interface StyleRef {
  id: string;
  name: string;
}

/** Label for the frame style override select (works when the menu is closed and items are not mounted). */
function frameStyleOverrideLabel(
  value: string | null | undefined,
  styles: StyleRef[],
): string {
  const v = value || 'global';
  if (v === 'global') return 'Use Project Global Style';
  if (v === 'none') return 'None (No Library Style)';
  const found = styles.find((s) => s.id === v);
  return found?.name ?? 'Style (unavailable)';
}

export type FrameGridColumnCount = 1 | 2 | 3 | 4;

function frameGridColsClass(cols: FrameGridColumnCount): string {
  switch (cols) {
    case 1:
      return 'grid-cols-1';
    case 2:
      return 'grid-cols-2';
    case 3:
      return 'grid-cols-3';
    case 4:
      return 'grid-cols-4';
  }
}

interface FrameGridProps {
  projectId: string;
  globalStyle: string;
  styleReferenceId?: string;
  availableStyles: StyleRef[];
  /** Viewport offset from top when sticking (studio header + tab bar height). */
  stickyTopOffsetPx?: number;
  /** Number of columns in the frames card grid (user preference). */
  gridColumns: FrameGridColumnCount;
}

function ChunkedImage({ frame, projectId, className }: { frame: Frame, projectId: string, className?: string }) {
  const [fullImage, setFullImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!frame.isChunked) {
      setFullImage(frame.generatedImageUrl || null);
      return;
    }

    const fetchChunks = async () => {
      setLoading(true);
      try {
        const chunksSnap = await getDocs(query(
          collection(db, 'projects', projectId, 'frames', frame.id, 'chunks'),
          orderBy('index', 'asc')
        ));
        const data = chunksSnap.docs.map(d => d.data().data).join('');
        setFullImage(data);
      } catch (error) {
        console.error("Error fetching chunks:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchChunks();
  }, [frame.isChunked, frame.generatedImageUrl, frame.id, projectId]);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white/30 backdrop-blur-sm dark:bg-white/5">
        <RefreshCw className="h-6 w-6 animate-spin text-neutral-950/40" />
      </div>
    );
  }

  if (!fullImage) return null;

  return (
    <img 
      src={fullImage} 
      alt={`Frame ${frame.frameNumber}`} 
      className={className}
      referrerPolicy="no-referrer"
    />
  );
}

export function FrameGrid({
  projectId,
  globalStyle,
  styleReferenceId,
  availableStyles,
  stickyTopOffsetPx = 0,
  gridColumns,
}: FrameGridProps) {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [selectedFrameIds, setSelectedFrameIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number } | null>(null);
  const [generatingActiveFrameId, setGeneratingActiveFrameId] = useState<string | null>(null);
  const [isSavingFrame, setIsSavingFrame] = useState(false);
  const [deletingFrameId, setDeletingFrameId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [quality, setQuality] = useState<'standard' | 'high'>('standard');
  const [previewImage, setPreviewImage] = useState<{ url: string, title: string } | null>(null);
  const [editingFrame, setEditingFrame] = useState<Frame | null>(null);
  const [historyFrame, setHistoryFrame] = useState<Frame | null>(null);
  const [historyGenerations, setHistoryGenerations] = useState<FrameGeneration[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [historyReloadToken, setHistoryReloadToken] = useState(0);
  const [importingHistory, setImportingHistory] = useState(false);
  const [settingActiveGenId, setSettingActiveGenId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'projects', projectId, 'frames'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const frms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Frame));
      
      // Sort frames numerically by frameNumber
      const sortedFrms = [...frms].sort((a, b) => {
        const numA = parseInt(a.frameNumber.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.frameNumber.replace(/\D/g, '')) || 0;
        return numA - numB;
      });
      
      setFrames(sortedFrms);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `projects/${projectId}/frames`);
    });
    return () => unsubscribe();
  }, [projectId]);

  useEffect(() => {
    if (!historyFrame) {
      setHistoryGenerations([]);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    (async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'projects', projectId, 'frames', historyFrame.id, 'generations'),
            orderBy('createdAt', 'desc'),
          ),
        );
        if (cancelled) return;
        const list: FrameGeneration[] = snap.docs.map((d) => {
          const data = d.data() as Omit<FrameGeneration, 'id'>;
          return { id: d.id, ...data };
        });
        setHistoryGenerations(list);
        setHistoryIndex(0);
      } catch (e) {
        console.error('Failed to load generation history:', e);
        if (!cancelled) {
          setHistoryGenerations([]);
          toast.error('Could not load generation history');
        }
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [historyFrame, projectId, historyReloadToken]);

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedFrameIds);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedFrameIds(newSelection);
  };

  const handleGenerateSelected = async () => {
    if (selectedFrameIds.size === 0) {
      toast.error('Select at least one frame');
      return;
    }
    
    setIsGenerating(true);
    setGenerationProgress(null);
    setGeneratingActiveFrameId(null);
    const selectedFrames = frames.filter(f => selectedFrameIds.has(f.id));
    if (selectedFrames.length === 0) {
      setIsGenerating(false);
      setGeneratingActiveFrameId(null);
      toast.error('Could not find selected frames. Try refreshing.');
      return;
    }
    const totalFrames = selectedFrames.length;
    const imageProvider = getImageProvider();
    const textProvider = getTextProvider();
    let warnedOpenAIStyleImages = false;
    const progressToastId = toast.loading(`Starting… (0 / ${totalFrames} frames)`);

    try {
      const user = auth.currentUser;
      if (!user) {
        toast.dismiss(progressToastId);
        toast.error('You must be signed in to upload images to Storage.');
        return;
      }
      await user.getIdToken(true);

      // Clear existing images for selected frames to show loading state
      const clearBatch = writeBatch(db);
      selectedFrames.forEach(f => {
        clearBatch.update(doc(db, 'projects', projectId, 'frames', f.id), {
          generatedImageUrl: "",
          isChunked: false,
          status: 'pending',
          activeGenerationId: deleteField(),
        });
      });
      await clearBatch.commit();

      // Fetch global style reference data if selected
      let globalStyleImages: string[] = [];
      let globalStyleRefPrompt = "";
      
      if (styleReferenceId && styleReferenceId !== 'none') {
        const styleDoc = await getDoc(doc(db, 'styleReferences', styleReferenceId));
        if (styleDoc.exists()) {
          const styleData = styleDoc.data();
          globalStyleRefPrompt = styleData.stylePrompt || "";
          
          const imagesSnap = await getDocs(query(collection(db, 'styleReferences', styleReferenceId, 'images'), orderBy('createdAt', 'asc')));
          globalStyleImages = imagesSnap.docs.map(d => d.data().url);
        }
      }

      for (let i = 0; i < selectedFrames.length; i++) {
        const frame = selectedFrames[i];
        const step = i + 1;
        setGeneratingActiveFrameId(frame.id);
        setGenerationProgress({ current: step, total: totalFrames });
        toast.loading(`Generating frame ${frame.frameNumber} (${step} of ${totalFrames})…`, { id: progressToastId });

        // Determine which style to use: Local override or Global
        let currentStyleImages = globalStyleImages;
        let currentStyleRefPrompt = globalStyleRefPrompt;
        let currentGlobalStylePrompt = globalStyle;

        if (frame.localStyleReferenceId && frame.localStyleReferenceId !== 'none' && frame.localStyleReferenceId !== 'global') {
          const localStyleDoc = await getDoc(doc(db, 'styleReferences', frame.localStyleReferenceId));
          if (localStyleDoc.exists()) {
            const localStyleData = localStyleDoc.data();
            currentStyleRefPrompt = localStyleData.stylePrompt || "";
            currentGlobalStylePrompt = ""; 
            
            const localImagesSnap = await getDocs(query(collection(db, 'styleReferences', frame.localStyleReferenceId, 'images'), orderBy('createdAt', 'asc')));
            currentStyleImages = localImagesSnap.docs.map(d => d.data().url);
          }
        }

        // 1. Determine prompt
        let finalPrompt = frame.generationPrompt || "";
        
        if (!finalPrompt) {
          const framePayload = {
            frameNumber: frame.frameNumber,
            originalDescription: frame.originalDescription,
            narratedText: frame.narratedText,
            visualIntent: frame.visualIntent,
            category: frame.category,
          };
          finalPrompt =
            textProvider === 'openai'
              ? await openaiService.refineVisualIntent(framePayload, currentGlobalStylePrompt)
              : await geminiService.refineVisualIntent(framePayload, currentGlobalStylePrompt);
        }
        
        // 2. Combine style images
        const localManualImages = frame.localStyleImageUrls || [];
        const allStyleImages = [...localManualImages, ...currentStyleImages];
        
        if (localManualImages.length > 0) {
          finalPrompt = `IMPORTANT: Use the first attached image as the primary visual reference for composition, content, and layout. Replicate the scene from that image exactly, but apply the following style: ${finalPrompt}`;
        }
        
        // 3. Generate image
        if (
          imageProvider === 'openai' &&
          allStyleImages.length > 0 &&
          !warnedOpenAIStyleImages
        ) {
          toast.info(
            'OpenAI (DALL·E): las imágenes de la biblioteca de estilo no se envían; solo se usa el texto del prompt.',
            { duration: 6000 },
          );
          warnedOpenAIStyleImages = true;
        }

        const imageUrl =
          imageProvider === 'openai'
            ? await openaiService.generateImage(
                finalPrompt,
                quality,
                '16:9',
                allStyleImages,
                currentStyleRefPrompt,
              )
            : await geminiService.generateImage(
                finalPrompt,
                quality,
                '16:9',
                allStyleImages,
                currentStyleRefPrompt,
              );
        
        // 4. Upload to Firebase Storage (unique path per generation — keeps history)
        const genRef = doc(collection(db, 'projects', projectId, 'frames', frame.id, 'generations'));
        const generationId = genRef.id;
        const storagePath = `projects/${projectId}/frames/${frame.id}/generations/${generationId}.png`;
        const storageRef = ref(storage, storagePath);

        const dataUrlComma = imageUrl.indexOf(',');
        const base64Data = dataUrlComma >= 0 ? imageUrl.slice(dataUrlComma + 1) : imageUrl;
        if (!base64Data) {
          throw new Error('Empty image data from AI provider');
        }
        const binary = atob(base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        await uploadBytes(storageRef, bytes, { contentType: 'image/png' });

        const downloadUrl = await getDownloadURL(storageRef);

        // 5. Save generation doc + update frame (active version)
        try {
          // Cleanup old chunks if they existed (legacy support)
          const existingChunksSnap = await getDocs(collection(db, 'projects', projectId, 'frames', frame.id, 'chunks'));
          if (!existingChunksSnap.empty) {
            const deleteBatch = writeBatch(db);
            existingChunksSnap.forEach(docSnap => deleteBatch.delete(docSnap.ref));
            await deleteBatch.commit();
          }

          await setDoc(genRef, {
            storagePath,
            downloadUrl,
            createdAt: serverTimestamp(),
            generationPrompt: finalPrompt,
            quality,
          });

          await pruneOldGenerations(projectId, frame.id);

          await updateDoc(doc(db, 'projects', projectId, 'frames', frame.id), {
            generatedImageUrl: downloadUrl,
            storagePath,
            generationPrompt: finalPrompt,
            activeGenerationId: generationId,
            status: 'generated',
            isChunked: false,
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `projects/${projectId}/frames/${frame.id}`);
          toast.error(`Failed to save frame ${frame.frameNumber}`);
        }
      }
      toast.success('Generation complete!', { id: progressToastId });
      setSelectedFrameIds(new Set());
    } catch (error: any) {
      console.error(error);
      const errorMessage = error?.message || String(error);
      toast.dismiss(progressToastId);

      if (errorMessage.includes('Gemini') || errorMessage.includes('OpenAI')) {
        toast.error(`AI Error: ${errorMessage}`);
      } else if (errorMessage.includes('resource-exhausted') || errorMessage.includes('quota')) {
        toast.error('Firestore daily write quota exceeded. Please wait until tomorrow for the limit to reset.');
      } else if (
        error?.code?.startsWith?.('storage/') ||
        errorMessage.includes('CORS') ||
        errorMessage.includes('access control')
      ) {
        toast.error(
          'Storage upload failed. Confirm you are signed in, then run npm run storage:cors (gcloud must use this Firebase project) so the bucket allows browser uploads.',
          { duration: 12000 },
        );
      } else {
        toast.error(`Error during generation: ${errorMessage}`);
      }
    } finally {
      setGenerationProgress(null);
      setGeneratingActiveFrameId(null);
      setIsGenerating(false);
    }
  };

  const handleUpdateFrame = async (updatedFrame: Partial<Frame>) => {
    if (!editingFrame) return;
    setIsSavingFrame(true);
    try {
      await updateDoc(doc(db, 'projects', projectId, 'frames', editingFrame.id), updatedFrame);
      toast.success('Frame updated');
      setEditingFrame(null);
    } catch (error) {
      toast.error('Failed to update frame');
    } finally {
      setIsSavingFrame(false);
    }
  };

  const handleLocalStyleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingFrame || !e.target.files) return;
    
    const files = Array.from(e.target.files);
    const newUrls: string[] = [];

    for (const file of files) {
      if (file.size > 750000) {
        toast.error(`File ${file.name} is too large (>750KB)`);
        continue;
      }
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      newUrls.push(base64);
    }

    if (newUrls.length > 0) {
      const currentUrls = editingFrame.localStyleImageUrls || [];
      const updatedUrls = [...currentUrls, ...newUrls];
      setEditingFrame({ ...editingFrame, localStyleImageUrls: updatedUrls });
    }
  };

  const handleDeleteFrame = async (id: string) => {
    if (!confirm('Are you sure you want to delete this frame?')) return;
    setDeletingFrameId(id);
    try {
      const frame = frames.find(f => f.id === id);

      const gensSnap = await getDocs(collection(db, 'projects', projectId, 'frames', id, 'generations'));
      for (const genDoc of gensSnap.docs) {
        const path = (genDoc.data() as { storagePath?: string }).storagePath;
        if (path) {
          try {
            await deleteObject(ref(storage, path));
          } catch (e) {
            console.error('Error deleting generation file:', e);
          }
        }
        await deleteDoc(genDoc.ref);
      }

      const chunksSnap = await getDocs(collection(db, 'projects', projectId, 'frames', id, 'chunks'));
      for (const ch of chunksSnap.docs) {
        await deleteDoc(ch.ref);
      }

      if (frame?.storagePath) {
        try {
          await deleteObject(ref(storage, frame.storagePath));
        } catch (e) {
          console.error('Error deleting storage object:', e);
        }
      }

      await deleteDoc(doc(db, 'projects', projectId, 'frames', id));
      toast.success('Frame deleted');
    } catch (error) {
      toast.error('Failed to delete frame');
    } finally {
      setDeletingFrameId(null);
    }
  };

  const handleImportCurrentToHistory = async (frame: Frame) => {
    if (frame.isChunked) {
      toast.error('Import is not available for chunked legacy images.');
      return;
    }
    if (!frame.storagePath || !frame.generatedImageUrl) {
      toast.error('No stored image to import.');
      return;
    }
    setImportingHistory(true);
    try {
      const genRef = doc(collection(db, 'projects', projectId, 'frames', frame.id, 'generations'));
      await setDoc(genRef, {
        storagePath: frame.storagePath,
        downloadUrl: frame.generatedImageUrl,
        createdAt: serverTimestamp(),
        generationPrompt: frame.generationPrompt || '',
      });
      await updateDoc(doc(db, 'projects', projectId, 'frames', frame.id), {
        activeGenerationId: genRef.id,
      });
      toast.success('Current image added to history');
      setHistoryReloadToken((t) => t + 1);
    } catch (e) {
      console.error(e);
      toast.error('Failed to import image into history');
    } finally {
      setImportingHistory(false);
    }
  };

  const handleSetActiveGeneration = async (gen: FrameGeneration) => {
    if (!historyFrame) return;
    setSettingActiveGenId(gen.id);
    try {
      await updateDoc(doc(db, 'projects', projectId, 'frames', historyFrame.id), {
        generatedImageUrl: gen.downloadUrl,
        storagePath: gen.storagePath,
        activeGenerationId: gen.id,
        isChunked: false,
        status: 'generated',
        generationPrompt: gen.generationPrompt ?? historyFrame.generationPrompt,
      });
      toast.success('This version is now active on the frame');
      setHistoryFrame(null);
    } catch (e) {
      console.error(e);
      toast.error('Failed to set active version');
    } finally {
      setSettingActiveGenId(null);
    }
  };

  const handleStatusChange = async (id: string, status: Frame['status']) => {
    setUpdatingStatusId(id);
    try {
      await updateDoc(doc(db, 'projects', projectId, 'frames', id), { status });
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const glassToolbar =
    'rounded-2xl border border-neutral-200 bg-white/95 shadow-[0_8px_32px_rgba(31,38,135,0.07),inset_0_1px_0_0_rgba(255,255,255,0.5)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.06)]';

  const selectedFramesOrdered = frames.filter((f) => selectedFrameIds.has(f.id));

  return (
    <div className="space-y-8">
      <div
        className={cn(
          'sticky z-20 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between',
          glassToolbar,
        )}
        style={{
          top: stickyTopOffsetPx > 0 ? `${stickyTopOffsetPx}px` : 'clamp(9.5rem, 22vh, 14rem)',
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-950 shadow-inner backdrop-blur-md dark:border-white/10 dark:bg-white/5">
            <span className="tabular-nums text-neutral-950">{selectedFrameIds.size}</span>
            <span>selected</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg border-neutral-300 bg-white text-neutral-950 backdrop-blur-sm hover:bg-neutral-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              onClick={() => setSelectedFrameIds(new Set(frames.map(f => f.id)))}
            >
              Select all
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg border-neutral-300 bg-white text-neutral-950 backdrop-blur-sm hover:bg-neutral-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              onClick={() => setSelectedFrameIds(new Set())}
            >
              Deselect all
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Select value={quality} onValueChange={(v: any) => setQuality(v)}>
            <SelectTrigger className="h-9 w-[9.5rem] rounded-lg border-neutral-300 bg-white text-neutral-950 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
              <SelectValue placeholder="Quality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="high">High fidelity</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={handleGenerateSelected}
            disabled={isGenerating || selectedFrameIds.size === 0}
            aria-busy={isGenerating}
            className="h-9 min-w-[11.5rem] rounded-lg border border-neutral-300 bg-neutral-100 text-neutral-950 shadow-[0_4px_16px_rgba(0,0,0,0.08)] backdrop-blur-sm hover:bg-neutral-200 dark:border-white/10 dark:bg-white/15 dark:text-neutral-950 dark:hover:bg-white/25"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                {generationProgress
                  ? `Generating ${generationProgress.current}/${generationProgress.total}…`
                  : 'Preparing…'}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" aria-hidden />
                Generate selected
              </>
            )}
          </Button>
        </div>
      </div>

      {frames.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/50 bg-white/25 px-8 py-16 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/50 bg-white/45 shadow-md backdrop-blur-md dark:border-white/10 dark:bg-white/10">
            <Clapperboard className="h-7 w-7 text-violet-600 dark:text-violet-400" />
          </div>
          <h3 className="text-lg font-semibold tracking-tight text-neutral-950">No frames yet</h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-neutral-950">
            Go to <span className="font-medium">Script & Style</span>, paste your script table, then run <span className="font-medium">Parse Script</span> to generate frames here.
          </p>
        </div>
      )}

      <div className={cn('grid gap-6', frameGridColsClass(gridColumns))}>
        {frames.map((frame) => {
          const activeIdx =
            generatingActiveFrameId === null
              ? -1
              : selectedFramesOrdered.findIndex((f) => f.id === generatingActiveFrameId);
          const myIdx = selectedFramesOrdered.findIndex((f) => f.id === frame.id);
          const showGenOverlay =
            isGenerating &&
            selectedFrameIds.has(frame.id) &&
            !(frame.generatedImageUrl || frame.isChunked);
          const isActiveGen = showGenOverlay && generatingActiveFrameId === frame.id;
          const isPreparing = showGenOverlay && !generatingActiveFrameId;
          const isQueued =
            showGenOverlay &&
            generatingActiveFrameId !== null &&
            frame.id !== generatingActiveFrameId &&
            myIdx > activeIdx &&
            activeIdx >= 0;
          const overlayLabel = isPreparing
            ? 'Preparing…'
            : isActiveGen && generationProgress
              ? `Generating frame ${frame.frameNumber} · step ${generationProgress.current} of ${generationProgress.total}`
              : isQueued
                ? `In queue (${myIdx - activeIdx})`
                : 'Generating…';

          return (
          <Card
            key={frame.id}
            className={cn(
              'overflow-hidden rounded-2xl border border-white/45 bg-white/35 shadow-[0_8px_32px_rgba(31,38,135,0.05)] backdrop-blur-xl transition-all duration-200 dark:border-white/10 dark:bg-white/[0.06]',
              selectedFrameIds.has(frame.id)
                ? 'border-violet-400/55 shadow-[0_8px_28px_rgba(139,92,246,0.18)] ring-2 ring-violet-400/30'
                : 'hover:border-white/60 hover:shadow-[0_12px_40px_rgba(31,38,135,0.1)] dark:hover:border-white/15',
            )}
          >
            <div className="relative aspect-video bg-white/30 backdrop-blur-sm group dark:bg-white/5">
              {frame.generatedImageUrl || frame.isChunked ? (
                <ChunkedImage 
                  frame={frame} 
                  projectId={projectId} 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-neutral-950/80">
                  <div className="rounded-xl bg-background/80 p-3 shadow-sm ring-1 ring-border/50">
                    <ImageIcon className="h-10 w-10 opacity-50" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Pending generation</p>
                </div>
              )}

              {showGenOverlay && (
                <div
                  className="absolute inset-0 z-[15] flex flex-col items-center justify-center gap-3 bg-white/75 px-4 backdrop-blur-sm motion-reduce:animate-none dark:bg-black/55"
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <Loader2
                    className="h-10 w-10 shrink-0 animate-spin text-violet-600 motion-reduce:animate-none dark:text-violet-400"
                    aria-hidden
                  />
                  <p className="max-w-[min(100%,14rem)] text-center text-xs font-semibold leading-snug text-neutral-950 dark:text-neutral-100">
                    {overlayLabel}
                  </p>
                  <div className="frame-gen-indeterminate-track mt-1 h-1.5 w-[min(12rem,85%)] overflow-hidden rounded-full bg-neutral-200/90 dark:bg-white/15">
                    <div className="frame-gen-indeterminate-bar h-full w-2/5 rounded-full bg-violet-500/90 dark:bg-violet-400/90" />
                  </div>
                </div>
              )}
              
              <div className="absolute top-3 left-3 z-20">
                <Checkbox 
                  checked={selectedFrameIds.has(frame.id)} 
                  onCheckedChange={() => toggleSelection(frame.id)}
                  className="w-5 h-5 bg-white/80 data-[state=checked]:bg-black"
                />
              </div>

              <div className="absolute top-3 right-3 z-20 flex flex-col gap-2 items-end">
                <Badge variant={frame.status === 'generated' ? 'default' : 'secondary'} className="bg-white/90 text-black border-none">
                  {frame.category}
                </Badge>
                {frame.localStyleImageUrls && frame.localStyleImageUrls.length > 0 && (
                  <Badge variant="outline" className="border-blue-300 bg-blue-100 text-neutral-950 text-[10px]">
                    Local Style Ref
                  </Badge>
                )}
              </div>

              { (frame.generatedImageUrl || frame.isChunked) && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <Button 
                    size="icon" 
                    variant="secondary" 
                    className="rounded-full"
                    onClick={async () => {
                      try {
                        let url = frame.generatedImageUrl;
                        if (frame.isChunked) {
                          const chunksSnap = await getDocs(query(
                            collection(db, 'projects', projectId, 'frames', frame.id, 'chunks'),
                            orderBy('index', 'asc')
                          ));
                          url = chunksSnap.docs.map(d => d.data().data).join('');
                        }
                        if (url) {
                          setPreviewImage({ url, title: `Frame ${frame.frameNumber}` });
                        } else {
                          toast.error("Image data not found");
                        }
                      } catch (err) {
                        console.error("Preview error:", err);
                        toast.error("Failed to load preview");
                      }
                    }}
                  >
                    <Eye size={18} />
                  </Button>
                  <Button size="icon" variant="secondary" className="rounded-full">
                    <a 
                      href="#" 
                      onClick={async (e) => {
                        e.preventDefault();
                        try {
                          let url = frame.generatedImageUrl;
                          if (frame.isChunked) {
                            const chunksSnap = await getDocs(query(
                              collection(db, 'projects', projectId, 'frames', frame.id, 'chunks'),
                              orderBy('index', 'asc')
                            ));
                            url = chunksSnap.docs.map(d => d.data().data).join('');
                          }
                          if (url) {
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `frame-${frame.frameNumber}.png`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          } else {
                            toast.error("Image data not found");
                          }
                        } catch (err) {
                          console.error("Download error:", err);
                          toast.error("Failed to download image");
                        }
                      }}
                      className="flex items-center justify-center w-full h-full"
                    >
                      <Download size={18} />
                    </a>
                  </Button>
                </div>
              )}
            </div>

            <CardHeader className="p-4 pb-2 space-y-1">
                <div className="flex justify-between items-start">
                  <div className="text-xs font-bold text-neutral-950 uppercase tracking-tighter">Frame {frame.frameNumber}</div>
                  <div className="flex gap-1">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-neutral-950 hover:text-violet-700"
                            onClick={() => setHistoryFrame(frame)}
                          >
                            <History size={14} />
                          </Button>
                        }
                      />
                      <TooltipContent>
                        <p>Generation history</p>
                      </TooltipContent>
                    </Tooltip>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-neutral-950 hover:text-neutral-950"
                      onClick={() => {
                        // Ensure generationPrompt is populated if empty so modal isn't "empty"
                        const frameToEdit = { ...frame };
                        if (!frameToEdit.generationPrompt) {
                          frameToEdit.generationPrompt = ""; // Ensure it's at least an empty string for the textarea
                        }
                        setEditingFrame(frameToEdit);
                      }}
                    >
                      <Edit3 size={14} />
                    </Button>
                    {frame.status === 'generated' && (
                      <Tooltip>
                        <TooltipTrigger render={
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-neutral-950 hover:text-blue-700"
                            disabled={isGenerating}
                            aria-busy={isGenerating}
                            onClick={() => {
                              setSelectedFrameIds(new Set([frame.id]));
                              handleGenerateSelected();
                            }}
                          >
                            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                          </Button>
                        } />
                        <TooltipContent>
                          <p>Regenerate this frame</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-neutral-950 hover:text-red-600"
                      disabled={deletingFrameId === frame.id}
                      aria-busy={deletingFrameId === frame.id}
                      onClick={() => handleDeleteFrame(frame.id)}
                    >
                      {deletingFrameId === frame.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </Button>
                  </div>
                </div>
              <h4 className="font-semibold text-sm line-clamp-1 text-neutral-950">{frame.visualIntent}</h4>
              {frame.generationPrompt && (
                <div className="mt-2 p-2 bg-neutral-50 rounded border border-neutral-200">
                  <p className="text-[10px] font-bold text-neutral-950 uppercase mb-1">AI Prompt Preview</p>
                  <p className="text-[10px] text-neutral-950 line-clamp-2 leading-tight">
                    {frame.generationPrompt}
                  </p>
                </div>
              )}
            </CardHeader>

            <CardContent className="p-4 pt-0">
              <p className="text-xs text-neutral-950 line-clamp-2 italic mb-3">
                "{frame.narratedText}"
              </p>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`h-7 px-2 text-[10px] uppercase font-bold ${frame.status === 'skipped' ? 'text-red-700 bg-red-50' : 'text-neutral-950'}`}
                  disabled={updatingStatusId === frame.id}
                  aria-busy={updatingStatusId === frame.id}
                  onClick={() => handleStatusChange(frame.id, frame.status === 'skipped' ? 'pending' : 'skipped')}
                >
                  {updatingStatusId === frame.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : frame.status === 'skipped' ? (
                    'Skipped'
                  ) : (
                    'Skip'
                  )}
                </Button>
                <div className="ml-auto flex items-center gap-1">
                  {frame.status === 'generated' ? (
                    <CheckCircle2 size={14} className="text-green-500" />
                  ) : (
                    <Circle size={14} className="text-neutral-300" />
                  )}
                  <span className="text-[10px] uppercase font-bold text-neutral-950">{frame.status}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden border-none bg-neutral-950">
          <DialogHeader className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur-md p-2 rounded-lg border border-neutral-200">
            <DialogTitle className="text-neutral-950 text-sm font-bold uppercase tracking-widest">
              {previewImage?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="w-full h-full flex items-center justify-center p-4">
            {previewImage && (
              <img 
                src={previewImage.url} 
                alt={previewImage.title} 
                className="max-w-full max-h-[80vh] object-contain shadow-2xl"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Frame Edit Dialog */}
      <Dialog open={!!editingFrame} onOpenChange={(open) => !open && setEditingFrame(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Frame {editingFrame?.frameNumber}</DialogTitle>
            <DialogDescription>
              Adjust the visual intent or the final AI prompt to guide the generation.
            </DialogDescription>
          </DialogHeader>

          {editingFrame && (
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label>Style Library Override</Label>
                <Select 
                  value={editingFrame.localStyleReferenceId || 'global'} 
                  onValueChange={(v) => setEditingFrame({ ...editingFrame, localStyleReferenceId: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a style...">
                      {(value) =>
                        frameStyleOverrideLabel(
                          value as string | null | undefined,
                          availableStyles,
                        )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Use Project Global Style</SelectItem>
                    <SelectItem value="none">None (No Library Style)</SelectItem>
                    {availableStyles.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-neutral-950">
                  Selecting a style here will override the project's global style for this frame.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Visual Intent</Label>
                <Input 
                  value={editingFrame.visualIntent} 
                  onChange={(e) => setEditingFrame({ ...editingFrame, visualIntent: e.target.value })}
                  placeholder="Describe the visual scene..."
                />
              </div>

              <div className="space-y-2">
                <Label>AI Generation Prompt (Manual Override)</Label>
                <Textarea 
                  value={editingFrame.generationPrompt || ""} 
                  onChange={(e) => setEditingFrame({ ...editingFrame, generationPrompt: e.target.value })}
                  placeholder="The final prompt sent to the AI. Leave empty to auto-generate from visual intent."
                  className="min-h-[120px] font-mono text-xs"
                />
                <p className="text-[10px] text-neutral-950">
                  If you write something here, it will be used exactly as is for generation.
                </p>
              </div>

              <div className="space-y-3">
                <Label>Local Style References (Frame Specific)</Label>
                <div className="flex flex-wrap gap-2">
                  {editingFrame.localStyleImageUrls?.map((url, idx) => (
                    <div key={idx} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                      <img src={url} className="w-full h-full object-cover" />
                      <button 
                        onClick={() => {
                          const updated = editingFrame.localStyleImageUrls?.filter((_, i) => i !== idx);
                          setEditingFrame({ ...editingFrame, localStyleImageUrls: updated });
                        }}
                        className="absolute inset-0 bg-white/85 opacity-0 group-hover:opacity-100 flex items-center justify-center text-neutral-950 transition-opacity"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-black hover:bg-gray-50 transition-all">
                    <UploadIcon size={20} className="text-neutral-950" />
                    <span className="text-[10px] mt-1 font-medium text-neutral-950">Add</span>
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleLocalStyleUpload} />
                  </label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFrame(null)} disabled={isSavingFrame}>
              Cancel
            </Button>
            <Button onClick={() => handleUpdateFrame(editingFrame!)} disabled={isSavingFrame} aria-busy={isSavingFrame}>
              {isSavingFrame ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generation history */}
      <Dialog open={!!historyFrame} onOpenChange={(open) => !open && setHistoryFrame(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto border-neutral-200 bg-white/95 dark:bg-neutral-950">
          <DialogHeader>
            <DialogTitle>Generation history — Frame {historyFrame?.frameNumber}</DialogTitle>
            <DialogDescription>
              Newest first. Each regenerate adds a version without removing older ones (up to {MAX_GENERATIONS_PER_FRAME}).
            </DialogDescription>
          </DialogHeader>

          {historyFrame && (
            <div className="space-y-4 py-2">
              {historyLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
                </div>
              ) : historyGenerations.length === 0 ? (
                <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center shadow-sm dark:border-white/10 dark:bg-neutral-900">
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    No saved generations yet. New runs will appear here. If you already have an image from before this
                    feature, you can import it once.
                  </p>
                  {historyFrame.generatedImageUrl && !historyFrame.isChunked && historyFrame.storagePath && (
                    <Button
                      className="mt-4"
                      variant="secondary"
                      disabled={importingHistory}
                      onClick={() => handleImportCurrentToHistory(historyFrame)}
                    >
                      {importingHistory ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                          Importing…
                        </>
                      ) : (
                        'Import current image into history'
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                (() => {
                  const selectedGen = historyGenerations[historyIndex];
                  if (!selectedGen) return null;
                  const isActive = selectedGen.id === historyFrame.activeGenerationId;
                  const newestIdx = 0;
                  const oldestIdx = historyGenerations.length - 1;
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-neutral-950 dark:text-neutral-100">
                          Version {historyIndex + 1} of {historyGenerations.length}
                          <span className="text-neutral-500 dark:text-neutral-400"> (1 = newest)</span>
                        </p>
                        {isActive ? (
                          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Active on card</Badge>
                        ) : (
                          <Badge variant="outline">Not active</Badge>
                        )}
                      </div>

                      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-white/10">
                        <img
                          src={selectedGen.downloadUrl}
                          alt=""
                          className="h-full w-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-y-0 left-0 flex items-center">
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="ml-2 rounded-full opacity-90"
                            disabled={historyIndex >= oldestIdx}
                            onClick={() => setHistoryIndex((i) => Math.min(oldestIdx, i + 1))}
                            aria-label="Older version"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </Button>
                        </div>
                        <div className="absolute inset-y-0 right-0 flex items-center">
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="mr-2 rounded-full opacity-90"
                            disabled={historyIndex <= newestIdx}
                            onClick={() => setHistoryIndex((i) => Math.max(newestIdx, i - 1))}
                            aria-label="Newer version"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-white/10 dark:bg-neutral-900">
                        <p className="mb-2 text-[10px] font-bold uppercase text-neutral-500">Thumbnails</p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {historyGenerations.map((g, idx) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => setHistoryIndex(idx)}
                              className={cn(
                                'relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border-2 transition-all',
                                idx === historyIndex
                                  ? 'border-violet-500 ring-2 ring-violet-300'
                                  : 'border-neutral-200 hover:border-neutral-400 dark:border-white/10',
                              )}
                            >
                              <img
                                src={g.downloadUrl}
                                alt=""
                                className="h-full w-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              {g.id === historyFrame.activeGenerationId && (
                                <span className="absolute bottom-0 left-0 right-0 bg-emerald-600/90 py-0.5 text-center text-[9px] font-bold text-white">
                                  Active
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {selectedGen.generationPrompt && (
                        <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 dark:border-white/10 dark:bg-neutral-900/80">
                          <p className="mb-1 text-[10px] font-bold uppercase text-neutral-500">Prompt for this version</p>
                          <p className="max-h-24 overflow-y-auto text-xs text-neutral-800 dark:text-neutral-200">
                            {selectedGen.generationPrompt}
                          </p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={isActive || settingActiveGenId === selectedGen.id}
                          onClick={() => handleSetActiveGeneration(selectedGen)}
                        >
                          {settingActiveGenId === selectedGen.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                              Applying…
                            </>
                          ) : (
                            'Use this version'
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = selectedGen.downloadUrl;
                            link.download = `frame-${historyFrame.frameNumber}-v${historyIndex + 1}.png`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download this version
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            setPreviewImage({
                              url: selectedGen.downloadUrl,
                              title: `Frame ${historyFrame.frameNumber} — version ${historyIndex + 1}`,
                            })
                          }
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Full screen
                        </Button>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

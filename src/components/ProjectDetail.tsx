import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, updateDoc, collection, addDoc, serverTimestamp, query, orderBy, writeBatch } from 'firebase/firestore';
import { geminiService } from '../geminiService';
import { openaiService } from '../openaiService';
import { getTextProvider } from '@/lib/apiKeysStorage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FrameGrid } from './FrameGrid';
import { ArrowLeft, Sparkles, Settings2, Save, FileText, LayoutGrid, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Project {
  id: string;
  name: string;
  scriptRaw?: string;
  globalStylePrompt?: string;
  styleReferenceId?: string;
}

interface StyleRef {
  id: string;
  name: string;
}

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
}

export function ProjectDetail({ projectId, onBack }: ProjectDetailProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [scriptInput, setScriptInput] = useState('');
  const [stylePrompt, setStylePrompt] = useState('');
  const [styleRefId, setStyleRefId] = useState<string>('none');
  const [availableStyles, setAvailableStyles] = useState<StyleRef[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [activeTab, setActiveTab] = useState('frames');

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'projects', projectId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Project;
        setProject({ id: snapshot.id, ...data });
        setScriptInput(data.scriptRaw || '');
        setStylePrompt(data.globalStylePrompt || '');
        setStyleRefId(data.styleReferenceId || 'none');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `projects/${projectId}`);
    });
    return () => unsubscribe();
  }, [projectId]);

  useEffect(() => {
    const q = query(collection(db, 'styleReferences'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name } as StyleRef));
      setAvailableStyles(data);
    });
    return () => unsubscribe();
  }, []);

  const handleSaveSettings = async () => {
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        scriptRaw: scriptInput,
        globalStylePrompt: stylePrompt,
        styleReferenceId: styleRefId === 'none' ? null : styleRefId,
        updatedAt: serverTimestamp()
      });
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  const handleParseScript = async () => {
    if (!scriptInput.trim()) {
      toast.error('Please paste a script first');
      return;
    }
    setIsParsing(true);
    try {
      const frames =
        getTextProvider() === 'openai'
          ? await openaiService.parseScript(scriptInput)
          : await geminiService.parseScript(scriptInput);
      
      const batch = writeBatch(db);
      const framesRef = collection(db, 'projects', projectId, 'frames');
      
      frames.forEach((frame) => {
        const newFrameRef = doc(framesRef);
        batch.set(newFrameRef, {
          ...frame,
          projectId,
          status: 'pending',
          createdAt: serverTimestamp()
        });
      });
      
      await batch.commit();
      toast.success(`Parsed ${frames.length} frames successfully`);
      setActiveTab('frames');
    } catch (error) {
      console.error(error);
      toast.error('Failed to parse script');
    } finally {
      setIsParsing(false);
    }
  };

  if (!project) return null;

  const glassShell =
    'rounded-2xl border border-white/50 bg-white/45 shadow-[0_8px_32px_rgba(31,38,135,0.08),inset_0_1px_0_0_rgba(255,255,255,0.55)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-white/5 dark:shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_0_0_rgba(255,255,255,0.06)]';
  const glassCard =
    'rounded-2xl border border-white/45 bg-white/35 shadow-[0_8px_32px_rgba(31,38,135,0.06),inset_0_1px_0_0_rgba(255,255,255,0.5)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[0_8px_32px_rgba(0,0,0,0.25)]';
  const glassInput =
    'border-white/40 bg-white/50 shadow-inner backdrop-blur-sm dark:border-white/10 dark:bg-white/5';

  return (
    <div className="relative flex min-h-full flex-col">
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-violet-400/25 blur-3xl dark:bg-violet-600/15" aria-hidden />
      <div className="pointer-events-none absolute -right-16 top-32 h-64 w-64 rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-500/10" aria-hidden />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex w-full flex-col gap-8">
        <div className="sticky top-0 z-30 mb-2">
          <div className={cn('overflow-hidden', glassShell)}>
            <nav aria-label="Project workspace" className="border-b border-white/35 p-2 dark:border-white/10">
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-transparent p-0 sm:max-w-md">
                <TabsTrigger
                  value="frames"
                  className={cn(
                    'relative flex min-h-11 items-center justify-center gap-2 rounded-xl border border-transparent px-4 py-3 text-sm font-medium text-muted-foreground shadow-none transition-all after:hidden',
                    'hover:bg-white/30 hover:text-foreground dark:hover:bg-white/10',
                    'data-active:border-white/40 data-active:bg-white/65 data-active:text-foreground data-active:shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:data-active:border-white/15 dark:data-active:bg-white/15',
                    '[&_svg]:opacity-70 data-active:[&_svg]:opacity-100',
                  )}
                >
                  <LayoutGrid className="h-4 w-4 shrink-0" />
                  Frames
                </TabsTrigger>
                <TabsTrigger
                  value="script"
                  className={cn(
                    'relative flex min-h-11 items-center justify-center gap-2 rounded-xl border border-transparent px-4 py-3 text-sm font-medium text-muted-foreground shadow-none transition-all after:hidden',
                    'hover:bg-white/30 hover:text-foreground dark:hover:bg-white/10',
                    'data-active:border-white/40 data-active:bg-white/65 data-active:text-foreground data-active:shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:data-active:border-white/15 dark:data-active:bg-white/15',
                    '[&_svg]:opacity-70 data-active:[&_svg]:opacity-100',
                  )}
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  Script &amp; Style
                </TabsTrigger>
              </TabsList>
            </nav>

            <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onBack}
                  className="mt-0.5 shrink-0 rounded-full text-muted-foreground hover:bg-white/20 hover:text-foreground dark:hover:bg-white/10"
                >
                  <ArrowLeft size={20} />
                </Button>
                <div className="min-w-0 space-y-1">
                  <h2 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{project.name}</h2>
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Production Studio</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  onClick={handleSaveSettings}
                  className="h-11 rounded-xl border-white/50 bg-white/40 px-5 shadow-sm backdrop-blur-md hover:bg-white/60 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <Save className="mr-2 h-4 w-4 opacity-80" /> Save Settings
                </Button>
                <Button
                  onClick={handleParseScript}
                  disabled={isParsing}
                  className="h-11 rounded-xl border border-white/20 bg-white/90 px-6 text-foreground shadow-[0_4px_20px_rgba(0,0,0,0.12)] backdrop-blur-sm hover:bg-white dark:border-white/10 dark:bg-white/15 dark:text-foreground"
                >
                  {isParsing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" /> Parse Script
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <TabsContent value="frames" className="mt-0 outline-none focus-visible:ring-0">
          <FrameGrid
            projectId={projectId}
            globalStyle={stylePrompt}
            styleReferenceId={styleRefId}
            availableStyles={availableStyles}
          />
        </TabsContent>

        <TabsContent value="script" className="mt-0 outline-none focus-visible:ring-0">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-10">
            <Card className={cn('group/card relative overflow-hidden lg:col-span-2', glassCard)}>
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/25 to-transparent" aria-hidden />
              <CardHeader className="space-y-1 border-b border-white/25 pb-5 pt-6 dark:border-white/10">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/40 bg-white/50 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/10">
                    <FileText size={20} className="text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-lg font-semibold tracking-tight">Raw script input</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      Paste your script table (Fr, On Screen Visual, Script…), then run{' '}
                      <span className="font-medium text-foreground/80">Parse Script</span> to create frames.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 sm:p-6">
                <Textarea
                  placeholder="Paste your script table here…"
                  className={cn(
                    'min-h-[min(520px,70vh)] resize-y rounded-xl p-5 font-mono text-sm leading-relaxed text-foreground transition-[box-shadow,border-color]',
                    'placeholder:text-muted-foreground/60 focus-visible:border-violet-400/50 focus-visible:ring-2 focus-visible:ring-violet-400/25',
                    glassInput,
                  )}
                  value={scriptInput}
                  onChange={(e) => setScriptInput(e.target.value)}
                />
              </CardContent>
            </Card>

            <div className="flex flex-col gap-6 lg:col-span-1">
              <Card className={cn('overflow-hidden', glassCard)}>
                <CardHeader className="space-y-1 border-b border-white/25 pb-5 pt-6 dark:border-white/10">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/40 bg-white/50 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/10">
                      <Settings2 size={20} className="text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="text-lg font-semibold tracking-tight">Global style</CardTitle>
                      <CardDescription className="text-sm leading-relaxed">
                        Keep a consistent look across every frame in this project.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 p-5 sm:p-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Style reference library</Label>
                    <Select value={styleRefId} onValueChange={setStyleRefId}>
                      <SelectTrigger className={cn('h-11 rounded-xl', glassInput)}>
                        <SelectValue placeholder="Select a style…" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="none">None (manual prompt only)</SelectItem>
                        {availableStyles.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Manual style prompt</Label>
                    <Textarea
                      placeholder="e.g. cinematic 3D illustration, vibrant colors, detailed textures, soft lighting…"
                      className={cn(
                        'min-h-[200px] resize-y rounded-xl p-4 text-sm leading-relaxed transition-[box-shadow,border-color]',
                        'focus-visible:border-violet-400/50 focus-visible:ring-2 focus-visible:ring-violet-400/25',
                        glassInput,
                      )}
                      value={stylePrompt}
                      onChange={(e) => setStylePrompt(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="relative overflow-hidden rounded-2xl border border-white/50 bg-white/25 p-6 text-foreground shadow-[0_8px_32px_rgba(31,38,135,0.07)] backdrop-blur-xl dark:border-white/10 dark:bg-violet-950/40 dark:text-white">
                <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-400/30 blur-3xl dark:bg-violet-500/20" aria-hidden />
                <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-amber-300/20 blur-2xl dark:bg-amber-400/10" aria-hidden />
                <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700/90 dark:text-violet-200/90">
                  <Sparkles size={14} className="text-amber-500 dark:text-amber-300" />
                  Pro tip
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground dark:text-slate-300">
                  Try phrases like <span className="font-medium text-foreground dark:text-white">&quot;vibrant colors&quot;</span>,{' '}
                  <span className="font-medium text-foreground dark:text-white">&quot;cinematic lighting&quot;</span>, or{' '}
                  <span className="font-medium text-foreground dark:text-white">&quot;watercolor&quot;</span> to keep frames visually aligned.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

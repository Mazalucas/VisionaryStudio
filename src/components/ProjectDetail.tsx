import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, updateDoc, collection, serverTimestamp, query, writeBatch, getDocs } from 'firebase/firestore';
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
import { FrameGrid, type FrameGridColumnCount } from './FrameGrid';
import { ArrowLeft, Sparkles, Settings2, Save, FileText, LayoutGrid, Loader2, Settings } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { logActivity } from '../lib/activityLogger';

interface Project {
  id: string;
  name: string;
  scriptRaw?: string;
}

interface StyleRef {
  id: string;
  name: string;
}

/** Label for global style select when the menu is closed (items not mounted). */
function globalStyleSelectLabel(
  value: string | null | undefined,
  styles: StyleRef[],
): string {
  const v = value ?? 'none';
  if (v === 'none') return 'None (manual prompt only)';
  const found = styles.find((s) => s.id === v);
  return found?.name ?? 'Style (unavailable)';
}

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
}

const GLASS_SHELL =
  'rounded-2xl border border-border bg-card/45 shadow-xl backdrop-blur-2xl backdrop-saturate-150';

const GLASS_CARD =
  'rounded-2xl border border-border bg-card/35 shadow-lg backdrop-blur-xl backdrop-saturate-150';

const GLASS_INPUT =
  'border-border bg-background shadow-inner backdrop-blur-sm';

const tabTriggerClass =
  'relative flex min-h-11 items-center justify-center gap-2 rounded-xl border border-transparent px-4 py-3 text-sm font-medium text-muted-foreground shadow-none transition-all after:hidden hover:bg-muted/50 hover:text-foreground data-active:border-border data-active:bg-card data-active:text-foreground data-active:shadow-md [&_svg]:opacity-70 data-active:[&_svg]:opacity-100';

const SCRIPT_TOOLBAR =
  'rounded-2xl border border-border bg-card/90 shadow-xl backdrop-blur-2xl backdrop-saturate-150';

interface StudioHeaderProps {
  projectName: string;
  projectId: string;
  onBack: () => void;
  headerActions?: React.ReactNode;
}

function StudioHeader({ projectName, projectId, onBack, headerActions }: StudioHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(projectName);

  useEffect(() => {
    setName(projectName);
  }, [projectName]);

  const handleSave = async () => {
    if (!name.trim() || name === projectName) {
      setIsEditing(false);
      setName(projectName);
      return;
    }
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        name: name.trim(),
        updatedAt: serverTimestamp()
      });
      toast.success('Project name updated');
    } catch (error) {
      toast.error('Failed to update project name');
      setName(projectName);
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <header className={cn('overflow-hidden', GLASS_SHELL)}>
      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="mt-1 shrink-0 rounded-full text-foreground hover:bg-muted"
          >
            <ArrowLeft size={22} />
          </Button>
          <div className="min-w-0 space-y-1">
            {isEditing ? (
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') {
                    setIsEditing(false);
                    setName(projectName);
                  }
                }}
                className="h-9 w-full max-w-md border-none bg-transparent p-0 text-2xl font-bold tracking-tight text-foreground focus-visible:ring-0 sm:text-3xl"
              />
            ) : (
              <h1 
                onClick={() => setIsEditing(true)}
                className="group flex cursor-pointer items-center gap-2 truncate text-2xl font-bold tracking-tight text-foreground hover:text-primary sm:text-3xl"
              >
                {projectName}
                <Sparkles size={16} className="opacity-0 transition-opacity group-hover:opacity-100" />
              </h1>
            )}
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Production Studio</p>
          </div>
        </div>
        {headerActions != null ? (
          <div className="flex shrink-0 items-center justify-end self-end sm:self-center">{headerActions}</div>
        ) : null}
      </div>
    </header>
  );
}

const FRAME_GRID_COLS_STORAGE_PREFIX = 'visionary-frame-grid-cols:';

function frameGridColsStorageKey(projectId: string) {
  return `${FRAME_GRID_COLS_STORAGE_PREFIX}${projectId}`;
}

function parseStoredFrameGridColumns(raw: string | null): FrameGridColumnCount {
  if (raw == null) return 2;
  const n = Number.parseInt(raw, 10);
  if (n === 1 || n === 2 || n === 3 || n === 4) return n;
  return 2;
}

function FrameGridColumnsPopover({
  value,
  onChange,
}: {
  value: FrameGridColumnCount;
  onChange: (v: FrameGridColumnCount) => void;
}) {
  const [open, setOpen] = useState(false);
  const options: FrameGridColumnCount[] = [1, 2, 3, 4];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-full text-foreground hover:bg-muted"
          aria-label="Grid columns"
        >
          <Settings size={20} aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto min-w-[12rem] p-3" align="end" sideOffset={8}>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-950/70 dark:text-neutral-100/70">
          Frame grid columns
        </p>
        <div className="flex flex-wrap gap-1.5">
          {options.map((n) => (
            <Button
              key={n}
              type="button"
              variant={value === n ? 'default' : 'outline'}
              size="sm"
              className="min-w-9 rounded-lg"
              onClick={() => {
                onChange(n);
                setOpen(false);
              }}
            >
              {n}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface ScriptStyleToolbarProps {
  onSave: () => void;
  onParseScript: () => void;
  isParsing: boolean;
  isSaving: boolean;
}

function ScriptStyleToolbar({ onSave, onParseScript, isParsing, isSaving }: ScriptStyleToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end',
        SCRIPT_TOOLBAR,
      )}
    >
      <Button
        variant="outline"
        onClick={onSave}
        disabled={isSaving || isParsing}
        aria-busy={isSaving}
        className="h-11 min-w-[10.5rem] rounded-xl border-border bg-card px-5 text-foreground shadow-sm hover:bg-muted"
      >
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin opacity-90" aria-hidden />
            Saving…
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4 opacity-90" aria-hidden /> Save Settings
          </>
        )}
      </Button>
      <Button
        onClick={onParseScript}
        disabled={isParsing || isSaving}
        aria-busy={isParsing}
        className="h-11 min-w-[10.5rem] rounded-xl border border-border bg-primary text-primary-foreground px-6 shadow-xl hover:opacity-90"
      >
        {isParsing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Parsing script…
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" aria-hidden /> Parse Script
          </>
        )}
      </Button>
    </div>
  );
}

function WorkspaceTabBar() {
  return (
    <nav aria-label="Workspace sections" className={cn('overflow-hidden p-2', GLASS_SHELL)}>
      <TabsList className="grid h-auto w-full max-w-lg grid-cols-2 gap-1 rounded-xl bg-transparent p-0">
        <TabsTrigger value="frames" className={tabTriggerClass}>
          <LayoutGrid className="h-4 w-4 shrink-0" />
          Frames
        </TabsTrigger>
        <TabsTrigger value="script" className={tabTriggerClass}>
          <FileText className="h-4 w-4 shrink-0" />
          Script & Style
        </TabsTrigger>
      </TabsList>
    </nav>
  );
}

export function ProjectDetail({ projectId, onBack }: ProjectDetailProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [scriptInput, setScriptInput] = useState('');
  const [availableStyles, setAvailableStyles] = useState<StyleRef[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('frames');
  const [frameGridColumns, setFrameGridColumns] = useState<FrameGridColumnCount>(2);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(frameGridColsStorageKey(projectId));
      setFrameGridColumns(parseStoredFrameGridColumns(raw));
    } catch {
      setFrameGridColumns(2);
    }
  }, [projectId]);

  const persistFrameGridColumns = useCallback((v: FrameGridColumnCount) => {
    setFrameGridColumns(v);
    try {
      localStorage.setItem(frameGridColsStorageKey(projectId), String(v));
    } catch {
      // ignore quota / private mode
    }
  }, [projectId]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'projects', projectId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Project;
        setProject({ id: snapshot.id, ...data });
        setScriptInput(data.scriptRaw || '');
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
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        scriptRaw: scriptInput,
        updatedAt: serverTimestamp()
      });
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const studioChromeRef = useRef<HTMLDivElement>(null);
  const [studioChromePx, setStudioChromePx] = useState(0);

  useLayoutEffect(() => {
    const el = studioChromeRef.current;
    if (!el) return;
    const update = () => setStudioChromePx(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeTab, project?.name]);

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
      
      const styleRefSnap = await getDocs(collection(db, 'styleReferences'));
      const styles = styleRefSnap.docs.map(d => ({ id: d.id, name: d.data().name }));

      frames.forEach((frame) => {
        const matchedStyle = styles.find(s => s.name.toLowerCase() === frame.category.toLowerCase());
        const newFrameRef = doc(framesRef);
        batch.set(newFrameRef, {
          ...frame,
          generationPrompt: frame.originalDescription,
          projectId,
          status: 'pending',
          createdAt: serverTimestamp(),
          localStyleReferenceId: matchedStyle ? matchedStyle.id : null
        });
      });
      
      await batch.commit();
      
      // Update totalFrames in the project document
      await updateDoc(doc(db, 'projects', projectId), {
        totalFrames: frames.length,
        updatedAt: serverTimestamp()
      });

      logActivity('Parse Script', `Created ${frames.length} frames from script.`, projectId, project.name);
      
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

  return (
    <div className="relative flex min-h-full flex-col">
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-violet-400/25 blur-3xl dark:bg-violet-600/15" aria-hidden />
      <div className="pointer-events-none absolute -right-16 top-32 h-64 w-64 rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-500/10" aria-hidden />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex w-full flex-col gap-6">
        <div ref={studioChromeRef} className="sticky top-0 z-30 flex flex-col gap-4">
          <StudioHeader
            projectName={project.name}
            projectId={projectId}
            onBack={onBack}
            headerActions={
              activeTab === 'frames' ? (
                <FrameGridColumnsPopover value={frameGridColumns} onChange={persistFrameGridColumns} />
              ) : undefined
            }
          />
          <WorkspaceTabBar />
          {activeTab === 'script' && (
            <ScriptStyleToolbar
              onSave={handleSaveSettings}
              onParseScript={handleParseScript}
              isParsing={isParsing}
              isSaving={isSaving}
            />
          )}
        </div>

        <section aria-label="Workspace content" className="flex min-h-0 flex-1 flex-col">
        <TabsContent value="frames" className="mt-0 outline-none focus-visible:ring-0">
          <FrameGrid
            projectId={projectId}
            projectName={project.name}
            availableStyles={availableStyles}
            stickyTopOffsetPx={studioChromePx}
            gridColumns={frameGridColumns}
          />
        </TabsContent>

        <TabsContent value="script" className="mt-0 outline-none focus-visible:ring-0">
          <div className="flex flex-col gap-8">
            <Card className={cn('group/card relative overflow-hidden', GLASS_CARD)}>
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/25 to-transparent" aria-hidden />
              <CardHeader className="space-y-1 border-b border-border pb-5 pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted shadow-sm backdrop-blur-md">
                    <FileText size={20} className="text-primary" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-lg font-semibold tracking-tight text-foreground">Raw script input</CardTitle>
                    <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                      Paste your script table (Fr, On Screen Visual, Script…), then run{' '}
                      <span className="font-medium text-foreground">Parse Script</span> to create frames.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 sm:p-6">
                <Textarea
                  placeholder="Paste your script table here…"
                  className={cn(
                    'min-h-[min(520px,70vh)] resize-y rounded-xl p-5 font-mono text-sm leading-relaxed text-foreground transition-[box-shadow,border-color]',
                    'placeholder:text-neutral-950/45 focus-visible:border-violet-400/50 focus-visible:ring-2 focus-visible:ring-violet-400/25',
                    GLASS_INPUT,
                  )}
                  value={scriptInput}
                  onChange={(e) => setScriptInput(e.target.value)}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        </section>
      </Tabs>
    </div>
  );
}

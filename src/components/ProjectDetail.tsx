import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, updateDoc, collection, serverTimestamp, query, writeBatch } from 'firebase/firestore';
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
  'rounded-2xl border border-white/50 bg-white/45 shadow-[0_8px_32px_rgba(31,38,135,0.08),inset_0_1px_0_0_rgba(255,255,255,0.55)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-white/5 dark:shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_0_0_rgba(255,255,255,0.06)]';

const GLASS_CARD =
  'rounded-2xl border border-white/45 bg-white/35 shadow-[0_8px_32px_rgba(31,38,135,0.06),inset_0_1px_0_0_rgba(255,255,255,0.5)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[0_8px_32px_rgba(0,0,0,0.25)]';

const GLASS_INPUT =
  'border-white/40 bg-white/50 shadow-inner backdrop-blur-sm dark:border-white/10 dark:bg-white/5';

const tabTriggerClass =
  'relative flex min-h-11 items-center justify-center gap-2 rounded-xl border border-transparent px-4 py-3 text-sm font-medium text-neutral-950/70 shadow-none transition-all after:hidden hover:bg-white/30 hover:text-neutral-950 dark:hover:bg-white/10 data-active:border-white/40 data-active:bg-white/65 data-active:text-neutral-950 data-active:shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:data-active:border-white/15 dark:data-active:bg-white/15 [&_svg]:opacity-70 data-active:[&_svg]:opacity-100';

const SCRIPT_TOOLBAR =
  'rounded-2xl border border-neutral-200 bg-white/90 shadow-[0_8px_32px_rgba(31,38,135,0.07),inset_0_1px_0_0_rgba(255,255,255,0.5)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-white/[0.06]';

interface StudioHeaderProps {
  projectName: string;
  onBack: () => void;
  headerActions?: React.ReactNode;
}

function StudioHeader({ projectName, onBack, headerActions }: StudioHeaderProps) {
  return (
    <header className={cn('overflow-hidden', GLASS_SHELL)}>
      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="mt-0.5 shrink-0 rounded-full text-neutral-950 hover:bg-white/20 hover:text-neutral-950 dark:hover:bg-white/10"
          >
            <ArrowLeft size={20} />
          </Button>
          <div className="min-w-0 space-y-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">{projectName}</h1>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-neutral-950">Production Studio</p>
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
          className="shrink-0 rounded-full text-neutral-950 hover:bg-white/20 hover:text-neutral-950 dark:hover:bg-white/10"
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
        className="h-11 min-w-[10.5rem] rounded-xl border-neutral-300 bg-white px-5 text-neutral-950 shadow-sm hover:bg-neutral-50"
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
        className="h-11 min-w-[10.5rem] rounded-xl border border-neutral-300 bg-neutral-100 px-6 text-neutral-950 shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:bg-neutral-200"
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
  const [stylePrompt, setStylePrompt] = useState('');
  const [styleRefId, setStyleRefId] = useState<string>('none');
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
    setIsSaving(true);
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

  return (
    <div className="relative flex min-h-full flex-col">
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-violet-400/25 blur-3xl dark:bg-violet-600/15" aria-hidden />
      <div className="pointer-events-none absolute -right-16 top-32 h-64 w-64 rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-500/10" aria-hidden />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex w-full flex-col gap-6">
        <div ref={studioChromeRef} className="sticky top-0 z-30 flex flex-col gap-4">
          <StudioHeader
            projectName={project.name}
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
            globalStyle={stylePrompt}
            styleReferenceId={styleRefId}
            availableStyles={availableStyles}
            stickyTopOffsetPx={studioChromePx}
            gridColumns={frameGridColumns}
          />
        </TabsContent>

        <TabsContent value="script" className="mt-0 outline-none focus-visible:ring-0">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-10">
            <Card className={cn('group/card relative overflow-hidden lg:col-span-2', GLASS_CARD)}>
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/25 to-transparent" aria-hidden />
              <CardHeader className="space-y-1 border-b border-white/25 pb-5 pt-6 dark:border-white/10">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/40 bg-white/50 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/10">
                    <FileText size={20} className="text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-lg font-semibold tracking-tight text-neutral-950">Raw script input</CardTitle>
                    <CardDescription className="text-sm leading-relaxed text-neutral-950">
                      Paste your script table (Fr, On Screen Visual, Script…), then run{' '}
                      <span className="font-medium">Parse Script</span> to create frames.
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

            <div className="flex flex-col gap-6 lg:col-span-1">
              <Card className={cn('overflow-hidden', GLASS_CARD)}>
                <CardHeader className="space-y-1 border-b border-white/25 pb-5 pt-6 dark:border-white/10">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/40 bg-white/50 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/10">
                      <Settings2 size={20} className="text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="text-lg font-semibold tracking-tight text-neutral-950">Global style</CardTitle>
                      <CardDescription className="text-sm leading-relaxed text-neutral-950">
                        Keep a consistent look across every frame in this project.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 p-5 sm:p-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-neutral-950">Style reference library</Label>
                    <Select value={styleRefId} onValueChange={setStyleRefId}>
                      <SelectTrigger className={cn('h-11 rounded-xl', GLASS_INPUT)}>
                        <SelectValue placeholder="Select a style…">
                          {(value) =>
                            globalStyleSelectLabel(
                              value as string | null | undefined,
                              availableStyles,
                            )}
                        </SelectValue>
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
                    <Label className="text-xs font-medium text-neutral-950">Manual style prompt</Label>
                    <Textarea
                      placeholder="e.g. cinematic 3D illustration, vibrant colors, detailed textures, soft lighting…"
                      className={cn(
                        'min-h-[200px] resize-y rounded-xl p-4 text-sm leading-relaxed transition-[box-shadow,border-color]',
                        'focus-visible:border-violet-400/50 focus-visible:ring-2 focus-visible:ring-violet-400/25',
                        GLASS_INPUT,
                      )}
                      value={stylePrompt}
                      onChange={(e) => setStylePrompt(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 text-neutral-950 shadow-[0_8px_32px_rgba(31,38,135,0.07)] backdrop-blur-xl dark:border-white/10 dark:bg-violet-950/40 dark:text-white">
                <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-400/30 blur-3xl dark:bg-violet-500/20" aria-hidden />
                <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-amber-300/20 blur-2xl dark:bg-amber-400/10" aria-hidden />
                <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-950 dark:text-violet-200/90">
                  <Sparkles size={14} className="text-neutral-950 dark:text-amber-300" />
                  Pro tip
                </p>
                <p className="text-sm leading-relaxed text-neutral-950 dark:text-slate-300">
                  Try phrases like <span className="font-medium">&quot;vibrant colors&quot;</span>,{' '}
                  <span className="font-medium">&quot;cinematic lighting&quot;</span>, or{' '}
                  <span className="font-medium">&quot;watercolor&quot;</span> to keep frames visually aligned.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
        </section>
      </Tabs>
    </div>
  );
}

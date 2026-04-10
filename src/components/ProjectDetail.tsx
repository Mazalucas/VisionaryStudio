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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FrameGrid } from './FrameGrid';
import { ArrowLeft, Upload, Sparkles, Settings2, Save, FileText, LayoutGrid, Loader2 } from 'lucide-react';
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

  return (
    <div className="flex flex-col min-h-full">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-gray-100 rounded-full">
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-gray-900">{project.name}</h2>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-widest mt-1">Production Studio</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleSaveSettings} className="h-11 px-5 border-gray-200 shadow-sm hover:bg-gray-50">
              <Save className="mr-2 h-4 w-4" /> Save Settings
            </Button>
            <Button onClick={handleParseScript} disabled={isParsing} className="h-11 px-6 shadow-md bg-black hover:bg-gray-800 text-white">
              {isParsing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <><Sparkles className="mr-2 h-4 w-4" /> Parse Script</>}
            </Button>
          </div>
        </div>

        {/* Tab Bar Section - Full Width Row */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b border-gray-200">
            <TabsList className="w-full justify-start bg-transparent h-auto p-0 rounded-none gap-12">
              <TabsTrigger 
                value="frames" 
                className="px-0 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:bg-transparent data-[state=active]:shadow-none font-bold text-xs uppercase tracking-[0.2em] text-gray-400 data-[state=active]:text-black transition-all"
              >
                <LayoutGrid className="mr-2 h-4 w-4" /> Frames
              </TabsTrigger>
              <TabsTrigger 
                value="script" 
                className="px-0 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:bg-transparent data-[state=active]:shadow-none font-bold text-xs uppercase tracking-[0.2em] text-gray-400 data-[state=active]:text-black transition-all"
              >
                <FileText className="mr-2 h-4 w-4" /> Script & Style
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Content Section - Separated with significant vertical space */}
          <div className="mt-12">
            <TabsContent value="frames" className="mt-0 outline-none focus-visible:ring-0">
              <FrameGrid 
                projectId={projectId} 
                globalStyle={stylePrompt} 
                styleReferenceId={styleRefId} 
                availableStyles={availableStyles}
              />
            </TabsContent>

            <TabsContent value="script" className="mt-0 outline-none focus-visible:ring-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <Card className="border-gray-200 lg:col-span-2 shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="pb-6 border-b border-gray-50 bg-gray-50/30">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100">
                        <FileText size={20} className="text-gray-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold">Raw Script Input</CardTitle>
                        <CardDescription>Paste your script table here (Fr, On Screen Visual, Script...)</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <Textarea 
                      placeholder="Paste script table here..." 
                      className="min-h-[600px] font-mono text-sm bg-white border-gray-200 focus:ring-1 focus:ring-black transition-all resize-none p-6 leading-relaxed"
                      value={scriptInput}
                      onChange={(e) => setScriptInput(e.target.value)}
                    />
                  </CardContent>
                </Card>

                <div className="lg:col-span-1 space-y-8">
                  <Card className="border-gray-200 shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="pb-6 border-b border-gray-50 bg-gray-50/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100">
                          <Settings2 size={20} className="text-gray-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-bold">Global Style</CardTitle>
                          <CardDescription>Visual consistency settings</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-8">
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">Style Reference Library</Label>
                        <Select value={styleRefId} onValueChange={setStyleRefId}>
                          <SelectTrigger className="h-12 border-gray-200 rounded-xl">
                            <SelectValue placeholder="Select a style..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="none">None (Manual Prompt Only)</SelectItem>
                            {availableStyles.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">Manual Style Prompt</Label>
                        <Textarea 
                          placeholder="Describe the overall aesthetic..." 
                          className="min-h-[220px] bg-white border-gray-200 rounded-xl focus:ring-1 focus:ring-black transition-all p-4"
                          value={stylePrompt}
                          onChange={(e) => setStylePrompt(e.target.value)}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <div className="p-6 bg-gray-900 text-white rounded-2xl shadow-lg relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all" />
                    <p className="font-bold mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-gray-400">
                      <Sparkles size={14} className="text-yellow-400" /> Pro Tip
                    </p>
                    <p className="text-xs leading-relaxed text-gray-300">
                      Use keywords like <span className="text-white font-medium">"vibrant colors"</span>, <span className="text-white font-medium">"cinematic lighting"</span>, or <span className="text-white font-medium">"watercolor"</span> to maintain the look across frames.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

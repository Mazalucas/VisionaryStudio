import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ArrowRight, Calendar, Globe, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Project {
  id: string;
  name: string;
  createdAt: any;
  globalStylePrompt?: string;
  status?: 'Empty' | 'On-going' | 'Completed' | 'Finalized';
}

interface ProjectListProps {
  onSelectProject: (id: string) => void;
}

export function ProjectList({ onSelectProject }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      setProjects(projs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });
    return () => unsubscribe();
  }, []);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setIsCreatingProject(true);
    try {
      await addDoc(collection(db, 'projects'), {
        name: newProjectName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        globalStylePrompt: "Simple illustration, low detail, educational style.",
        status: 'Empty'
      });
      setNewProjectName('');
      setIsNewProjectOpen(false);
      toast.success('Project created');
    } catch (error) {
      toast.error('Failed to create project');
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleStatusChange = async (e: React.MouseEvent, id: string, status: string) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'projects', id), { status, updatedAt: serverTimestamp() });
      toast.success(`Status updated to ${status}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Empty': return 'bg-neutral-100 text-neutral-500 border-neutral-200';
      case 'On-going': return 'bg-sky-50 text-sky-600 border-sky-100';
      case 'Completed': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'Finalized': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-neutral-100 text-neutral-500 border-neutral-200';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-neutral-950">Production Projects</h2>
          <p className="text-neutral-950/70 mt-2 text-lg">Manage your video episodes and background generations.</p>
        </div>
        
        <Dialog open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen}>
          <DialogTrigger asChild>
            <Button className="h-12 px-6 rounded-xl bg-neutral-950 text-white hover:bg-neutral-800 shadow-xl transition-all">
              <Plus className="mr-2 h-5 w-5" /> New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl border-white/40 bg-white/80 backdrop-blur-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Create New Project</DialogTitle>
              <DialogDescription>
                Enter the name of the country or episode you are working on.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold uppercase tracking-wider text-neutral-950/60">Project Name</Label>
                <Input 
                  id="name" 
                  placeholder="e.g. Argentina - Episode 01" 
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="h-12 rounded-xl border-neutral-200/60 bg-white/50 focus:ring-violet-400/20"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsNewProjectOpen(false)} disabled={isCreatingProject} className="rounded-xl">
                Cancel
              </Button>
              <Button
                onClick={handleCreateProject}
                disabled={isCreatingProject}
                className="min-w-[10rem] h-12 rounded-xl bg-violet-600 text-white hover:bg-violet-700 shadow-lg shadow-violet-500/20"
              >
                {isCreatingProject ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  'Create Project'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/45 bg-white/35 shadow-[0_8px_32px_rgba(31,38,135,0.06)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]">
        <div className="min-w-full inline-block align-middle">
          <div className="border-b border-neutral-200/50 bg-white/20 px-6 py-4">
            <div className="grid grid-cols-12 gap-4 text-xs font-bold uppercase tracking-[0.2em] text-neutral-950/40">
              <div className="col-span-5">Project Name</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-3 text-center">Created</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
          </div>
          
          <div className="divide-y divide-neutral-200/40">
            {projects.map((project) => (
              <div 
                key={project.id} 
                className="grid grid-cols-12 gap-4 items-center px-6 py-5 hover:bg-white/40 transition-all cursor-pointer group"
                onClick={() => onSelectProject(project.id)}
              >
                <div className="col-span-5 flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/40 bg-white/50 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/10 text-neutral-950">
                    <Globe size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-neutral-950 truncate group-hover:text-violet-600 transition-colors">{project.name}</h3>
                    <p className="text-xs text-neutral-950/50 truncate max-w-[300px] mt-0.5">{project.globalStylePrompt}</p>
                  </div>
                </div>

                <div className="col-span-2">
                  <Select 
                    value={project.status || 'Empty'} 
                    onValueChange={(v) => handleStatusChange({ stopPropagation: () => {} } as any, project.id, v)}
                  >
                    <SelectTrigger 
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "h-8 rounded-full border px-3 text-[11px] font-bold uppercase tracking-wider transition-all",
                        getStatusColor(project.status || 'Empty')
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-white/40 bg-white/90 backdrop-blur-xl">
                      <SelectItem value="Empty">Empty</SelectItem>
                      <SelectItem value="On-going">On-going</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Finalized">Finalized</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-3 text-center">
                  <div className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-950/60">
                    <Calendar size={14} className="opacity-70" />
                    {project.createdAt?.toDate().toLocaleDateString() || 'Just now'}
                  </div>
                </div>

                <div className="col-span-2 flex justify-end items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-9 w-9 rounded-full text-neutral-950/40 hover:bg-red-50 hover:text-red-500 transition-all"
                    disabled={deletingProjectId === project.id}
                    onClick={(e) => handleDeleteProject(e, project.id)}
                  >
                    {deletingProjectId === project.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </Button>
                  <div className="h-4 w-px bg-neutral-200/50 mx-1" />
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-9 w-9 rounded-full text-neutral-950/60 hover:bg-neutral-100 hover:translate-x-0.5 transition-all"
                  >
                    <ArrowRight size={18} />
                  </Button>
                </div>
              </div>
            ))}

            {projects.length === 0 && (
              <div className="py-24 text-center">
                <div className="mx-auto w-16 h-16 bg-neutral-100 rounded-3xl flex items-center justify-center text-neutral-400 mb-6 shadow-inner">
                  <Globe size={32} />
                </div>
                <h3 className="text-xl font-bold text-neutral-950">No projects yet</h3>
                <p className="text-neutral-950/60 mt-2">Create your first project to start generating backgrounds.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

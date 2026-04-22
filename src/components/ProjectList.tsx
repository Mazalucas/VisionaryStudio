import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, where, limit, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ArrowRight, Calendar, Globe, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { logActivity } from '@/lib/activityLogger';
import { Lock, Unlock, ChevronUp, ChevronDown, Archive, ShieldCheck, Search, Clock, User, FileText } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  createdAt: any;
  globalStylePrompt?: string;
  status?: 'Empty' | 'On-going' | 'Completed' | 'Finalized';
  isArchived?: boolean;
  totalFrames?: number;
  generatedFrames?: number;
}

interface ProjectListProps {
  onSelectProject: (id: string) => void;
}

export function ProjectList({ onSelectProject }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [archivingProjectId, setArchivingProjectId] = useState<string | null>(null);

  // Activity Log State
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'status' | 'createdAt', direction: 'asc' | 'desc' }>({
    key: 'createdAt',
    direction: 'desc'
  });

  useEffect(() => {
    const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      setProjects(projs);

      // Self-healing: if totalFrames is missing, calculate it once
      projs.forEach(async (p) => {
        if (p.totalFrames === undefined && !p.isArchived) {
          try {
            const framesSnap = await getDocs(collection(db, 'projects', p.id, 'frames'));
            const total = framesSnap.size;
            const generated = framesSnap.docs.filter(d => d.data().status === 'generated').length;
            await updateDoc(doc(db, 'projects', p.id), {
              totalFrames: total,
              generatedFrames: generated
            });
          } catch (e) {
            console.error("Failed to self-heal project counts:", e);
          }
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });
    return () => unsubscribe();
  }, []);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setIsCreatingProject(true);
    try {
      const docRef = await addDoc(collection(db, 'projects'), {
        name: newProjectName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        globalStylePrompt: "Simple illustration, low detail, educational style.",
        status: 'Empty',
        totalFrames: 0,
        generatedFrames: 0
      });
      logActivity('Create Project', `Created project "${newProjectName}".`, docRef.id, newProjectName);
      setNewProjectName('');
      setIsNewProjectOpen(false);
      toast.success('Project created');
    } catch (error) {
      toast.error('Failed to create project');
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleArchiveProject = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to archive "${project.name}"?`)) return;
    setArchivingProjectId(project.id);
    try {
      await updateDoc(doc(db, 'projects', project.id), { 
        isArchived: true,
        updatedAt: serverTimestamp()
      });
      logActivity('Archive Project', `Archived project "${project.name}".`, project.id, project.name);
      toast.success('Project archived');
    } catch (error) {
      toast.error('Failed to archive project');
    } finally {
      setArchivingProjectId(null);
    }
  };

  const handleUnlockLogs = () => {
    if (password === 'permiso') {
      setIsUnlocked(true);
      fetchActivityLogs();
    } else {
      toast.error('Incorrect password');
    }
  };

  const fetchActivityLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(50));
      const snap = await getDocs(q);
      setActivityLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      toast.error('Failed to fetch activity logs');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const toggleSort = (key: 'name' | 'status' | 'createdAt') => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedProjects = [...projects]
    .filter(p => !p.isArchived)
    .sort((a, b) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      if (sortConfig.key === 'createdAt') {
        const dateA = a.createdAt?.toDate?.() || 0;
        const dateB = b.createdAt?.toDate?.() || 0;
        return (dateA - dateB) * dir;
      }
      const valA = (a[sortConfig.key] || '').toString().toLowerCase();
      const valB = (b[sortConfig.key] || '').toString().toLowerCase();
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return 0;
    });

  const handleStatusChange = async (e: React.MouseEvent, id: string, status: string, projectName: string) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'projects', id), { status, updatedAt: serverTimestamp() });
      logActivity('Update Status', `Changed status to "${status}".`, id, projectName);
      toast.success(`Status updated to ${status}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Empty': return 'bg-neutral-100 text-neutral-500 border-neutral-200';
      case 'On-going': return 'bg-sky-50 text-sky-600 border-sky-100';
      case 'Completed': return 'bg-amber-50 text-amber-600 border-amber-100';
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
        
        <div className="flex items-center gap-3">
          <Dialog open={isLogOpen} onOpenChange={(open) => {
            setIsLogOpen(open);
            if (!open) {
              setIsUnlocked(false);
              setPassword('');
            }
          }}>
            <DialogTrigger render={
              <Button variant="ghost" size="icon" className="h-12 w-12 rounded-xl text-neutral-950/40 hover:text-neutral-950 transition-all border border-neutral-200">
                {isUnlocked ? <Unlock size={20} /> : <Lock size={20} />}
              </Button>
            } />
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col rounded-2xl bg-white/95 backdrop-blur-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-2xl">
                  <ShieldCheck className="text-violet-600" /> Activity Registry
                </DialogTitle>
                <DialogDescription>
                  Audit trail of project actions and generation activity.
                </DialogDescription>
              </DialogHeader>
              
              {!isUnlocked ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-6">
                  <div className="p-4 rounded-full bg-neutral-100 text-neutral-400">
                    <Lock size={48} />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-bold">Registry Locked</h3>
                    <p className="text-sm text-neutral-500">Please enter the moderator password to access the logs.</p>
                  </div>
                  <div className="flex gap-2 w-full max-w-xs">
                    <Input 
                      type="password" 
                      placeholder="Password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUnlockLogs()}
                      className="rounded-xl h-11"
                    />
                    <Button onClick={handleUnlockLogs} className="h-11 rounded-xl bg-violet-600">Access</Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto mt-4 pr-2 custom-scrollbar">
                  {isLoadingLogs ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="animate-spin text-violet-600" size={32} />
                    </div>
                  ) : activityLogs.length === 0 ? (
                    <div className="text-center py-20 text-neutral-400">No activity recorded yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {activityLogs.map((log) => (
                        <div key={log.id} className="p-4 rounded-xl border border-neutral-100 bg-neutral-50/50 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center">
                                <User size={14} />
                              </div>
                              <span className="text-sm font-bold text-neutral-900">{log.userName}</span>
                              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-violet-600 text-white tracking-widest">{log.action}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                              <Clock size={12} />
                              {log.timestamp?.toDate().toLocaleString() || 'Recent'}
                            </div>
                          </div>
                          <div className="pl-9 text-sm text-neutral-600">
                            {log.details}
                            {log.projectName && (
                              <div className="mt-1 flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Project:</span>
                                <span className="text-[10px] font-bold text-violet-600 px-2 py-0.5 rounded bg-violet-50 border border-violet-100">{log.projectName}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>

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
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/45 bg-white/35 shadow-[0_8px_32px_rgba(31,38,135,0.06)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]">
        <div className="min-w-full inline-block align-middle">
          <div className="border-b border-neutral-200/50 bg-white/20 px-6 py-4">
            <div className="grid grid-cols-12 gap-4 text-xs font-bold uppercase tracking-[0.2em] text-neutral-950/40">
              <div 
                className="col-span-5 flex items-center gap-1 cursor-pointer hover:text-neutral-950 transition-colors"
                onClick={() => toggleSort('name')}
              >
                Project Name {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
              </div>
              <div 
                className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-neutral-950 transition-colors"
                onClick={() => toggleSort('status')}
              >
                Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
              </div>
              <div className="col-span-2 text-center">Frames</div>
              <div className="col-span-1 text-center">Created</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
          </div>
          
          <div className="divide-y divide-neutral-200/40">
            {sortedProjects.map((project) => (
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

                <div className="col-span-2" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                    <Select 
                      value={project.status || 'Empty'} 
                      onValueChange={(v) => handleStatusChange({ stopPropagation: () => {} } as any, project.id, v, project.name)}
                    >
                    <SelectTrigger 
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

                <div className="col-span-2 text-center">
                  <div className="inline-flex flex-col items-center">
                    <span className="text-sm font-bold text-neutral-950">{project.generatedFrames || 0} / {project.totalFrames || 0}</span>
                    <div className="w-16 h-1 bg-neutral-100 rounded-full mt-1.5 overflow-hidden">
                      <div 
                        className="h-full bg-violet-500 transition-all" 
                        style={{ width: `${Math.min(100, (project.generatedFrames || 0) / (project.totalFrames || 1) * 100)}%` }} 
                      />
                    </div>
                  </div>
                </div>

                <div className="col-span-1 text-center">
                  <div className="inline-flex flex-col text-center text-[11px] font-medium text-neutral-950/60 leading-tight">
                    <span>{project.createdAt?.toDate().toLocaleDateString() || 'Just now'}</span>
                  </div>
                </div>

                <div className="col-span-2 flex justify-end items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-9 w-9 rounded-full text-neutral-950/40 hover:bg-amber-50 hover:text-amber-600 transition-all"
                    disabled={archivingProjectId === project.id}
                    onClick={(e) => handleArchiveProject(e, project)}
                  >
                    {archivingProjectId === project.id ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}
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

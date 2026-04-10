import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ArrowRight, Calendar, Globe } from 'lucide-react';
import { toast } from 'sonner';

interface Project {
  id: string;
  name: string;
  createdAt: any;
  globalStylePrompt?: string;
}

interface ProjectListProps {
  onSelectProject: (id: string) => void;
}

export function ProjectList({ onSelectProject }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

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
    try {
      await addDoc(collection(db, 'projects'), {
        name: newProjectName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        globalStylePrompt: "Cinematic 3D illustration, vibrant colors, detailed textures, soft lighting, educational style."
      });
      setNewProjectName('');
      setIsNewProjectOpen(false);
      toast.success('Project created');
    } catch (error) {
      toast.error('Failed to create project');
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await deleteDoc(doc(db, 'projects', id));
      toast.success('Project deleted');
    } catch (error) {
      toast.error('Failed to delete project');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Production Projects</h2>
          <p className="text-gray-500 mt-1">Manage your video episodes and background generations.</p>
        </div>
        
        <Dialog open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen}>
          <DialogTrigger render={
            <Button className="h-11 px-6">
              <Plus className="mr-2 h-5 w-5" /> New Project
            </Button>
          } />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Enter the name of the country or episode you are working on.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name</Label>
                <Input 
                  id="name" 
                  placeholder="e.g. Argentina - Episode 01" 
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewProjectOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateProject} className="bg-black hover:bg-gray-800">Create Project</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <Card 
            key={project.id} 
            className="group hover:shadow-lg transition-all cursor-pointer border-gray-200 overflow-hidden"
            onClick={() => onSelectProject(project.id)}
          >
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-black group-hover:text-white transition-colors">
                  <Globe size={20} />
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-gray-400 hover:text-red-600 h-8 w-8"
                  onClick={(e) => handleDeleteProject(e, project.id)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
              <CardTitle className="mt-4 text-xl font-bold">{project.name}</CardTitle>
              <CardDescription className="flex items-center mt-1">
                <Calendar size={14} className="mr-1" />
                {project.createdAt?.toDate().toLocaleDateString() || 'Just now'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 line-clamp-2 italic">
                {project.globalStylePrompt || 'No style prompt set.'}
              </p>
            </CardContent>
            <CardFooter className="bg-gray-50 py-3 flex justify-between items-center group-hover:bg-gray-100 transition-colors">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Open Studio</span>
              <ArrowRight size={16} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
            </CardFooter>
          </Card>
        ))}

        {projects.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-gray-200 rounded-2xl">
            <div className="mx-auto w-12 h-12 text-gray-300 mb-4">
              <Globe size={48} />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No projects yet</h3>
            <p className="text-gray-500">Create your first project to start generating backgrounds.</p>
          </div>
        )}
      </div>
    </div>
  );
}

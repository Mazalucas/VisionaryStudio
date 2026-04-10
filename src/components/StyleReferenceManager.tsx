import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, addDoc, deleteDoc, doc, serverTimestamp, getDocs, orderBy, writeBatch, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ExternalLink, Image as ImageIcon, Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

interface StyleRef {
  id: string;
  name: string;
  category?: string;
  description?: string;
  stylePrompt?: string;
  imageUrls: string[]; // We'll populate this from the subcollection
}

export function StyleReferenceManager() {
  const [refs, setRefs] = useState<StyleRef[]>([]);
  const [isNewRefOpen, setIsNewRefOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newImageUrls, setNewImageUrls] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [newStylePrompt, setNewStylePrompt] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'styleReferences'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data = await Promise.all(snapshot.docs.map(async (styleDoc) => {
        const styleData = styleDoc.data();
        // Fetch images from subcollection
        const imagesSnap = await getDocs(query(collection(db, 'styleReferences', styleDoc.id, 'images'), orderBy('createdAt', 'asc')));
        const imageUrls = imagesSnap.docs.map(d => d.data().url);
        
        return { 
          id: styleDoc.id, 
          ...styleData,
          imageUrls 
        } as StyleRef;
      }));
      setRefs(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'styleReferences');
    });
    return () => unsubscribe();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsUploading(true);
    const urls: string[] = [...newImageUrls];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Firestore limit is 1MB. Base64 is ~33% larger.
      // 750KB original file becomes ~1MB base64.
      if (file.size > 750 * 1024) { 
        toast.error(`File ${file.name} is too large (>750KB). Please use smaller images.`);
        continue;
      }

      const reader = new FileReader();
      const promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
      });
      reader.readAsDataURL(file);
      const base64 = await promise;
      
      urls.push(base64);
    }

    setNewImageUrls(urls);
    setIsUploading(false);
  };

  const [editingRef, setEditingRef] = useState<StyleRef | null>(null);

  const handleEditRef = (ref: StyleRef) => {
    setEditingRef(ref);
    setNewName(ref.name);
    setNewImageUrls(ref.imageUrls || []);
    setNewCategory(ref.category || '');
    setNewStylePrompt(ref.stylePrompt || '');
    setIsNewRefOpen(true);
  };

  const handleAddRef = async () => {
    if (!newName.trim() || newImageUrls.length === 0) {
      toast.error('Please provide a name and at least one image');
      return;
    }
    
    setIsUploading(true);
    try {
      if (editingRef) {
        // Update existing
        await updateDoc(doc(db, 'styleReferences', editingRef.id), {
          name: newName,
          category: newCategory,
          stylePrompt: newStylePrompt,
          updatedAt: serverTimestamp()
        });

        // Update images (simplest way: delete all and re-add)
        const imagesSnap = await getDocs(collection(db, 'styleReferences', editingRef.id, 'images'));
        const batch = writeBatch(db);
        imagesSnap.docs.forEach(d => batch.delete(d.ref));
        newImageUrls.forEach((url) => {
          const imgRef = doc(collection(db, 'styleReferences', editingRef.id, 'images'));
          batch.set(imgRef, { url, createdAt: serverTimestamp() });
        });
        await batch.commit();
        toast.success('Reference updated');
      } else {
        // Create new
        const styleRef = await addDoc(collection(db, 'styleReferences'), {
          name: newName,
          category: newCategory,
          stylePrompt: newStylePrompt,
          createdAt: serverTimestamp()
        });

        const batch = writeBatch(db);
        newImageUrls.forEach((url) => {
          const imgRef = doc(collection(db, 'styleReferences', styleRef.id, 'images'));
          batch.set(imgRef, { url, createdAt: serverTimestamp() });
        });
        await batch.commit();
        toast.success('Reference added to library');
      }

      setNewName('');
      setNewImageUrls([]);
      setNewCategory('');
      setNewStylePrompt('');
      setEditingRef(null);
      setIsNewRefOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'styleReferences');
      toast.error('Failed to save reference');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImageUrl = (index: number) => {
    setNewImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteRef = async (id: string) => {
    if (!confirm('Delete this reference?')) return;
    try {
      // 1. Get all images in subcollection
      const imagesSnap = await getDocs(collection(db, 'styleReferences', id, 'images'));
      
      // 2. Delete all images and the main doc in a batch
      const batch = writeBatch(db);
      imagesSnap.docs.forEach((d) => {
        batch.delete(d.ref);
      });
      batch.delete(doc(db, 'styleReferences', id));
      
      await batch.commit();
      toast.success('Reference deleted');
    } catch (error) {
      toast.error('Failed to delete reference');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Style Library</h2>
          <p className="text-gray-500 mt-1">Maintain visual consistency by referencing your existing aesthetic.</p>
        </div>
        
        <Dialog open={isNewRefOpen} onOpenChange={setIsNewRefOpen}>
          <DialogTrigger render={
            <Button className="h-11 px-6">
              <Plus className="mr-2 h-5 w-5" /> Add Reference
            </Button>
          } />
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingRef ? 'Edit Style Reference' : 'Add Style Reference'}</DialogTitle>
              <DialogDescription>
                {editingRef ? 'Update the images and prompt for this style.' : 'Upload one or more images and provide a prompt to define this style.'}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto px-1">
              <div className="space-y-2">
                <Label htmlFor="ref-name">Style Name</Label>
                <Input id="ref-name" placeholder="e.g. Argentina Landscape Style" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              
              <div className="space-y-2">
                <Label>Reference Images</Label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {newImageUrls.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-md overflow-hidden border border-gray-200 group">
                      <img src={url} className="w-full h-full object-cover" alt="preview" />
                      <button 
                        onClick={() => removeImageUrl(i)}
                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
                    <Plus size={24} className="text-gray-400" />
                    <span className="text-[10px] text-gray-400 mt-1">Upload</span>
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} disabled={isUploading} />
                  </label>
                </div>
                {isUploading && <p className="text-xs text-blue-500 animate-pulse">Processing images...</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ref-prompt">Style Prompt / Instructions</Label>
                <textarea 
                  id="ref-prompt" 
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Describe the aesthetic details (lighting, colors, textures)..." 
                  value={newStylePrompt} 
                  onChange={(e) => setNewStylePrompt(e.target.value)} 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ref-cat">Category (Optional)</Label>
                <Input id="ref-cat" placeholder="e.g. Landscape, Food, City" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsNewRefOpen(false);
                setEditingRef(null);
                setNewName('');
                setNewImageUrls([]);
                setNewCategory('');
                setNewStylePrompt('');
              }}>Cancel</Button>
              <Button onClick={handleAddRef} disabled={isUploading}>
                {isUploading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                {editingRef ? 'Update Reference' : 'Add to Library'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {refs.map((ref) => (
          <Card key={ref.id} className="overflow-hidden group border-gray-200 flex flex-col">
            <div className="aspect-square relative bg-gray-100">
              <img 
                src={ref.imageUrls?.[0] || 'https://picsum.photos/seed/placeholder/400/400'} 
                alt={ref.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              {ref.imageUrls && ref.imageUrls.length > 1 && (
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  +{ref.imageUrls.length - 1} images
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button size="icon" variant="secondary" className="rounded-full" onClick={() => handleEditRef(ref)}>
                  <Settings2 size={16} />
                </Button>
                <Button size="icon" variant="secondary" className="rounded-full" onClick={() => window.open(ref.imageUrls?.[0], '_blank')}>
                  <ExternalLink size={16} />
                </Button>
                <Button size="icon" variant="destructive" className="rounded-full" onClick={() => handleDeleteRef(ref.id)}>
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
            <CardHeader className="p-4 space-y-1 flex-1">
              <div className="flex justify-between items-start">
                <CardTitle className="text-sm font-bold truncate flex-1">{ref.name}</CardTitle>
              </div>
              {ref.category && (
                <Badge variant="secondary" className="text-[10px] uppercase font-bold px-1.5 py-0">
                  {ref.category}
                </Badge>
              )}
              {ref.stylePrompt && (
                <p className="text-[11px] text-gray-500 line-clamp-2 mt-2 italic">
                  "{ref.stylePrompt}"
                </p>
              )}
            </CardHeader>
          </Card>
        ))}

        {refs.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-gray-200 rounded-2xl">
            <div className="mx-auto w-12 h-12 text-gray-300 mb-4">
              <ImageIcon size={48} />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No references yet</h3>
            <p className="text-gray-500">Add images to help the AI understand your aesthetic.</p>
          </div>
        )}
      </div>
    </div>
  );
}

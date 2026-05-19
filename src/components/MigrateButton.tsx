import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { db } from '../firebase';
import { collection, getDocs, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';

const TARGET_COUNTRIES = [
  'algeria', 'austria', 'côte d’ivoire', 'croatia', 'curaçao', 'ecuador', 
  'ghana', 'haiti', 'iran', 'jordan', 'korea republic', 'morocco', 
  'netherlands', 'new zealand', 'norway', 'qatar', 'switzerland', 
  'tunisia', 'uzbekistan'
];

export function MigrateButton() {
  const [isMigrating, setIsMigrating] = useState(false);

  const isTarget = (name: string) => {
    const lowerName = name.toLowerCase();
    return TARGET_COUNTRIES.some(country => lowerName.includes(country));
  };

  const handleMigrate = async () => {
    if (!confirm('Are you sure you want to run the migration again? This will archive empty projects for the SPECIFIC target countries and recreate them.')) return;
    setIsMigrating(true);
    toast.info('Starting migration and style mapping...');

    try {
      // 0. Fetch style references mapping
      const stylesSnap = await getDocs(collection(db, 'styleReferences'));
      const styleMap = new Map<string, string>();
      stylesSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.name) {
          styleMap.set(data.name.toLowerCase().trim(), docSnap.id);
        }
      });

      // 1. Archive empty projects that ARE in the target list
      const projectsSnap = await getDocs(collection(db, 'projects'));
      let archivedCount = 0;

      for (const projectDoc of projectsSnap.docs) {
        const data = projectDoc.data();
        if (data.isArchived) continue;

        // ONLY process if it IS a target country
        if (!isTarget(data.name)) continue;

        // Check if it has 0 generated images
        let hasGeneratedImages = data.generatedFrames > 0;
        
        if (!hasGeneratedImages) {
          const framesSnap = await getDocs(collection(db, 'projects', projectDoc.id, 'frames'));
          const generatedCount = framesSnap.docs.filter(f => f.data().status === 'generated').length;
          hasGeneratedImages = generatedCount > 0;
        }

        if (!hasGeneratedImages) {
          await updateDoc(doc(db, 'projects', projectDoc.id), {
            isArchived: true,
            updatedAt: serverTimestamp()
          });
          archivedCount++;
        }
      }
      toast.success(`Archived ${archivedCount} target projects.`);

      // 2. Create new projects and insert scripts for TARGET countries only
      const res = await fetch('/scripts/index.json');
      const files: string[] = await res.json();
      let createdCount = 0;

      for (const file of files) {
        let countryName = file.replace(/^SCRIPT_/, '').replace(/_v\d+\.json$/, '').replace(/_\d+\.json$/, '').replace(/_SCRIPT_v\d+\.json$/, '').replace(/\.json$/, '');
        countryName = countryName.replace(/_/g, ' ');
        // For files like "HAITI_SCRIPT_v2", the above regex fixes it. Let's make sure:
        if (file.includes('HAITI')) countryName = 'Haiti';
        else countryName = countryName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

        if (!isTarget(countryName)) continue;

        const scriptRes = await fetch(`/scripts/${file}`);
        const framesData = await scriptRes.json();

        const projectRef = await addDoc(collection(db, 'projects'), {
          name: `${countryName}`,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          globalStylePrompt: "Simple illustration, low detail, educational style.",
          status: 'Empty',
          totalFrames: framesData.length,
          generatedFrames: 0
        });

        for (const frame of framesData) {
          const category = frame.style || 'Objects, instruments, things';
          const normalizedCat = category.toLowerCase().trim();
          let matchedStyleId = styleMap.get(normalizedCat);

          if (!matchedStyleId) {
            // Fuzzy match to fix mismatched tags like "Objects" vs "Objects, instruments, things"
            for (const [dbName, dbId] of styleMap.entries()) {
              if (normalizedCat.includes(dbName) || dbName.includes(normalizedCat)) {
                matchedStyleId = dbId;
                break;
              }
              if (normalizedCat.includes('objects') && dbName.includes('objects')) {
                matchedStyleId = dbId;
                break;
              }
            }
          }

          const frameData: any = {
            projectId: projectRef.id,
            frameNumber: frame.frame,
            originalDescription: frame.visuals,
            narratedText: frame.script,
            visualIntent: frame.visuals,
            category: category,
            status: 'pending'
          };

          if (matchedStyleId) {
            frameData.localStyleReferenceId = matchedStyleId;
          }

          await addDoc(collection(db, 'projects', projectRef.id, 'frames'), frameData);
        }
        createdCount++;
      }

      toast.success(`Created ${createdCount} new projects with styles assigned.`);
    } catch (e) {
      console.error(e);
      toast.error('Migration failed: ' + String(e));
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <Button 
      onClick={handleMigrate} 
      disabled={isMigrating}
      className="fixed bottom-4 right-4 z-50 bg-purple-600 hover:bg-purple-700 text-white shadow-xl"
    >
      {isMigrating ? 'Migrating...' : 'Run Specific Update'}
    </Button>
  );
}

import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Layout } from './components/Layout';
import { ProjectList } from './components/ProjectList';
import { ProjectDetail } from './components/ProjectDetail';
import { StyleReferenceManager } from './components/StyleReferenceManager';
import { ApiKeysSettings } from './components/ApiKeysSettings';
import { LogIn, LayoutDashboard, Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [view, setView] = useState<'projects' | 'project-detail' | 'styles' | 'api-keys'>('projects');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Logged in successfully');
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === 'auth/popup-closed-by-user') {
        toast.info('Login cancelled');
      } else if (err.code === 'auth/unauthorized-domain') {
        console.error(error);
        toast.error(
          'This domain is not allowed for sign-in. In Firebase Console: Authentication → Settings → Authorized domains → Add domain: localhost',
          { duration: 12000 },
        );
      } else if (err.code === 'auth/operation-not-allowed') {
        console.error(error);
        toast.error(
          'Google sign-in is disabled for this Firebase project. Open Firebase Console → Authentication → Sign-in method → enable Google.',
          { duration: 14000 },
        );
      } else {
        console.error(error);
        toast.error('Failed to login: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f5f5f5]">
        <div className="animate-pulse text-xl font-medium text-neutral-950">Loading Visionary Studio...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#f5f5f5] p-4">
        <Card className="w-full max-w-md border-none shadow-xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-black rounded-2xl flex items-center justify-center text-white">
              <LayoutDashboard size={32} />
            </div>
            <div>
              <CardTitle className="text-3xl font-bold tracking-tight">Visionary Studio</CardTitle>
              <CardDescription className="text-neutral-950 mt-2">
                AI-Assisted Background Production for Educational Videos
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4">
            <Button
              onClick={handleLogin}
              disabled={isLoggingIn}
              aria-busy={isLoggingIn}
              className="w-full h-12 text-lg font-medium transition-all"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
                  Signing in…
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-5 w-5" aria-hidden /> Sign in with Google
                </>
              )}
            </Button>
            <p className="text-xs text-center text-neutral-950">
              Secure access to your production projects and assets.
            </p>
            {import.meta.env.DEV && (
              <p className="text-xs text-center text-amber-800/90 bg-amber-50 border border-amber-200/80 rounded-md px-3 py-2">
                Local dev: Firebase must allow this origin. Add{' '}
                <span className="font-mono">localhost</span> under Authentication → Settings → Authorized
                domains (same project as in firebase-applet-config.json).
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Layout user={user} currentView={view} setView={setView}>
      {view === 'projects' && (
        <ProjectList 
          onSelectProject={(id) => {
            setSelectedProjectId(id);
            setView('project-detail');
          }} 
        />
      )}
      {view === 'project-detail' && selectedProjectId && (
        <ProjectDetail 
          projectId={selectedProjectId} 
          onBack={() => setView('projects')} 
        />
      )}
      {view === 'styles' && (
        <StyleReferenceManager />
      )}
      {view === 'api-keys' && (
        <ApiKeysSettings />
      )}
      <Toaster />
    </Layout>
  );
}

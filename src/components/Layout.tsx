import React from 'react';
import { auth } from '../firebase';
import { User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LayoutDashboard, Image as ImageIcon, KeyRound, LogOut, Activity } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { AppView } from '../App';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  currentView: AppView;
  setView: (view: AppView) => void;
}

export function Layout({ children, user, currentView, setView }: LayoutProps) {
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background flex text-foreground">
        {/* Sidebar */}
        <aside className="w-64 bg-card border-r border-border flex flex-col fixed h-full transition-colors duration-300">
          <div className="p-6 border-bottom">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-primary text-primary-foreground rounded-xl flex items-center justify-center">
                <LayoutDashboard size={20} />
              </div>
              <h1 className="font-bold text-xl tracking-tight text-foreground">Visionary</h1>
            </div>
            
            <nav className="space-y-1">
              <Button 
                variant={currentView === 'projects' || currentView === 'project-detail' ? 'secondary' : 'ghost'} 
                className="w-full justify-start h-11 font-medium"
                onClick={() => setView('projects')}
              >
                <LayoutDashboard className="mr-3 h-5 w-5" /> Projects
              </Button>
              <Button 
                variant={currentView === 'styles' ? 'secondary' : 'ghost'} 
                className="w-full justify-start h-11 font-medium"
                onClick={() => setView('styles')}
              >
                <ImageIcon className="mr-3 h-5 w-5" /> Style Library
              </Button>
              <Button 
                variant={currentView === 'api-keys' ? 'secondary' : 'ghost'} 
                className="w-full justify-start h-11 font-medium"
                onClick={() => setView('api-keys')}
              >
                <KeyRound className="mr-3 h-5 w-5" /> API Keys
              </Button>
              <Button 
                variant={currentView === 'activity' ? 'secondary' : 'ghost'} 
                className="w-full justify-start h-11 font-medium"
                onClick={() => setView('activity')}
              >
                <Activity className="mr-3 h-5 w-5" /> Activity Log
              </Button>
            </nav>
          </div>
          
          <div className="mt-auto p-6 border-t border-border">
            <div className="flex items-center justify-between mb-6 px-2">
              <div className="flex items-center gap-3 overflow-hidden">
                <img 
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                  alt={user.displayName || 'User'} 
                  className="w-8 h-8 rounded-full shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-foreground">{user.displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>
              <ThemeToggle />
            </div>
            <Button 
              variant="ghost" 
              className="w-full justify-start h-11 text-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => auth.signOut()}
            >
              <LogOut className="mr-3 h-5 w-5" /> Sign Out
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="ml-64 flex w-[calc(100%-16rem)] flex-1 bg-background p-8 transition-colors duration-300">
          <div className="w-full">
            {children}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}


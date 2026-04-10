import React from 'react';
import { User } from 'firebase/auth';
import { auth } from '../firebase';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Image as ImageIcon, KeyRound, LogOut } from 'lucide-react';

import { TooltipProvider } from '@/components/ui/tooltip';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  currentView: 'projects' | 'project-detail' | 'styles' | 'api-keys';
  setView: (view: 'projects' | 'project-detail' | 'styles' | 'api-keys') => void;
}

export function Layout({ children, user, currentView, setView }: LayoutProps) {
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[#f8f8f8] flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full">
          <div className="p-6 border-bottom">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white">
                <LayoutDashboard size={20} />
              </div>
              <h1 className="font-bold text-xl tracking-tight">Visionary</h1>
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
            </nav>
          </div>
          
          <div className="mt-auto p-6 border-t border-gray-100">
            <div className="flex items-center gap-3 mb-6 px-2">
              <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                alt={user.displayName || 'User'} 
                className="w-8 h-8 rounded-full"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{user.displayName}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              className="w-full justify-start h-11 text-gray-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => auth.signOut()}
            >
              <LogOut className="mr-3 h-5 w-5" /> Sign Out
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 ml-64 p-8 w-[calc(100%-16rem)]">
          <div className="w-full">
            {children}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

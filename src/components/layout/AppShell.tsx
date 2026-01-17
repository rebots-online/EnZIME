// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { useState } from 'react';
import { Header } from './Header';
import { MenuBar } from './MenuBar';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { MainContent } from './MainContent';
import { AboutDialog } from '../dialogs/AboutDialog';

interface AppInfo {
  name: string;
  version: string;
  description: string;
  copyright: string;
  license: string;
}

interface AppShellProps {
  appInfo: AppInfo;
}

export function AppShell({ appInfo }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <div className="app-shell flex flex-col h-screen">
      {/* Menu Bar */}
      <div className="surface h-8 flex items-center border-b border-[var(--border)]">
        <MenuBar 
          onShowAbout={() => setAboutOpen(true)}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
      </div>

      {/* Header */}
      <Header 
        appInfo={appInfo} 
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)} 
      />
      
      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <Sidebar />
        )}
        
        {/* Main Content */}
        <MainContent />
      </div>
      
      {/* Status Bar */}
      <StatusBar version={appInfo.version} />

      {/* About Dialog */}
      <AboutDialog 
        appInfo={appInfo}
        isOpen={aboutOpen}
        onClose={() => setAboutOpen(false)}
      />
    </div>
  );
}

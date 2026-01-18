// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { MenuBar } from './MenuBar';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
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
        
        {/* Main Content - Router Outlet */}
        <main className="flex-1 overflow-auto bg-[var(--bg-primary)]">
          <Outlet />
        </main>
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

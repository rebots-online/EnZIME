// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AppShell } from './components/layout/AppShell';
import { SplashScreen } from './components/SplashScreen';
import { ThemeProvider } from './contexts/ThemeContext';

interface AppInfo {
  name: string;
  version: string;
  description: string;
  copyright: string;
  license: string;
}

export function App() {
  const [loading, setLoading] = useState(true);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const info = await invoke<AppInfo>('get_app_info');
        setAppInfo(info);
      } catch (e) {
        // Running in browser without Tauri
        setAppInfo({
          name: 'EnZIM',
          version: 'v0.1.0.dev',
          description: 'Offline ZIM Reader & Knowledge Explorer',
          copyright: 'Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.',
          license: 'All rights reserved'
        });
      }
      
      // Show splash for minimum 1.5 seconds
      setTimeout(() => setLoading(false), 1500);
    }
    
    init();
  }, []);

  if (loading || !appInfo) {
    return <SplashScreen appInfo={appInfo} />;
  }

  return (
    <ThemeProvider>
      <AppShell appInfo={appInfo} />
    </ThemeProvider>
  );
}

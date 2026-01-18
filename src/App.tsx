// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { useEffect, useState, useMemo } from 'react';
import { RouterProvider } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { createRouter } from './router';
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
      } catch {
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

  const router = useMemo(() => {
    if (!appInfo) return null;
    return createRouter(appInfo);
  }, [appInfo]);

  if (loading || !appInfo || !router) {
    return <SplashScreen appInfo={appInfo} />;
  }

  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

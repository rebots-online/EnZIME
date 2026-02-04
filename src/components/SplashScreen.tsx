// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

interface AppInfo {
  name: string;
  version: string;
  description: string;
  copyright: string;
  license: string;
}

interface SplashScreenProps {
  appInfo: AppInfo | null;
}

export function SplashScreen({ appInfo }: SplashScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="text-center space-y-6">
        {/* Logo */}
        <div className="w-24 h-24 mx-auto bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-2xl">
          <span className="text-4xl font-bold">E</span>
        </div>
        
        {/* App Name & Version */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight">
            {appInfo?.name || 'EnZIM'}
          </h1>
          <p className="text-cyan-400 font-mono text-sm mt-1">
            {appInfo?.version || 'Loading...'}
          </p>
        </div>
        
        {/* Description */}
        <p className="text-gray-400 max-w-md">
          {appInfo?.description || 'Offline ZIM Reader & Knowledge Explorer'}
        </p>
        
        {/* Loading Indicator */}
        <div className="flex items-center justify-center space-x-2">
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
          <span className="text-gray-500 text-sm">Please wait... Initializing...</span>
        </div>
        
        {/* Copyright */}
        <p className="text-gray-600 text-xs mt-8">
          {appInfo?.copyright || 'Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.'}
        </p>
      </div>
    </div>
  );
}

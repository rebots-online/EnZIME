// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { X } from 'lucide-react';

interface AppInfo {
  name: string;
  version: string;
  description: string;
  copyright: string;
  license: string;
}

interface AboutDialogProps {
  appInfo: AppInfo;
  isOpen: boolean;
  onClose: () => void;
}

export function AboutDialog({ appInfo, isOpen, onClose }: AboutDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative surface rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">About {appInfo.name}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 text-center">
          {/* Logo */}
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-3xl font-bold text-white">E</span>
          </div>
          
          {/* App Name */}
          <h1 className="text-2xl font-bold mb-1">{appInfo.name}</h1>
          
          {/* Version */}
          <p className="text-[var(--accent)] font-mono text-sm mb-4">
            {appInfo.version}
          </p>
          
          {/* Description */}
          <p className="text-secondary text-sm mb-6">
            {appInfo.description}
          </p>
          
          {/* Divider */}
          <div className="border-t border-[var(--border)] my-4"></div>
          
          {/* Copyright */}
          <p className="text-xs text-secondary mb-2">
            {appInfo.copyright}
          </p>
          
          {/* License */}
          <p className="text-xs text-secondary">
            License: {appInfo.license}
          </p>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] flex justify-center">
          <button
            onClick={onClose}
            className="btn-primary px-6 py-2 rounded-lg text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

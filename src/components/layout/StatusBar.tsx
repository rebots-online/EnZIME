// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { useTheme } from '../../contexts/ThemeContext';

interface StatusBarProps {
  version: string;
}

export function StatusBar({ version }: StatusBarProps) {
  const { theme, effectiveMode } = useTheme();

  return (
    <footer className="surface h-6 flex items-center justify-between px-4 text-xs border-t">
      {/* Left: Status */}
      <div className="flex items-center gap-4 text-secondary">
        <span>Ready</span>
        <span className="capitalize">Theme: {theme}</span>
        <span className="capitalize">Mode: {effectiveMode}</span>
      </div>

      {/* Right: Version */}
      <div className="text-secondary font-mono">
        {version}
      </div>
    </footer>
  );
}

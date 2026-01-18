// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type ThemeName = 
  | 'minimal' 
  | 'synaptic' 
  | 'brutalist' 
  | 'prismatic' 
  | 'spectral'
  | 'kinetic'
  | 'retro'
  | 'neumorphism'
  | 'glassmorphism'
  | 'y2k'
  | 'cyberpunk';

export const themes: ThemeName[] = [
  'minimal',
  'synaptic',
  'brutalist',
  'prismatic',
  'spectral',
  'kinetic',
  'retro',
  'neumorphism',
  'glassmorphism',
  'y2k',
  'cyberpunk',
];

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeName;
  mode: ThemeMode;
  effectiveMode: 'light' | 'dark';
  setTheme: (theme: ThemeName) => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'enzim-theme';
const MODE_STORAGE_KEY = 'enzim-mode';

function getSystemMode(): 'light' | 'dark' {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      return (stored as ThemeName) || 'minimal';
    }
    return 'minimal';
  });

  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(MODE_STORAGE_KEY);
      return (stored as ThemeMode) || 'system';
    }
    return 'system';
  });

  const [effectiveMode, setEffectiveMode] = useState<'light' | 'dark'>(() => {
    if (mode === 'system') {
      return getSystemMode();
    }
    return mode;
  });

  useEffect(() => {
    if (mode === 'system') {
      setEffectiveMode(getSystemMode());
      
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        setEffectiveMode(e.matches ? 'dark' : 'light');
      };
      
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      setEffectiveMode(mode);
    }
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all theme classes
    root.classList.remove(
      'theme-minimal', 'theme-synaptic', 'theme-brutalist', 
      'theme-prismatic', 'theme-spectral', 'theme-kinetic',
      'theme-retro', 'theme-neumorphism', 'theme-glassmorphism',
      'theme-y2k', 'theme-cyberpunk', 'light', 'dark'
    );
    
    // Add current theme and mode classes
    root.classList.add(`theme-${theme}`, effectiveMode);
  }, [theme, effectiveMode]);

  const setTheme = (newTheme: ThemeName) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  };

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(MODE_STORAGE_KEY, newMode);
  };

  return (
    <ThemeContext.Provider value={{ theme, mode, effectiveMode, setTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

/**
 * ZIM Downloader Desktop UI - Theme System
 * Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.
 *
 * Provides 9 beautiful themes with light/dark/system mode support.
 */

// Version information
export const VERSION = '0.1.0';
export const COPYRIGHT = 'Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.';

// Calculate epoch-based 5-digit build number
export function getBuildNumber(): string {
  const epochMinutes = Math.floor(Date.now() / 60000);
  return String(epochMinutes % 100000).padStart(5, '0');
}

export function getVersionString(): string {
  return `v${VERSION}+${getBuildNumber()}`;
}

// Theme modes
export type ThemeMode = 'light' | 'dark' | 'system';

// Available themes
export type ThemeName = 
  | 'kinetic'
  | 'brutalist'
  | 'retro'
  | 'neumorphism'
  | 'glassmorphism'
  | 'y2k'
  | 'cyberpunk'
  | 'minimal'
  | 'nordic';

export const THEME_NAMES: ThemeName[] = [
  'kinetic',
  'brutalist',
  'retro',
  'neumorphism',
  'glassmorphism',
  'y2k',
  'cyberpunk',
  'minimal',
  'nordic',
];

// Theme metadata
export const themeInfo: Record<ThemeName, { name: string; description: string; icon: string }> = {
  kinetic: {
    name: 'Kinetic',
    description: 'Colorful, dynamic, Gumroad-inspired design',
    icon: '🎨',
  },
  brutalist: {
    name: 'Brutalist',
    description: 'Raw, honest, monospace aesthetic',
    icon: '🏛️',
  },
  retro: {
    name: 'Retro',
    description: 'CRT terminal vibes with scanlines',
    icon: '📺',
  },
  neumorphism: {
    name: 'Neumorphism',
    description: 'Soft shadows, extruded surfaces',
    icon: '🔘',
  },
  glassmorphism: {
    name: 'Glassmorphism',
    description: 'Frosted glass with depth',
    icon: '🪟',
  },
  y2k: {
    name: 'Y2K',
    description: 'Early 2000s web maximalism',
    icon: '💿',
  },
  cyberpunk: {
    name: 'Cyberpunk',
    description: 'Neon-soaked dystopian future',
    icon: '🌃',
  },
  minimal: {
    name: 'Minimal',
    description: 'Clean Swiss design',
    icon: '⬜',
  },
  nordic: {
    name: 'Nordic',
    description: 'Cool, calm, Scandinavian palette',
    icon: '❄️',
  },
};

// Theme colors interface
export interface ThemeColors {
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  fg: string;
  fgSecondary: string;
  fgMuted: string;
  accent: string;
  accentSecondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  border: string;
  selection: string;
  selectionFg: string;
}

// Theme color definitions
export const themes: Record<ThemeName, { dark: ThemeColors; light: ThemeColors }> = {
  kinetic: {
    dark: {
      bg: '#1a1a2e',
      bgSecondary: '#16213e',
      bgTertiary: '#2a2a4e',
      fg: '#ffffff',
      fgSecondary: '#e0e0e0',
      fgMuted: '#808080',
      accent: '#f97316',
      accentSecondary: '#fb923c',
      success: '#2ed573',
      warning: '#ffc107',
      error: '#ff4757',
      info: '#74b9ff',
      border: '#3a3a52',
      selection: '#f97316',
      selectionFg: '#ffffff',
    },
    light: {
      bg: '#ffffff',
      bgSecondary: '#f8f9fa',
      bgTertiary: '#e9ecef',
      fg: '#1a1a2e',
      fgSecondary: '#495057',
      fgMuted: '#6c757d',
      accent: '#ea580c',
      accentSecondary: '#f97316',
      success: '#00a86b',
      warning: '#ff9800',
      error: '#dc3545',
      info: '#007bff',
      border: '#dee2e6',
      selection: '#ea580c',
      selectionFg: '#ffffff',
    },
  },
  brutalist: {
    dark: {
      bg: '#000000',
      bgSecondary: '#111111',
      bgTertiary: '#222222',
      fg: '#ffffff',
      fgSecondary: '#cccccc',
      fgMuted: '#666666',
      accent: '#ffffff',
      accentSecondary: '#888888',
      success: '#00ff00',
      warning: '#ffff00',
      error: '#ff0000',
      info: '#00ffff',
      border: '#ffffff',
      selection: '#ffffff',
      selectionFg: '#000000',
    },
    light: {
      bg: '#ffffff',
      bgSecondary: '#f0f0f0',
      bgTertiary: '#e0e0e0',
      fg: '#000000',
      fgSecondary: '#333333',
      fgMuted: '#666666',
      accent: '#000000',
      accentSecondary: '#444444',
      success: '#008000',
      warning: '#cc9900',
      error: '#cc0000',
      info: '#006699',
      border: '#000000',
      selection: '#000000',
      selectionFg: '#ffffff',
    },
  },
  retro: {
    dark: {
      bg: '#002800',
      bgSecondary: '#003300',
      bgTertiary: '#004400',
      fg: '#00ff00',
      fgSecondary: '#00cc00',
      fgMuted: '#006600',
      accent: '#00ff00',
      accentSecondary: '#00b400',
      success: '#00ff00',
      warning: '#ffff00',
      error: '#ff0000',
      info: '#00c8ff',
      border: '#00b400',
      selection: '#00b400',
      selectionFg: '#000000',
    },
    light: {
      bg: '#e8ffe8',
      bgSecondary: '#d0ffd0',
      bgTertiary: '#b8ffb8',
      fg: '#003300',
      fgSecondary: '#006600',
      fgMuted: '#339933',
      accent: '#006600',
      accentSecondary: '#008800',
      success: '#006600',
      warning: '#996600',
      error: '#990000',
      info: '#006699',
      border: '#006600',
      selection: '#006600',
      selectionFg: '#ffffff',
    },
  },
  neumorphism: {
    dark: {
      bg: '#2c2c3c',
      bgSecondary: '#323244',
      bgTertiary: '#3c3c50',
      fg: '#dcdce6',
      fgSecondary: '#b8b8c8',
      fgMuted: '#646478',
      accent: '#6478ff',
      accentSecondary: '#8ca0ff',
      success: '#64c864',
      warning: '#ffc864',
      error: '#ff6464',
      info: '#64b4ff',
      border: '#3c3c50',
      selection: '#3c3c50',
      selectionFg: '#8ca0ff',
    },
    light: {
      bg: '#e6e6f0',
      bgSecondary: '#f0f0f8',
      bgTertiary: '#d8d8e4',
      fg: '#3c3c50',
      fgSecondary: '#5a5a70',
      fgMuted: '#8c8ca0',
      accent: '#5064dc',
      accentSecondary: '#788cff',
      success: '#3ca03c',
      warning: '#dca03c',
      error: '#dc3c3c',
      info: '#3c8cdc',
      border: '#c8c8d4',
      selection: '#c8c8d4',
      selectionFg: '#5064dc',
    },
  },
  glassmorphism: {
    dark: {
      bg: '#1e1e32',
      bgSecondary: '#252540',
      bgTertiary: '#303050',
      fg: '#ffffff',
      fgSecondary: '#e0e0e0',
      fgMuted: '#787898',
      accent: '#8ab4f8',
      accentSecondary: '#b482ff',
      success: '#64dc96',
      warning: '#ffc864',
      error: '#ff6482',
      info: '#64b4ff',
      border: '#404060',
      selection: '#8ab4f8',
      selectionFg: '#ffffff',
    },
    light: {
      bg: '#f0f0f8',
      bgSecondary: '#ffffff',
      bgTertiary: '#e8e8f0',
      fg: '#1e1e32',
      fgSecondary: '#3c3c50',
      fgMuted: '#787898',
      accent: '#5e81ac',
      accentSecondary: '#8b5cf6',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
      border: '#d0d0e0',
      selection: '#5e81ac',
      selectionFg: '#ffffff',
    },
  },
  y2k: {
    dark: {
      bg: '#000080',
      bgSecondary: '#0000a0',
      bgTertiary: '#0000b4',
      fg: '#ffffff',
      fgSecondary: '#e0e0e0',
      fgMuted: '#8080c0',
      accent: '#ff00ff',
      accentSecondary: '#00ffff',
      success: '#00ff00',
      warning: '#ffff00',
      error: '#ff0000',
      info: '#00ffff',
      border: '#c0c0c0',
      selection: '#0000b4',
      selectionFg: '#ffff00',
    },
    light: {
      bg: '#c0c0ff',
      bgSecondary: '#d0d0ff',
      bgTertiary: '#e0e0ff',
      fg: '#000080',
      fgSecondary: '#0000a0',
      fgMuted: '#6060a0',
      accent: '#ff00ff',
      accentSecondary: '#0080ff',
      success: '#008000',
      warning: '#808000',
      error: '#800000',
      info: '#008080',
      border: '#8080c0',
      selection: '#8080ff',
      selectionFg: '#000080',
    },
  },
  cyberpunk: {
    dark: {
      bg: '#0d0221',
      bgSecondary: '#150530',
      bgTertiary: '#1f0840',
      fg: '#ffffff',
      fgSecondary: '#e0e0e0',
      fgMuted: '#800080',
      accent: '#ff0080',
      accentSecondary: '#00ffff',
      success: '#00ff88',
      warning: '#ffff00',
      error: '#ff0040',
      info: '#00c8ff',
      border: '#ff0080',
      selection: '#ff0080',
      selectionFg: '#ffffff',
    },
    light: {
      bg: '#ffe0f0',
      bgSecondary: '#fff0f8',
      bgTertiary: '#ffd0e8',
      fg: '#0d0221',
      fgSecondary: '#400040',
      fgMuted: '#804080',
      accent: '#ff0080',
      accentSecondary: '#0080ff',
      success: '#00a060',
      warning: '#c0a000',
      error: '#c00040',
      info: '#0080c0',
      border: '#ff80c0',
      selection: '#ff80c0',
      selectionFg: '#0d0221',
    },
  },
  minimal: {
    dark: {
      bg: '#181818',
      bgSecondary: '#202020',
      bgTertiary: '#2a2a2a',
      fg: '#f0f0f0',
      fgSecondary: '#c0c0c0',
      fgMuted: '#646464',
      accent: '#646464',
      accentSecondary: '#a0a0a0',
      success: '#64b464',
      warning: '#dcb450',
      error: '#dc5050',
      info: '#50a0dc',
      border: '#3c3c3c',
      selection: '#3c3c3c',
      selectionFg: '#ffffff',
    },
    light: {
      bg: '#fafafa',
      bgSecondary: '#f0f0f0',
      bgTertiary: '#e8e8e8',
      fg: '#1e1e1e',
      fgSecondary: '#404040',
      fgMuted: '#8c8c8c',
      accent: '#646464',
      accentSecondary: '#3c3c3c',
      success: '#287828',
      warning: '#b48c28',
      error: '#b42828',
      info: '#2864b4',
      border: '#c8c8c8',
      selection: '#dcdcdc',
      selectionFg: '#1e1e1e',
    },
  },
  nordic: {
    dark: {
      bg: '#2e3440',
      bgSecondary: '#3b4252',
      bgTertiary: '#434c5e',
      fg: '#eceff4',
      fgSecondary: '#d8dee9',
      fgMuted: '#4c566a',
      accent: '#88c0d0',
      accentSecondary: '#81a1c1',
      success: '#a3be8c',
      warning: '#ebcb8b',
      error: '#bf616a',
      info: '#5e81ac',
      border: '#434c5e',
      selection: '#434c5e',
      selectionFg: '#eceff4',
    },
    light: {
      bg: '#eceff4',
      bgSecondary: '#e5e9f0',
      bgTertiary: '#d8dee9',
      fg: '#2e3440',
      fgSecondary: '#3b4252',
      fgMuted: '#4c566a',
      accent: '#5e81ac',
      accentSecondary: '#81a1c1',
      success: '#8faa78',
      warning: '#d79921',
      error: '#bf616a',
      info: '#5e81ac',
      border: '#d8dee9',
      selection: '#d8dee9',
      selectionFg: '#2e3440',
    },
  },
};

// Get theme colors based on name and mode
export function getTheme(themeName: ThemeName, mode: ThemeMode): ThemeColors {
  const theme = themes[themeName] || themes.kinetic;
  
  if (mode === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? theme.dark : theme.light;
  }
  
  return mode === 'dark' ? theme.dark : theme.light;
}

// Generate Tailwind-compatible CSS classes
export function getThemeClasses(themeName: ThemeName, mode: ThemeMode): Record<string, string> {
  const colors = getTheme(themeName, mode);
  
  return {
    // Background classes
    bgPrimary: `bg-[${colors.bg}]`,
    bgSecondary: `bg-[${colors.bgSecondary}]`,
    bgTertiary: `bg-[${colors.bgTertiary}]`,
    
    // Text classes
    textPrimary: `text-[${colors.fg}]`,
    textSecondary: `text-[${colors.fgSecondary}]`,
    textMuted: `text-[${colors.fgMuted}]`,
    
    // Accent classes
    accent: `text-[${colors.accent}]`,
    accentBg: `bg-[${colors.accent}]`,
    
    // Border classes
    border: `border-[${colors.border}]`,
    
    // Status classes
    success: `text-[${colors.success}]`,
    warning: `text-[${colors.warning}]`,
    error: `text-[${colors.error}]`,
    info: `text-[${colors.info}]`,
  };
}

// Cycle to next theme
export function nextTheme(currentTheme: ThemeName): ThemeName {
  const idx = THEME_NAMES.indexOf(currentTheme);
  return THEME_NAMES[(idx + 1) % THEME_NAMES.length];
}

// Cycle theme mode
export function nextMode(currentMode: ThemeMode): ThemeMode {
  const modes: ThemeMode[] = ['light', 'dark', 'system'];
  const idx = modes.indexOf(currentMode);
  return modes[(idx + 1) % modes.length];
}

// Local storage keys
const THEME_KEY = 'zim_downloader_theme';
const MODE_KEY = 'zim_downloader_mode';

// Save theme preferences
export function saveThemePrefs(themeName: ThemeName, mode: ThemeMode): void {
  localStorage.setItem(THEME_KEY, themeName);
  localStorage.setItem(MODE_KEY, mode);
}

// Load theme preferences
export function loadThemePrefs(): { theme: ThemeName; mode: ThemeMode } {
  const theme = (localStorage.getItem(THEME_KEY) as ThemeName) || 'kinetic';
  const mode = (localStorage.getItem(MODE_KEY) as ThemeMode) || 'dark';
  return { theme, mode };
}

/**
 * Zimmer Chrome Extension - Theme System
 * Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.
 *
 * Provides 9 beautiful themes with light/dark/system mode support.
 */

// Version information
export const VERSION = '0.1.0';
export const COPYRIGHT = 'Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.';

// Calculate epoch-based 5-digit build number
export function getBuildNumber() {
  const epochMinutes = Math.floor(Date.now() / 60000);
  return String(epochMinutes % 100000).padStart(5, '0');
}

export function getVersionString() {
  return `v${VERSION}+${getBuildNumber()}`;
}

// Theme modes
export const ThemeMode = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
};

// Available themes
export const ThemeName = {
  KINETIC: 'kinetic',
  BRUTALIST: 'brutalist',
  RETRO: 'retro',
  NEUMORPHISM: 'neumorphism',
  GLASSMORPHISM: 'glassmorphism',
  Y2K: 'y2k',
  CYBERPUNK: 'cyberpunk',
  MINIMAL: 'minimal',
  NORDIC: 'nordic',
};

// Theme metadata
export const themeInfo = {
  [ThemeName.KINETIC]: {
    name: 'Kinetic',
    description: 'Colorful, dynamic, Gumroad-inspired design',
    icon: '🎨',
  },
  [ThemeName.BRUTALIST]: {
    name: 'Brutalist',
    description: 'Raw, honest, monospace aesthetic',
    icon: '🏛️',
  },
  [ThemeName.RETRO]: {
    name: 'Retro',
    description: 'CRT terminal vibes with scanlines',
    icon: '📺',
  },
  [ThemeName.NEUMORPHISM]: {
    name: 'Neumorphism',
    description: 'Soft shadows, extruded surfaces',
    icon: '🔘',
  },
  [ThemeName.GLASSMORPHISM]: {
    name: 'Glassmorphism',
    description: 'Frosted glass with depth',
    icon: '🪟',
  },
  [ThemeName.Y2K]: {
    name: 'Y2K',
    description: 'Early 2000s web maximalism',
    icon: '💿',
  },
  [ThemeName.CYBERPUNK]: {
    name: 'Cyberpunk',
    description: 'Neon-soaked dystopian future',
    icon: '🌃',
  },
  [ThemeName.MINIMAL]: {
    name: 'Minimal',
    description: 'Clean Swiss design',
    icon: '⬜',
  },
  [ThemeName.NORDIC]: {
    name: 'Nordic',
    description: 'Cool, calm, Scandinavian palette',
    icon: '❄️',
  },
};

// Theme color definitions
export const themes = {
  [ThemeName.KINETIC]: {
    dark: {
      bg: '#1a1a2e',
      bgSecondary: '#16213e',
      bgTertiary: '#2a2a4e',
      fg: '#ffffff',
      fgSecondary: '#e0e0e0',
      fgMuted: '#808080',
      accent: '#ff6b6b',
      accentSecondary: '#4ecdc4',
      accentGradient: 'linear-gradient(135deg, #f97316, #fb923c)',
      success: '#2ed573',
      warning: '#ffc107',
      error: '#ff4757',
      info: '#74b9ff',
      border: '#3a3a52',
      selection: '#ff6b6b',
      selectionFg: '#ffffff',
    },
    light: {
      bg: '#ffffff',
      bgSecondary: '#f8f9fa',
      bgTertiary: '#e9ecef',
      fg: '#1a1a2e',
      fgSecondary: '#495057',
      fgMuted: '#6c757d',
      accent: '#ff4757',
      accentSecondary: '#00b8a9',
      accentGradient: 'linear-gradient(135deg, #ff4757, #ff6b81)',
      success: '#00a86b',
      warning: '#ff9800',
      error: '#dc3545',
      info: '#007bff',
      border: '#dee2e6',
      selection: '#ff4757',
      selectionFg: '#ffffff',
    },
  },
  [ThemeName.BRUTALIST]: {
    dark: {
      bg: '#000000',
      bgSecondary: '#111111',
      bgTertiary: '#222222',
      fg: '#ffffff',
      fgSecondary: '#cccccc',
      fgMuted: '#666666',
      accent: '#ffffff',
      accentSecondary: '#888888',
      accentGradient: 'none',
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
      accentGradient: 'none',
      success: '#008000',
      warning: '#cc9900',
      error: '#cc0000',
      info: '#006699',
      border: '#000000',
      selection: '#000000',
      selectionFg: '#ffffff',
    },
  },
  [ThemeName.RETRO]: {
    dark: {
      bg: '#002800',
      bgSecondary: '#003300',
      bgTertiary: '#004400',
      fg: '#00ff00',
      fgSecondary: '#00cc00',
      fgMuted: '#006600',
      accent: '#00ff00',
      accentSecondary: '#00b400',
      accentGradient: 'none',
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
      accentGradient: 'none',
      success: '#006600',
      warning: '#996600',
      error: '#990000',
      info: '#006699',
      border: '#006600',
      selection: '#006600',
      selectionFg: '#ffffff',
    },
  },
  [ThemeName.NEUMORPHISM]: {
    dark: {
      bg: '#2c2c3c',
      bgSecondary: '#323244',
      bgTertiary: '#3c3c50',
      fg: '#dcdce6',
      fgSecondary: '#b8b8c8',
      fgMuted: '#646478',
      accent: '#6478ff',
      accentSecondary: '#8ca0ff',
      accentGradient: 'linear-gradient(145deg, #6478ff, #8ca0ff)',
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
      accentGradient: 'linear-gradient(145deg, #5064dc, #788cff)',
      success: '#3ca03c',
      warning: '#dca03c',
      error: '#dc3c3c',
      info: '#3c8cdc',
      border: '#c8c8d4',
      selection: '#c8c8d4',
      selectionFg: '#5064dc',
    },
  },
  [ThemeName.GLASSMORPHISM]: {
    dark: {
      bg: '#1e1e32',
      bgSecondary: 'rgba(255, 255, 255, 0.05)',
      bgTertiary: 'rgba(255, 255, 255, 0.1)',
      fg: '#ffffff',
      fgSecondary: '#e0e0e0',
      fgMuted: '#787898',
      accent: '#8ab4f8',
      accentSecondary: '#b482ff',
      accentGradient: 'linear-gradient(135deg, #8ab4f8, #b482ff)',
      success: '#64dc96',
      warning: '#ffc864',
      error: '#ff6482',
      info: '#64b4ff',
      border: 'rgba(255, 255, 255, 0.1)',
      selection: 'rgba(138, 180, 248, 0.3)',
      selectionFg: '#ffffff',
    },
    light: {
      bg: '#f0f0f8',
      bgSecondary: 'rgba(255, 255, 255, 0.7)',
      bgTertiary: 'rgba(255, 255, 255, 0.9)',
      fg: '#1e1e32',
      fgSecondary: '#3c3c50',
      fgMuted: '#787898',
      accent: '#5e81ac',
      accentSecondary: '#8b5cf6',
      accentGradient: 'linear-gradient(135deg, #5e81ac, #8b5cf6)',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
      border: 'rgba(0, 0, 0, 0.1)',
      selection: 'rgba(94, 129, 172, 0.3)',
      selectionFg: '#1e1e32',
    },
  },
  [ThemeName.Y2K]: {
    dark: {
      bg: '#000080',
      bgSecondary: '#0000a0',
      bgTertiary: '#0000b4',
      fg: '#ffffff',
      fgSecondary: '#e0e0e0',
      fgMuted: '#8080c0',
      accent: '#ff00ff',
      accentSecondary: '#00ffff',
      accentGradient: 'linear-gradient(135deg, #ff00ff, #00ffff)',
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
      accentGradient: 'linear-gradient(135deg, #ff00ff, #0080ff)',
      success: '#008000',
      warning: '#808000',
      error: '#800000',
      info: '#008080',
      border: '#8080c0',
      selection: '#8080ff',
      selectionFg: '#000080',
    },
  },
  [ThemeName.CYBERPUNK]: {
    dark: {
      bg: '#0d0221',
      bgSecondary: '#150530',
      bgTertiary: '#1f0840',
      fg: '#ffffff',
      fgSecondary: '#e0e0e0',
      fgMuted: '#800080',
      accent: '#ff0080',
      accentSecondary: '#00ffff',
      accentGradient: 'linear-gradient(135deg, #ff0080, #00ffff)',
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
      accentGradient: 'linear-gradient(135deg, #ff0080, #0080ff)',
      success: '#00a060',
      warning: '#c0a000',
      error: '#c00040',
      info: '#0080c0',
      border: '#ff80c0',
      selection: '#ff80c0',
      selectionFg: '#0d0221',
    },
  },
  [ThemeName.MINIMAL]: {
    dark: {
      bg: '#181818',
      bgSecondary: '#202020',
      bgTertiary: '#2a2a2a',
      fg: '#f0f0f0',
      fgSecondary: '#c0c0c0',
      fgMuted: '#646464',
      accent: '#646464',
      accentSecondary: '#a0a0a0',
      accentGradient: 'none',
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
      accentGradient: 'none',
      success: '#287828',
      warning: '#b48c28',
      error: '#b42828',
      info: '#2864b4',
      border: '#c8c8c8',
      selection: '#dcdcdc',
      selectionFg: '#1e1e1e',
    },
  },
  [ThemeName.NORDIC]: {
    dark: {
      bg: '#2e3440',
      bgSecondary: '#3b4252',
      bgTertiary: '#434c5e',
      fg: '#eceff4',
      fgSecondary: '#d8dee9',
      fgMuted: '#4c566a',
      accent: '#88c0d0',
      accentSecondary: '#81a1c1',
      accentGradient: 'linear-gradient(135deg, #88c0d0, #81a1c1)',
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
      accentGradient: 'linear-gradient(135deg, #5e81ac, #81a1c1)',
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
export function getTheme(themeName, mode) {
  const theme = themes[themeName] || themes[ThemeName.KINETIC];
  const isDark = mode === ThemeMode.DARK || 
    (mode === ThemeMode.SYSTEM && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return isDark ? theme.dark : theme.light;
}

// Apply theme to document
export function applyTheme(themeName, mode) {
  const colors = getTheme(themeName, mode);
  const root = document.documentElement;

  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });

  // Add theme class to body
  document.body.dataset.theme = themeName;
  document.body.dataset.mode = mode;
}

// Get all theme names
export function getAllThemes() {
  return Object.values(ThemeName);
}

// Cycle to next theme
export function nextTheme(currentTheme) {
  const themes = getAllThemes();
  const idx = themes.indexOf(currentTheme);
  return themes[(idx + 1) % themes.length];
}

// Cycle theme mode
export function nextMode(currentMode) {
  const modes = [ThemeMode.LIGHT, ThemeMode.DARK, ThemeMode.SYSTEM];
  const idx = modes.indexOf(currentMode);
  return modes[(idx + 1) % modes.length];
}

// Save theme preferences
export async function saveThemePrefs(themeName, mode) {
  await chrome.storage.local.set({
    'zimmer_theme': themeName,
    'zimmer_mode': mode,
  });
}

// Load theme preferences
export async function loadThemePrefs() {
  const result = await chrome.storage.local.get(['zimmer_theme', 'zimmer_mode']);
  return {
    theme: result.zimmer_theme || ThemeName.KINETIC,
    mode: result.zimmer_mode || ThemeMode.DARK,
  };
}

import { create } from 'zustand';
import { applyTheme } from '../theme';

// E-FE-23: Screen type for pure UI navigation state (no router library)
export type Screen =
  | 'first-launch'
  | 'library'
  | 'catalog'
  | 'reader'
  | 'search'
  | 'annotator'
  | 'sidecar'
  | 'settings'
  | 'paywall';

// E-FE-23: App-state Zustand hook
export interface AppStateShape {
  isFirstLaunch: boolean;
  themeMode: 'light' | 'dark';
  activeScreen: Screen;
  updateAvailable: boolean;
  setFirstLaunchComplete: () => void;
  setThemeMode: (mode: 'light' | 'dark') => void;
  setActiveScreen: (screen: Screen) => void;
  setUpdateAvailable: (available: boolean) => void;
}

const store = create<AppStateShape>((set) => ({
  isFirstLaunch: true,
  themeMode: 'dark', // E-FE-23 UI-3: dark is default
  activeScreen: 'library',
  updateAvailable: false,
  setFirstLaunchComplete: () => set({ isFirstLaunch: false }),
  setThemeMode: (mode) => {
    set({ themeMode: mode });
    applyTheme(mode);
  },
  setActiveScreen: (screen) => set({ activeScreen: screen }),
  setUpdateAvailable: (available) => set({ updateAvailable: available }),
}));

export function useAppState(): AppStateShape {
  return store();
}

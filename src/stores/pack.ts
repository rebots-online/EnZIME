import { create } from 'zustand';
import { packCatalogList, packInstall, packUninstall, ZimPack, PackProgress } from '../bridge';

// E-FE-29: Pack catalog + install state
export interface PackStore {
	catalog: ZimPack[];
	installedPackIds: Set<string>;
	installProgress: Map<string, PackProgress>;
	isLoading: boolean;
	lastError: string | null;

	refreshCatalog: () => Promise<void>;
	installPack: (packId: string, onProgress?: (progress: PackProgress) => void) => Promise<string>;
	uninstallPack: (packId: string) => Promise<void>;
	clearError: () => void;
}

const store = create<PackStore>((set) => ({
	catalog: [],
	installedPackIds: new Set<string>(),
	installProgress: new Map<string, PackProgress>(),
	isLoading: false,
	lastError: null,

	refreshCatalog: async () => {
		set({ isLoading: true, lastError: null });
		try {
			const packs = await packCatalogList();
			set({ catalog: packs, isLoading: false });
		} catch (e) {
			set({ isLoading: false, lastError: `Failed to refresh catalog: ${e}` });
			throw e;
		}
	},

	installPack: async (packId: string, onProgress?: (progress: PackProgress) => void) => {
		set({ isLoading: true, lastError: null });
		try {
			const result = await packInstall(packId, (progress) => {
				set((state) => {
					const newProgress = new Map(state.installProgress);
					newProgress.set(packId, progress);
					return { installProgress: newProgress };
				});
				onProgress?.(progress);
			});
			set((state) => {
				const newInstalled = new Set(state.installedPackIds);
				newInstalled.add(packId);
				const newProgress = new Map(state.installProgress);
				newProgress.delete(packId);
				return { installedPackIds: newInstalled, installProgress: newProgress, isLoading: false };
			});
			return result;
		} catch (e) {
			set({ isLoading: false, lastError: `Failed to install pack: ${e}` });
			throw e;
		}
	},

	uninstallPack: async (packId: string) => {
		set({ isLoading: true, lastError: null });
		try {
			await packUninstall(packId);
			set((state) => {
				const newInstalled = new Set(state.installedPackIds);
				newInstalled.delete(packId);
				return { installedPackIds: newInstalled, isLoading: false };
			});
		} catch (e) {
			set({ isLoading: false, lastError: `Failed to uninstall pack: ${e}` });
			throw e;
		}
	},

	clearError: () => set({ lastError: null }),
}));

export function usePackStore(): PackStore {
	return store();
}

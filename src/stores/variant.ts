import { create } from 'zustand';
import { DeviceCapability, Variant, deviceProbe, variantCurrent, variantOverride, modelPresent, modelFetch, modelImportFromMedia, DownloadProgress } from '../bridge';

// E-MOD-5: Settings-level override
export enum VariantOverride {
	Auto = 'Auto',
	ForceQwen3 = 'ForceQwen3',
	ForceGemmaE2bQ4 = 'ForceGemmaE2bQ4',
}

// E-FE-27: Variant + capability + override store
export interface VariantStore {
	deviceCapability: DeviceCapability | null;
	currentVariant: Variant | null;
	userOverride: VariantOverride;
	isModelPresent: Map<Variant, boolean>;
	isFetching: boolean;
	// UI-6: Per-variant progress map owned by the store
	downloadProgress: Map<Variant, DownloadProgress>;

	probeDevice: () => Promise<void>;
	fetchCurrentVariant: () => Promise<void>;
	setOverride: (override_: VariantOverride) => Promise<void>;
	checkModelPresent: (variant: Variant) => Promise<boolean>;
	fetchModel: (variant: Variant) => Promise<string>;
	importFromMedia: (variant: Variant) => Promise<string>;
}

const store = create<VariantStore>((set, get) => ({
	deviceCapability: null,
	currentVariant: null,
	userOverride: VariantOverride.Auto,
	isModelPresent: new Map<Variant, boolean>(),
	isFetching: false,
	downloadProgress: new Map<Variant, DownloadProgress>(),

	probeDevice: async () => {
		try {
			const capability = await deviceProbe();
			set({ deviceCapability: capability });
		} catch (e) {
			throw new Error(`Probe failed: ${e}`);
		}
	},

	fetchCurrentVariant: async () => {
		try {
			const variant = await variantCurrent();
			set({ currentVariant: variant });
		} catch (e) {
			throw new Error(`Failed to fetch variant: ${e}`);
		}
	},

	setOverride: async (override_: VariantOverride) => {
		try {
			const overrideVariant = override_ === VariantOverride.Auto
				? null
				: override_ === VariantOverride.ForceQwen3
					? Variant.Qwen3_06B_Q4
					: Variant.GemmaE2bQ4;
			await variantOverride(overrideVariant);
			set({ userOverride: override_ });
			await get().fetchCurrentVariant();
		} catch (e) {
			throw new Error(`Failed to set override: ${e}`);
		}
	},

	checkModelPresent: async (variant: Variant) => {
		try {
			const present = await modelPresent(variant);
			set((state) => {
				const newMap = new Map(state.isModelPresent);
				newMap.set(variant, present);
				return { isModelPresent: newMap };
			});
			return present;
		} catch (e) {
			return false;
		}
	},

	fetchModel: async (variant: Variant) => {
		set({ isFetching: true });
		try {
			// UI-6: Store-owned callback writing to per-variant progress map
			const onProgress = (progress: DownloadProgress) => {
				set((state) => {
					const newMap = new Map(state.downloadProgress);
					newMap.set(variant, progress);
					return { downloadProgress: newMap };
				});
			};
			const path = await modelFetch(variant, onProgress);
			set((state) => {
				const newMap = new Map(state.isModelPresent);
				newMap.set(variant, true);
				return { isModelPresent: newMap, isFetching: false };
			});
			return path;
		} catch (e) {
			set({ isFetching: false });
			throw e;
		}
	},

	importFromMedia: async (variant: Variant) => {
		set({ isFetching: true });
		try {
			// UI-6: Store-owned callback writing to per-variant progress map
			const onProgress = (progress: DownloadProgress) => {
				set((state) => {
					const newMap = new Map(state.downloadProgress);
					newMap.set(variant, progress);
					return { downloadProgress: newMap };
				});
			};
			const path = await modelImportFromMedia(variant, onProgress);
			set((state) => {
				const newMap = new Map(state.isModelPresent);
				newMap.set(variant, true);
				return { isModelPresent: newMap, isFetching: false };
			});
			return path;
		} catch (e) {
			set({ isFetching: false });
			throw e;
		}
	},
}));

export function useVariantStore(): VariantStore {
	return store();
}

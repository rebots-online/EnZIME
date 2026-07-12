import { create } from 'zustand';
import { sidecarImport, sidecarList, sidecarDelete, trustGet, trustSet, trustList, chunkIngest, SidecarMeta, TrustLevel, TrustEntry, ReassembleStatus } from '../bridge';

// E-FE-28: Sidecar list + trust cache
export interface SidecarStore {
	sidecars: Map<string, SidecarMeta[]>;
	trustCache: Map<string, TrustLevel>;
	trustEntries: TrustEntry[];
	isLoading: boolean;
	lastError: string | null;

	listSidecars: (zimUuid: string, urlPrefix?: string) => Promise<void>;
	importSidecar: (bytes: number[]) => Promise<SidecarMeta>;
	deleteSidecar: (artifactId: string) => Promise<void>;
	getTrustLevel: (pubkey: string) => Promise<TrustLevel | null>;
	setTrustLevel: (pubkey: string, level: TrustLevel, scope?: string, expiresAt?: number, reason?: string) => Promise<void>;
	listTrustEntries: () => Promise<void>;
	ingestChunk: (chunkBytes: number[]) => Promise<ReassembleStatus>;
	clearError: () => void;
}

const store = create<SidecarStore>((set) => ({
	sidecars: new Map<string, SidecarMeta[]>(),
	trustCache: new Map<string, TrustLevel>(),
	trustEntries: [],
	isLoading: false,
	lastError: null,

	listSidecars: async (zimUuid: string, urlPrefix?: string) => {
		set({ isLoading: true, lastError: null });
		try {
			const metaList = await sidecarList(zimUuid, urlPrefix || null);
			set((state) => {
				const newMap = new Map(state.sidecars);
				newMap.set(zimUuid, metaList);
				return { sidecars: newMap, isLoading: false };
			});
		} catch (e) {
			set({ isLoading: false, lastError: `Failed to list sidecars: ${e}` });
			throw e;
		}
	},

	importSidecar: async (bytes: number[]) => {
		set({ isLoading: true, lastError: null });
		try {
			const meta = await sidecarImport(bytes);
			set({ isLoading: false });
			return meta;
		} catch (e) {
			set({ isLoading: false, lastError: `Failed to import sidecar: ${e}` });
			throw e;
		}
	},

	deleteSidecar: async (artifactId: string) => {
		set({ isLoading: true, lastError: null });
		try {
			await sidecarDelete(artifactId);
			set((state) => {
				const newMap = new Map<string, SidecarMeta[]>();
				for (const [zimUuid, metas] of state.sidecars) {
					newMap.set(zimUuid, metas.filter(m => m.artifact_id !== artifactId));
				}
				return { sidecars: newMap, isLoading: false };
			});
		} catch (e) {
			set({ isLoading: false, lastError: `Failed to delete sidecar: ${e}` });
			throw e;
		}
	},

	getTrustLevel: async (pubkey: string) => {
		try {
			const level = await trustGet(pubkey);
			set((state) => {
				const newCache = new Map(state.trustCache);
				if (level !== null) {
					newCache.set(pubkey, level);
				}
				return { trustCache: newCache };
			});
			return level;
		} catch (e) {
			set({ lastError: `Failed to get trust level: ${e}` });
			return null;
		}
	},

	setTrustLevel: async (pubkey: string, level: TrustLevel, scope?: string, expiresAt?: number, reason?: string) => {
		set({ isLoading: true, lastError: null });
		try {
			await trustSet(pubkey, level, scope || null, expiresAt || null, reason || null);
			set((state) => {
				const newCache = new Map(state.trustCache);
				newCache.set(pubkey, level);
				return { trustCache: newCache, isLoading: false };
			});
		} catch (e) {
			set({ isLoading: false, lastError: `Failed to set trust level: ${e}` });
			throw e;
		}
	},

	listTrustEntries: async () => {
		set({ isLoading: true, lastError: null });
		try {
			const entries = await trustList();
			set({ trustEntries: entries, isLoading: false });
		} catch (e) {
			set({ isLoading: false, lastError: `Failed to list trust entries: ${e}` });
			throw e;
		}
	},

	ingestChunk: async (chunkBytes: number[]) => {
		try {
			const status = await chunkIngest(chunkBytes);
			return status;
		} catch (e) {
			set({ lastError: `Failed to ingest chunk: ${e}` });
			throw e;
		}
	},

	clearError: () => set({ lastError: null }),
}));

export function useSidecarStore(): SidecarStore {
	return store();
}

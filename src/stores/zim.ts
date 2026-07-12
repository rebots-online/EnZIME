import { create } from 'zustand';
import { zimOpen, zimClose, zimMetadata, zimGetArticle, zimListArticles, zimSearch, ZimMetaJson, SearchHit } from '../bridge';

// E-FE-25: Open-handles Zustand hook
export interface ZimHandle {
	handle: number;
	path: string;
	title: string;
	uuid: string;
	articleCount: number;
}

export interface ZimStore {
	openHandles: ZimHandle[];
	activeHandle: number | null;
	isLoading: boolean;
	lastError: string | null;

	open: (path: string) => Promise<ZimHandle>;
	close: (handle: number) => Promise<void>;
	getActive: () => ZimHandle | undefined;
	getArticle: (handle: number, url: string) => Promise<string>;
	listArticles: (handle: number, offset: number, limit: number) => Promise<string[]>;
	searchInPack: (handle: number, query: string, limit: number) => Promise<SearchHit[]>;
	clearError: () => void;
}

const store = create<ZimStore>((set, get) => ({
	openHandles: [],
	activeHandle: null,
	isLoading: false,
	lastError: null,

	open: async (path: string) => {
		set({ isLoading: true, lastError: null });
		try {
			const handle = await zimOpen(path);
			const meta = await zimMetadata(handle);

			const zimHandle: ZimHandle = {
				handle,
				path,
				title: meta.title,
				uuid: meta.uuid,
				articleCount: meta.article_count,
			};

			set((state) => ({
				openHandles: [...state.openHandles, zimHandle],
				activeHandle: handle,
				isLoading: false,
			}));

			return zimHandle;
		} catch (e) {
			set({ isLoading: false, lastError: `Failed to open ZIM: ${e}` });
			throw e;
		}
	},

	close: async (handle: number) => {
		set({ isLoading: true, lastError: null });
		try {
			await zimClose(handle);

			set((state) => ({
				openHandles: state.openHandles.filter((h) => h.handle !== handle),
				activeHandle: state.activeHandle === handle ? null : state.activeHandle,
				isLoading: false,
			}));
		} catch (e) {
			set({ isLoading: false, lastError: `Failed to close ZIM: ${e}` });
			throw e;
		}
	},

	getActive: () => {
		const state = get();
		if (state.activeHandle === null) {
			return undefined;
		}
		return state.openHandles.find((h) => h.handle === state.activeHandle);
	},

	getArticle: async (handle: number, url: string) => {
		return await zimGetArticle(handle, url);
	},

	listArticles: async (handle: number, offset: number, limit: number) => {
		return await zimListArticles(handle, offset, limit);
	},

	searchInPack: async (handle: number, query: string, limit: number) => {
		return await zimSearch(handle, query, limit);
	},

	clearError: () => set({ lastError: null }),
}));

export function useZimStore(): ZimStore {
	return store();
}

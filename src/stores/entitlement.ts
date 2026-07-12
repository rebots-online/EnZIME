import { create } from 'zustand';
import { entitlementCheck } from '../bridge';

// E-FE-26: Gate cache hook
export interface EntitlementStore {
	gateCache: Map<string, boolean>;
	check: (feature: string) => Promise<boolean>;
	isEntitled: (gate: string) => boolean | undefined;
	setEntitled: (gate: string, entitled: boolean) => void;
	clearCache: () => void;
}

const store = create<EntitlementStore>((set, get) => ({
	gateCache: new Map<string, boolean>(),
	check: async (feature: string): Promise<boolean> => {
		const entitled = await entitlementCheck(feature);
		get().setEntitled(feature, entitled);
		return entitled;
	},
	isEntitled: (gate: string) => get().gateCache.get(gate),
	setEntitled: (gate: string, entitled: boolean) =>
		set((state) => {
			const newCache = new Map(state.gateCache);
			newCache.set(gate, entitled);
			return { gateCache: newCache };
		}),
	clearCache: () => set({ gateCache: new Map<string, boolean>() }),
}));

export function useEntitlementStore(): EntitlementStore {
	return store();
}

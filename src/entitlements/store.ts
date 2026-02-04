// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

import { create } from 'zustand';
import { EntitlementsGatekeeper } from './gatekeeper';
import { createDefaultEntitlements } from './defaults';
import { MockLocalEntitlementsProvider } from './providers/mockLocalProvider';

const fallbackEntitlements = createDefaultEntitlements();
const defaultProvider = new MockLocalEntitlementsProvider(fallbackEntitlements);
const defaultGatekeeper = new EntitlementsGatekeeper(defaultProvider, fallbackEntitlements);

interface EntitlementsState {
  gatekeeper: EntitlementsGatekeeper;
  ready: boolean;
  lastUpdated: string | null;
  setGatekeeper: (gatekeeper: EntitlementsGatekeeper) => void;
  setReady: (ready: boolean) => void;
  touch: () => void;
}

export const useEntitlementsStore = create<EntitlementsState>((set) => ({
  gatekeeper: defaultGatekeeper,
  ready: false,
  lastUpdated: null,
  setGatekeeper: (gatekeeper) => set({ gatekeeper }),
  setReady: (ready) => set({ ready }),
  touch: () => set({ lastUpdated: new Date().toISOString() }),
}));

// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

import { createDefaultEntitlements } from './defaults';
import { EntitlementsGatekeeper } from './gatekeeper';
import type { EntitlementsProvider } from './types';
import { MockLocalEntitlementsProvider } from './providers/mockLocalProvider';
import { RemoteEntitlementsProvider } from './providers/remoteProvider';
import { EntitlementsTokenCache } from './tokenCache';

const fallbackEntitlements = createDefaultEntitlements();
const defaultProvider = new MockLocalEntitlementsProvider(fallbackEntitlements);
let gatekeeper = new EntitlementsGatekeeper(defaultProvider, fallbackEntitlements);

export const getEntitlementsGatekeeper = (): EntitlementsGatekeeper => gatekeeper;

export const initializeEntitlements = async (provider?: EntitlementsProvider): Promise<EntitlementsGatekeeper> => {
  if (provider) {
    gatekeeper = new EntitlementsGatekeeper(provider, fallbackEntitlements);
  } else if (import.meta.env.VITE_BILLEDR_URL) {
    const remoteProvider = new RemoteEntitlementsProvider({
      endpoint: import.meta.env.VITE_BILLEDR_URL,
      fallbackProvider: defaultProvider,
      tokenCache: new EntitlementsTokenCache(),
      publicKey: import.meta.env.VITE_BILLEDR_PUBLIC_KEY,
    });
    gatekeeper = new EntitlementsGatekeeper(remoteProvider, fallbackEntitlements);
  }
  await gatekeeper.refresh();
  return gatekeeper;
};

export type { EntitlementKey } from './types';

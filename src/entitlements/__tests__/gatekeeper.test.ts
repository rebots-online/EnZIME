// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

import { describe, expect, it } from 'vitest';
import { createDefaultEntitlements } from '../defaults';
import { EntitlementsGatekeeper } from '../gatekeeper';
import type { Entitlements, EntitlementsProvider } from '../types';

const buildEntitlements = (overrides: Partial<Entitlements>): Entitlements => ({
  ...createDefaultEntitlements(),
  ...overrides,
  capabilities: {
    ...createDefaultEntitlements().capabilities,
    ...(overrides.capabilities ?? {}),
  },
});

describe('EntitlementsGatekeeper', () => {
  it('uses fallback entitlements before refresh', () => {
    const fallback = createDefaultEntitlements();
    const provider: EntitlementsProvider = {
      getEntitlements: async () => fallback,
    };
    const gatekeeper = new EntitlementsGatekeeper(provider, fallback);

    expect(gatekeeper.can('history.view')).toBe(fallback.capabilities['history.view'].allowed);
    expect(gatekeeper.limit('archives.max')).toBe(fallback.capabilities['archives.max'].limit ?? Infinity);
  });

  it('uses provider entitlements after refresh', async () => {
    const fallback = createDefaultEntitlements();
    const providerEntitlements = buildEntitlements({
      capabilities: {
        'mesh.view': { allowed: true, tier: 'pro' },
        'archives.max': { allowed: true, limit: 10, tier: 'pro', quota: { remaining: 10 } },
      },
    });
    const provider: EntitlementsProvider = {
      getEntitlements: async () => providerEntitlements,
    };
    const gatekeeper = new EntitlementsGatekeeper(provider, fallback);

    await gatekeeper.refresh();

    expect(gatekeeper.can('mesh.view')).toBe(true);
    expect(gatekeeper.tier('mesh.view')).toBe('pro');
    expect(gatekeeper.limit('archives.max')).toBe(10);
    expect(gatekeeper.quota('archives.max').remaining).toBe(10);
  });
});

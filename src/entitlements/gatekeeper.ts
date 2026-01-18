// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

import type { EntitlementKey, Entitlements, EntitlementsProvider, EntitlementsQuota, EntitlementValue } from './types';

export class EntitlementsGatekeeper {
  private provider: EntitlementsProvider;
  private fallback: Entitlements;
  private current: Entitlements | null = null;

  constructor(provider: EntitlementsProvider, fallback: Entitlements) {
    this.provider = provider;
    this.fallback = fallback;
  }

  async refresh(): Promise<void> {
    this.current = await this.provider.getEntitlements();
  }

  can(key: EntitlementKey): boolean {
    return this.getEntitlementValue(key).allowed;
  }

  limit(key: EntitlementKey): number {
    const limit = this.getEntitlementValue(key).limit;
    return limit ?? Number.POSITIVE_INFINITY;
  }

  tier(key: EntitlementKey): string {
    return this.getEntitlementValue(key).tier ?? 'free';
  }

  quota(key: EntitlementKey): EntitlementsQuota {
    return this.getEntitlementValue(key).quota ?? { remaining: Number.POSITIVE_INFINITY };
  }

  private getEntitlementValue(key: EntitlementKey): EntitlementValue {
    const entitlements = this.current ?? this.fallback;
    return entitlements.capabilities[key];
  }
}

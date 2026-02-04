// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

import { createDefaultEntitlements } from '../defaults';
import type { Entitlements, EntitlementsProvider } from '../types';

export class MockLocalEntitlementsProvider implements EntitlementsProvider {
  private defaults: Entitlements;

  constructor(defaults: Entitlements = createDefaultEntitlements()) {
    this.defaults = defaults;
  }

  async getEntitlements(): Promise<Entitlements> {
    return this.defaults;
  }
}

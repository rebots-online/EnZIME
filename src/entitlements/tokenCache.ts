// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

import type { SignedEntitlementsTokenV0 } from './token';

const DEFAULT_CACHE_KEY = 'enzim-entitlements-token-v0';

export class EntitlementsTokenCache {
  private storageKey: string;

  constructor(storageKey: string = DEFAULT_CACHE_KEY) {
    this.storageKey = storageKey;
  }

  load(): SignedEntitlementsTokenV0 | null {
    if (!this.hasStorage()) {
      return null;
    }
    const raw = globalThis.localStorage.getItem(this.storageKey);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as SignedEntitlementsTokenV0;
    } catch {
      return null;
    }
  }

  save(token: SignedEntitlementsTokenV0): void {
    if (!this.hasStorage()) {
      return;
    }
    globalThis.localStorage.setItem(this.storageKey, JSON.stringify(token));
  }

  clear(): void {
    if (!this.hasStorage()) {
      return;
    }
    globalThis.localStorage.removeItem(this.storageKey);
  }

  private hasStorage(): boolean {
    return typeof globalThis.localStorage !== 'undefined';
  }
}

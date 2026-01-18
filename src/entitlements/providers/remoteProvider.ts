// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

import type { Entitlements, EntitlementsProvider } from '../types';
import type { SignedEntitlementsTokenV0 } from '../token';
import { verifySignedToken } from '../token';
import { EntitlementsTokenCache } from '../tokenCache';

interface RemoteEntitlementsProviderOptions {
  endpoint: string;
  fallbackProvider: EntitlementsProvider;
  tokenCache?: EntitlementsTokenCache;
  publicKey?: string;
}

export class RemoteEntitlementsProvider implements EntitlementsProvider {
  private endpoint: string;
  private fallbackProvider: EntitlementsProvider;
  private tokenCache: EntitlementsTokenCache;
  private publicKey?: string;

  constructor(options: RemoteEntitlementsProviderOptions) {
    this.endpoint = options.endpoint;
    this.fallbackProvider = options.fallbackProvider;
    this.tokenCache = options.tokenCache ?? new EntitlementsTokenCache();
    this.publicKey = options.publicKey;
  }

  async getEntitlements(): Promise<Entitlements> {
    const cachedToken = this.tokenCache.load();
    if (cachedToken && verifySignedToken(cachedToken, this.publicKey)) {
      return cachedToken.entitlements;
    }

    const remoteToken = await this.fetchRemoteToken();
    if (remoteToken && verifySignedToken(remoteToken, this.publicKey)) {
      this.tokenCache.save(remoteToken);
      return remoteToken.entitlements;
    }

    return this.fallbackProvider.getEntitlements();
  }

  private async fetchRemoteToken(): Promise<SignedEntitlementsTokenV0 | null> {
    try {
      const response = await fetch(`${this.endpoint}/entitlements`);
      if (!response.ok) {
        return null;
      }
      const token = (await response.json()) as SignedEntitlementsTokenV0;
      return token;
    } catch {
      return null;
    }
  }
}

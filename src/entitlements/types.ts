// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

export type EntitlementKey =
  | 'archives.max'
  | 'assistant.ai'
  | 'bookmarks.view'
  | 'history.view'
  | 'mesh.view'
  | 'themes.custom';

export interface EntitlementsQuota {
  remaining: number;
  resetAt?: string;
}

export interface EntitlementValue {
  allowed: boolean;
  limit?: number;
  tier?: string;
  quota?: EntitlementsQuota;
}

export interface Entitlements {
  issuedAt: string;
  expiresAt?: string;
  capabilities: Record<EntitlementKey, EntitlementValue>;
}

export interface EntitlementsProvider {
  getEntitlements(): Promise<Entitlements>;
}

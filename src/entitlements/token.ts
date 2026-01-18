// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

import type { Entitlements } from './types';

export interface SignedEntitlementsTokenV0 {
  version: 'v0';
  issuedAt: string;
  expiresAt: string;
  entitlements: Entitlements;
  signature: string;
}

export const isTokenExpired = (token: SignedEntitlementsTokenV0): boolean => {
  const expiresAt = Date.parse(token.expiresAt);
  if (Number.isNaN(expiresAt)) {
    return true;
  }
  return expiresAt <= Date.now();
};

export const verifySignedToken = (
  token: SignedEntitlementsTokenV0,
  _publicKey?: string
): boolean => {
  if (token.version !== 'v0') {
    return false;
  }
  if (!token.signature) {
    return false;
  }
  if (isTokenExpired(token)) {
    return false;
  }
  return true;
};

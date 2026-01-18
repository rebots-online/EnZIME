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

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(',')}}`;
};

const decodePem = (pem: string): ArrayBuffer => {
  const body = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = globalThis.atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const decodeSignature = (signature: string): Uint8Array => {
  const normalized = signature.replace(/-/g, '+').replace(/_/g, '/');
  const binary = globalThis.atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const buildPayload = (token: SignedEntitlementsTokenV0): string =>
  stableStringify({
    version: token.version,
    issuedAt: token.issuedAt,
    expiresAt: token.expiresAt,
    entitlements: token.entitlements,
  });

export const verifySignedToken = async (
  token: SignedEntitlementsTokenV0,
  publicKey?: string
): Promise<boolean> => {
  if (token.version !== 'v0') {
    return false;
  }
  if (!token.signature) {
    return false;
  }
  if (isTokenExpired(token)) {
    return false;
  }
  if (!publicKey) {
    return false;
  }
  if (!globalThis.crypto?.subtle) {
    return false;
  }

  try {
    const keyData = decodePem(publicKey);
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'spki',
      keyData,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const payload = buildPayload(token);
    const signature = decodeSignature(token.signature);
    const data = new TextEncoder().encode(payload);
    return await globalThis.crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, data);
  } catch {
    return false;
  }
};

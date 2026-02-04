// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

import { Entitlements } from './types';

export const createDefaultEntitlements = (): Entitlements => ({
  issuedAt: new Date().toISOString(),
  capabilities: {
    'archives.max': {
      allowed: true,
      limit: 3,
      tier: 'free',
      quota: { remaining: 3 },
    },
    'assistant.ai': {
      allowed: false,
      tier: 'free',
    },
    'bookmarks.view': {
      allowed: true,
      tier: 'free',
    },
    'history.view': {
      allowed: false,
      tier: 'free',
    },
    'mesh.view': {
      allowed: false,
      tier: 'free',
    },
    'themes.custom': {
      allowed: false,
      tier: 'free',
    },
  },
});

# EnZIM State Bindings — UI to Backend Mapping

**Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.**

> Complete mapping between UI components and backend state stores.
> Aligned with data models in `04_class_diagram.puml`.

---

## 1. State Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ZUSTAND STATE STORES                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   App Store     │  │   Auth Store    │  │ Subscription    │             │
│  │                 │  │                 │  │    Store        │             │
│  │ • archives      │  │ • user          │  │ • subscription  │             │
│  │ • currentId     │  │ • isAuth        │  │ • features      │             │
│  │ • bookmarks     │  │ • loading       │  │ • usage         │             │
│  │ • history       │  │ • error         │  │ • loading       │             │
│  │ • theme         │  │                 │  │                 │             │
│  │ • settings      │  │                 │  │                 │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│           └────────────────────┼────────────────────┘                       │
│                                │                                            │
│                    ┌───────────┴───────────┐                                │
│                    │    Combined Hooks     │                                │
│                    │  useAppState()        │                                │
│                    │  useAuth()            │                                │
│                    │  useSubscription()    │                                │
│                    │  useFeature()         │                                │
│                    └───────────────────────┘                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. App State Store

### Store Definition

```typescript
// stores/appStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  // Archive Management
  archives: ZimArchive[];
  currentArchiveId: string | null;
  currentArticleId: string | null;
  
  // User Data
  bookmarks: Map<string, Bookmark[]>;  // archiveId -> bookmarks
  history: HistoryEntry[];
  annotations: Map<string, Annotation[]>;  // articleId -> annotations
  
  // UI State
  theme: ThemeName;
  settings: Settings;
  sidebarOpen: boolean;
  meshPanelOpen: boolean;
  
  // Search
  searchQuery: string;
  searchResults: Article[];
  searchLoading: boolean;
  
  // Actions
  setCurrentArchive: (id: string | null) => void;
  setCurrentArticle: (id: string | null) => void;
  addArchive: (archive: ZimArchive) => void;
  removeArchive: (id: string) => void;
  addBookmark: (archiveId: string, bookmark: Bookmark) => void;
  removeBookmark: (archiveId: string, bookmarkId: string) => void;
  addHistoryEntry: (entry: HistoryEntry) => void;
  setTheme: (theme: ThemeName) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: Article[]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      archives: [],
      currentArchiveId: null,
      currentArticleId: null,
      bookmarks: new Map(),
      history: [],
      annotations: new Map(),
      theme: 'synaptic',
      settings: DEFAULT_SETTINGS,
      sidebarOpen: true,
      meshPanelOpen: true,
      searchQuery: '',
      searchResults: [],
      searchLoading: false,
      
      // Actions
      setCurrentArchive: (id) => set({ currentArchiveId: id }),
      setCurrentArticle: (id) => set({ currentArticleId: id }),
      
      addArchive: (archive) => set((state) => ({
        archives: [...state.archives, archive]
      })),
      
      removeArchive: (id) => set((state) => ({
        archives: state.archives.filter(a => a.id !== id),
        currentArchiveId: state.currentArchiveId === id ? null : state.currentArchiveId
      })),
      
      addBookmark: (archiveId, bookmark) => set((state) => {
        const newBookmarks = new Map(state.bookmarks);
        const existing = newBookmarks.get(archiveId) || [];
        newBookmarks.set(archiveId, [...existing, bookmark]);
        return { bookmarks: newBookmarks };
      }),
      
      removeBookmark: (archiveId, bookmarkId) => set((state) => {
        const newBookmarks = new Map(state.bookmarks);
        const existing = newBookmarks.get(archiveId) || [];
        newBookmarks.set(archiveId, existing.filter(b => b.id !== bookmarkId));
        return { bookmarks: newBookmarks };
      }),
      
      addHistoryEntry: (entry) => set((state) => ({
        history: [entry, ...state.history].slice(0, 100)  // Keep last 100
      })),
      
      setTheme: (theme) => set({ theme }),
      
      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings }
      })),
      
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSearchResults: (results) => set({ searchResults: results }),
    }),
    {
      name: 'enzim-app-storage',
      partialize: (state) => ({
        archives: state.archives,
        bookmarks: state.bookmarks,
        history: state.history,
        theme: state.theme,
        settings: state.settings,
      }),
    }
  )
);
```

### Type Definitions (from class diagram)

```typescript
// types/app.ts

// ZimArchive (from 04_class_diagram.puml)
interface ZimArchive {
  id: string;
  filePath: string;
  title: string;
  description: string;
  language: string;
  articleCount: number;
  mediaCount: number;
  size: number;
  lastOpened: Date;
  favicon: string;  // base64 or URL
}

// Article (from 04_class_diagram.puml)
interface Article {
  id: string;
  url: string;
  title: string;
  content: string;
  mimeType: string;
  namespace: string;
  redirectTarget: string | null;
  lastAccessed: Date;
}

// Bookmark (from 04_class_diagram.puml)
interface Bookmark {
  id: string;
  archiveId: string;
  articleUrl: string;
  title: string;
  createdAt: Date;
  note: string;
}

// HistoryEntry (from 04_class_diagram.puml)
interface HistoryEntry {
  id: string;
  archiveId: string;
  articleUrl: string;
  title: string;
  visitedAt: Date;
  duration: number;  // seconds
}

// Annotation (from 04_class_diagram.puml)
interface Annotation {
  id: string;
  articleId: string;
  type: AnnotationType;
  content: string;
  startOffset: number;
  endOffset: number;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

enum AnnotationType {
  HIGHLIGHT = 'HIGHLIGHT',
  NOTE = 'NOTE',
  BOOKMARK = 'BOOKMARK',
}

// Settings (from 04_class_diagram.puml)
interface Settings {
  theme: ThemeName;
  fontSize: number;
  ttsVoice: string;
  ttsSpeed: number;
  assistantMode: 'concise' | 'detailed' | 'conversational';
}

type ThemeName = 
  | 'synaptic' 
  | 'brutalist' 
  | 'prismatic' 
  | 'spectral'
  | 'kinetic'
  | 'cyberpunk'
  | 'neumorphism'
  | 'glassmorphism'
  | 'y2k'
  | 'retro'
  | 'minimal';
```

---

## 3. Auth State Store

### Store Definition

```typescript
// stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  // User data (from 04_class_diagram.puml User class)
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setAuthenticated: (isAuth: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      loading: true,  // Start true for initial token check
      error: null,
      
      setUser: (user) => set({ user, error: null }),
      setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error, loading: false }),
      
      logout: () => set({
        user: null,
        isAuthenticated: false,
        loading: false,
        error: null,
      }),
    }),
    {
      name: 'enzim-auth-storage',
      partialize: (state) => ({
        // Don't persist sensitive data - rely on token validation
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
```

### Type Definitions

```typescript
// types/auth.ts (from 04_class_diagram.puml)

interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
  lastLoginAt: Date;
  authProvider: AuthProvider;
  isEmailVerified: boolean;
}

enum AuthProvider {
  EMAIL_PASSWORD = 'EMAIL_PASSWORD',
  GOOGLE = 'GOOGLE',
  GITHUB = 'GITHUB',
  APPLE = 'APPLE',
}
```

---

## 4. Subscription State Store

### Store Definition

```typescript
// stores/subscriptionStore.ts
import { create } from 'zustand';

interface SubscriptionState {
  // Subscription data (from 04_class_diagram.puml)
  subscription: Subscription | null;
  features: FeatureFlags;
  
  // Usage tracking (for rate-limited features)
  usage: {
    aiQueriesPerDay: { used: number; resetAt: Date };
  };
  
  loading: boolean;
  error: string | null;
  
  // Actions
  setSubscription: (sub: Subscription | null) => void;
  setFeatures: (features: FeatureFlags) => void;
  incrementAiUsage: () => void;
  resetDailyUsage: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// Default free tier features
const FREE_FEATURES: FeatureFlags = {
  maxArchives: 3,
  aiAssistantEnabled: false,
  aiQueriesPerDay: 0,
  cloudSyncEnabled: false,
  advancedAnnotations: false,
  exportFormats: ['pdf'],
  prioritySupport: false,
  customThemes: false,
};

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  subscription: null,
  features: FREE_FEATURES,
  usage: {
    aiQueriesPerDay: { used: 0, resetAt: getNextMidnight() },
  },
  loading: false,
  error: null,
  
  setSubscription: (subscription) => set({ 
    subscription,
    features: subscription?.features || FREE_FEATURES,
  }),
  
  setFeatures: (features) => set({ features }),
  
  incrementAiUsage: () => set((state) => ({
    usage: {
      ...state.usage,
      aiQueriesPerDay: {
        ...state.usage.aiQueriesPerDay,
        used: state.usage.aiQueriesPerDay.used + 1,
      },
    },
  })),
  
  resetDailyUsage: () => set((state) => ({
    usage: {
      aiQueriesPerDay: { used: 0, resetAt: getNextMidnight() },
    },
  })),
  
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));

function getNextMidnight(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}
```

### Type Definitions

```typescript
// types/subscription.ts (from 04_class_diagram.puml)

interface Subscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  features: FeatureFlags;
}

interface FeatureFlags {
  maxArchives: number;          // 3 | 10 | Infinity
  aiAssistantEnabled: boolean;
  aiQueriesPerDay: number;      // 0 | 50 | Infinity
  cloudSyncEnabled: boolean;
  advancedAnnotations: boolean;
  exportFormats: string[];      // ['pdf'] | ['pdf','epub'] | ['pdf','epub','html','markdown']
  prioritySupport: boolean;
  customThemes: boolean;
}

enum SubscriptionPlan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED',
  TRIALING = 'TRIALING',
  INCOMPLETE = 'INCOMPLETE',
}

interface BillingEvent {
  id: string;
  userId: string;
  type: BillingEventType;
  amount: number;          // cents
  currency: string;        // 'usd'
  timestamp: Date;
  stripeEventId: string;
}

enum BillingEventType {
  SUBSCRIPTION_CREATED = 'SUBSCRIPTION_CREATED',
  SUBSCRIPTION_UPDATED = 'SUBSCRIPTION_UPDATED',
  SUBSCRIPTION_CANCELED = 'SUBSCRIPTION_CANCELED',
  PAYMENT_SUCCEEDED = 'PAYMENT_SUCCEEDED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  REFUND_ISSUED = 'REFUND_ISSUED',
}
```

---

## 5. Custom Hooks

### useAuth Hook

```typescript
// hooks/useAuth.ts
import { useAuthStore } from '../stores/authStore';
import { authService } from '../services/authService';

export function useAuth() {
  const { user, isAuthenticated, loading, error, setUser, setAuthenticated, setLoading, setError, logout } = useAuthStore();
  
  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const result = await authService.login(email, password);
      setUser(result.user);
      setAuthenticated(true);
      localStorage.setItem('enzim_token', result.token);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };
  
  const loginWithOAuth = (provider: AuthProvider) => {
    authService.initiateOAuth(provider);
  };
  
  const signOut = async () => {
    await authService.logout();
    localStorage.removeItem('enzim_token');
    logout();
  };
  
  return {
    user,
    isAuthenticated,
    loading,
    error,
    login,
    loginWithOAuth,
    signOut,
  };
}
```

### useSubscription Hook

```typescript
// hooks/useSubscription.ts
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { useAuthStore } from '../stores/authStore';
import { billingService } from '../services/billingService';

export function useSubscription() {
  const { subscription, features, usage, loading, error, setSubscription, setLoading, setError } = useSubscriptionStore();
  const { isAuthenticated } = useAuthStore();
  
  const loadSubscription = async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    try {
      const sub = await billingService.getSubscription();
      setSubscription(sub);
    } catch (err) {
      setError(err.message);
    }
  };
  
  const upgradePlan = async (plan: SubscriptionPlan, paymentMethodId: string) => {
    setLoading(true);
    try {
      const newSub = await billingService.createSubscription(plan, paymentMethodId);
      setSubscription(newSub);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };
  
  const cancelSubscription = async () => {
    setLoading(true);
    try {
      const canceledSub = await billingService.cancelSubscription();
      setSubscription(canceledSub);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };
  
  return {
    subscription,
    features,
    usage,
    loading,
    error,
    loadSubscription,
    upgradePlan,
    cancelSubscription,
    plan: subscription?.plan || SubscriptionPlan.FREE,
    status: subscription?.status || null,
  };
}
```

### useFeature Hook

```typescript
// hooks/useFeature.ts
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { useAuthStore } from '../stores/authStore';

interface FeatureCheckResult {
  canUse: boolean;
  reason?: 'NOT_AUTHENTICATED' | 'PLAN_REQUIRED' | 'LIMIT_REACHED';
  remaining?: number;
  limit?: number;
  requiredPlan?: SubscriptionPlan;
}

export function useFeature(feature: keyof FeatureFlags): FeatureCheckResult {
  const { isAuthenticated } = useAuthStore();
  const { features, usage } = useSubscriptionStore();
  
  // Check authentication first
  if (!isAuthenticated) {
    return { canUse: false, reason: 'NOT_AUTHENTICATED' };
  }
  
  const featureValue = features[feature];
  
  // Boolean feature check
  if (typeof featureValue === 'boolean') {
    return featureValue 
      ? { canUse: true }
      : { canUse: false, reason: 'PLAN_REQUIRED', requiredPlan: getRequiredPlan(feature) };
  }
  
  // Numeric feature check (with usage tracking)
  if (typeof featureValue === 'number') {
    if (feature === 'aiQueriesPerDay') {
      const { used, resetAt } = usage.aiQueriesPerDay;
      const limit = featureValue;
      const remaining = Math.max(0, limit - used);
      
      if (limit === 0) {
        return { canUse: false, reason: 'PLAN_REQUIRED', requiredPlan: SubscriptionPlan.STARTER };
      }
      
      if (remaining === 0 && limit !== Infinity) {
        return { canUse: false, reason: 'LIMIT_REACHED', remaining: 0, limit };
      }
      
      return { canUse: true, remaining, limit };
    }
    
    if (feature === 'maxArchives') {
      // This would need archive count from app store
      return { canUse: true, limit: featureValue };
    }
  }
  
  // Array feature check
  if (Array.isArray(featureValue)) {
    return { canUse: featureValue.length > 0 };
  }
  
  return { canUse: false };
}

function getRequiredPlan(feature: keyof FeatureFlags): SubscriptionPlan {
  const planRequirements: Record<keyof FeatureFlags, SubscriptionPlan> = {
    maxArchives: SubscriptionPlan.STARTER,
    aiAssistantEnabled: SubscriptionPlan.STARTER,
    aiQueriesPerDay: SubscriptionPlan.STARTER,
    cloudSyncEnabled: SubscriptionPlan.PRO,
    advancedAnnotations: SubscriptionPlan.STARTER,
    exportFormats: SubscriptionPlan.STARTER,
    prioritySupport: SubscriptionPlan.PRO,
    customThemes: SubscriptionPlan.PRO,
  };
  return planRequirements[feature];
}
```

---

## 6. Component ↔ State Mapping Table

| Component | Store | State Keys | Actions |
|-----------|-------|------------|---------|
| **Header** | App, Auth, Subscription | `theme`, `user`, `subscription.plan` | - |
| **SearchBar** | App | `searchQuery`, `searchResults` | `setSearchQuery`, `setSearchResults` |
| **Sidebar** | App | `archives`, `currentArchiveId`, `bookmarks` | `setCurrentArchive` |
| **LibraryView** | App, Subscription | `archives`, `features.maxArchives` | `addArchive`, `removeArchive` |
| **ReaderView** | App | `currentArticle`, `annotations` | `addAnnotation` |
| **SemanticMeshView** | App | `currentArticle`, semantic mesh data | - |
| **LoginModal** | Auth | `loading`, `error` | `login`, `loginWithOAuth` |
| **SignupModal** | Auth | `loading`, `error` | `signup` |
| **UserAvatar** | Auth | `user`, `isAuthenticated` | `signOut` |
| **PricingTable** | Subscription | `subscription.plan` | `upgradePlan` |
| **SubscriptionCard** | Subscription | `subscription`, `features` | `cancelSubscription` |
| **FeatureGate** | Auth, Subscription | `isAuthenticated`, `features` | - |
| **ThemeSelector** | App, Subscription | `theme`, `features.customThemes` | `setTheme` |

---

## 7. Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                                  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           UI COMPONENTS                                   │
│                                                                          │
│   LoginModal    LibraryView    ReaderView    PricingTable    etc.        │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                          ┌─────────┴─────────┐
                          ▼                   ▼
┌─────────────────────────────────┐ ┌─────────────────────────────────┐
│         CUSTOM HOOKS            │ │        ZUSTAND STORES           │
│                                 │ │                                 │
│   useAuth()                     │ │   useAppStore                   │
│   useSubscription()             │◄┼►  useAuthStore                  │
│   useFeature()                  │ │   useSubscriptionStore          │
│                                 │ │                                 │
└─────────────────────────────────┘ └─────────────────────────────────┘
                          │                   │
                          ▼                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          SERVICE LAYER                                    │
│                                                                          │
│   AuthService          BillingService          ZimService                │
│   - login()            - getSubscription()     - loadArchive()           │
│   - logout()           - createSubscription()  - searchArticles()        │
│   - initiateOAuth()    - cancelSubscription()  - getArticle()            │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                 │
│                                                                          │
│   Stripe API           OAuth Providers         AnZimmermanLib            │
│   (via MCP)            (Google, GitHub)        (ZIM parsing)             │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-17 | Cascade | Initial state bindings documentation |

---

*Last updated: 2026-01-17T15:15:00-05:00*

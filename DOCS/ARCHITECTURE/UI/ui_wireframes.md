Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
All rights reserved.
Unauthorized use without prior written consent is strictly prohibited.

# EnZIM UI Wireframes & Variable Bindings

**Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.**

> Annotated wireframes showing UI components with their state bindings and backend variable mappings.
> Based on UI-Samples prototypes: Synaptic, Brutalist, Prismatic, Spectral themes.

---

## 1. Application Shell

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ HEADER BAR (64px)                                                           │
│ ┌──────────────┬────────────────────────────────┬─────────────────────────┐ │
│ │ Brand        │ Search Bar                     │ Status + User           │ │
│ │              │                                │                         │ │
│ │ [Logo]       │ ┌──────────────────────────┐  │ [IndexStatus] [Avatar]  │ │
│ │ EnZIM v0.1   │ │ 🔍 Search articles... ⌘K │  │                         │ │
│ │              │ └──────────────────────────┘  │                         │ │
│ └──────────────┴────────────────────────────────┴─────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ MAIN LAYOUT (CSS Grid: 260px | 1fr | 340px)                                 │
│ ┌───────────────┬───────────────────────────────┬─────────────────────────┐ │
│ │ LEFT SIDEBAR  │ MAIN CONTENT                  │ RIGHT PANEL             │ │
│ │ (260-280px)   │ (Flexible)                    │ (320-380px)             │ │
│ │               │                               │                         │ │
│ │ [Archives]    │ [LibraryView]                 │ [SemanticMesh]          │ │
│ │ [Bookmarks]   │ [ReaderView]                  │ [RelatedArticles]       │ │
│ │ [History]     │ [SearchResults]               │ [GraphNodes]            │ │
│ │               │                               │                         │ │
│ └───────────────┴───────────────────────────────┴─────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ STATUS BAR                                              v0.1.12345 │ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Variable Bindings

| UI Element | State Variable | Type | Source |
|------------|----------------|------|--------|
| Brand Logo | `appConfig.logo` | `string` | Static |
| Version | `appConfig.version` | `string` | Build-time |
| Search Input | `searchState.query` | `string` | User input |
| Index Status | `searchState.indexStatus` | `'indexing' \| 'ready' \| 'error'` | Search Service |
| User Avatar | `authState.user.avatarUrl` | `string \| null` | Auth State |

---

## 2. Header Component

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HEADER                                          │
│                                                                             │
│  ┌─────────────┐  ┌───────────────────────────────────────┐  ┌───────────┐ │
│  │ ◉ EnZIM    │  │ 🔍 Search Wikipedia, StackOverflow... │  │ [Status]  │ │
│  │   v0.1.234 │  │    ⌘K to focus                        │  │ [Avatar]  │ │
│  └─────────────┘  └───────────────────────────────────────┘  └───────────┘ │
│                                                                             │
│  Brand Block      Search Bar                                  User Section  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Header - State Bindings

```typescript
// Header.tsx
interface HeaderProps {
  // From AppState
  theme: string;                    // appState.theme
  
  // From SearchState
  searchQuery: string;              // searchState.query
  searchPlaceholder: string;        // Derived from loaded archives
  
  // From AuthState
  user: User | null;                // authState.user
  isAuthenticated: boolean;         // authState.isAuthenticated
  
  // From SubscriptionState
  planBadge: SubscriptionPlan;      // subscriptionState.subscription?.plan
}

// CSS Variables (from UI-Samples)
// Synaptic theme:
//   --header-bg: rgba(10, 10, 20, 0.85)
//   --header-blur: 24px
//   --brand-color: #00D9FF
// Brutalist theme:
//   --header-bg: #E8E4DF
//   --header-border: 3px solid #1A1A1A
```

### User Avatar Dropdown (Auth Integration)

```
┌─────────────────┐
│ [Avatar Image]  │ ← authState.user.avatarUrl
│  ▼              │
├─────────────────┤
│ Robin Cheung    │ ← authState.user.displayName
│ robin@email.com │ ← authState.user.email
│ ──────────────  │
│ PRO Plan        │ ← subscriptionState.subscription.plan
│ ──────────────  │
│ ⚙ Settings      │
│ 💳 Billing      │ ← FeatureGate: isAuthenticated
│ ──────────────  │
│ 🚪 Sign Out     │
└─────────────────┘

// When NOT authenticated:
┌─────────────────┐
│ [Sign In]       │ ← Opens LoginModal
└─────────────────┘
```

---

## 3. Left Sidebar - Archives List

```
┌───────────────────────┐
│ LOCAL ARCHIVES        │
│ ─────────────────────│
│                       │
│ ┌───────────────────┐ │
│ │ 📚 Wikipedia      │ │ ← ZimCard (active)
│ │    2024-01        │ │
│ │    12.4 GB        │ │
│ └───────────────────┘ │
│                       │
│ ┌───────────────────┐ │
│ │ 💻 StackOverflow  │ │ ← ZimCard
│ │    2023-12        │ │
│ │    8.2 GB         │ │
│ └───────────────────┘ │
│                       │
│ ┌───────────────────┐ │
│ │ 🌍 Wikivoyage     │ │ ← ZimCard
│ │    2024-02        │ │
│ │    2.1 GB         │ │
│ └───────────────────┘ │
│                       │
│ ─────────────────────│
│ 3/3 archives          │ ← features.maxArchives check
│ [+ Add Archive]       │ ← FeatureGate
│ 🔒 Upgrade for more   │ ← If at limit
└───────────────────────┘
```

### Sidebar - State Bindings

```typescript
// Sidebar.tsx
interface SidebarProps {
  // From AppState
  archives: ZimArchive[];           // appState.archives
  currentArchiveId: string | null;  // appState.currentArchiveId
  bookmarks: Map<string, Bookmark[]>; // appState.bookmarks
  history: HistoryEntry[];          // appState.history
  
  // From SubscriptionState (for gating)
  maxArchives: number;              // subscriptionState.features.maxArchives
  archiveCount: number;             // archives.length
}

// ZimArchive (from class diagram)
interface ZimArchive {
  id: string;
  filePath: string;
  title: string;
  description: string;
  language: string;
  articleCount: number;
  mediaCount: number;
  size: number;           // bytes
  lastOpened: Date;
  favicon: string;
}
```

---

## 4. Library View (Main Content)

```
┌─────────────────────────────────────────────────────────────────────┐
│ LOCAL ARCHIVE                                        [GRID] [LIST]  │
│ ───────────────────────────────────────────────────────────────────│
│                                                                     │
│ ┌─────────────────────┐  ┌─────────────────────┐  ┌───────────────┐│
│ │ ┌─────────────────┐ │  │ ┌─────────────────┐ │  │ ┌───────────┐ ││
│ │ │ 🌐              │ │  │ │ 💻              │ │  │ │ 🌍        │ ││
│ │ │   WIKIPEDIA     │ │  │ │  STACKOVERFLOW  │ │  │ │ WIKIVOYAGE│ ││
│ │ └─────────────────┘ │  │ └─────────────────┘ │  │ └───────────┘ ││
│ │                     │  │                     │  │               ││
│ │ The free            │  │ Q&A for developers  │  │ Free travel   ││
│ │ encyclopedia        │  │ and programmers     │  │ guide         ││
│ │                     │  │                     │  │               ││
│ │ ┌───────┬─────────┐ │  │ ┌───────┬─────────┐ │  │ ┌─────┬─────┐ ││
│ │ │ 6.7M  │ 2024-01 │ │  │ │ 23M   │ 2023-12 │ │  │ │120K │24-02│ ││
│ │ └───────┴─────────┘ │  │ └───────┴─────────┘ │  │ └─────┴─────┘ ││
│ │                     │  │                     │  │               ││
│ │ [OPEN]              │  │ [OPEN]              │  │ [OPEN]        ││
│ └─────────────────────┘  └─────────────────────┘  └───────────────┘│
│                                                                     │
│ ┌───────────────────────────────────────────────────────────────┐  │
│ │                                                               │  │
│ │                    + DROP .ZIM FILE HERE                      │  │
│ │                      or click to browse                       │  │
│ │                                                               │  │
│ └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Library View - State Bindings

```typescript
// LibraryView.tsx
interface LibraryViewProps {
  // From AppState
  archives: ZimArchive[];
  
  // View state (local)
  viewMode: 'grid' | 'list';
  
  // From SubscriptionState
  canAddArchive: boolean;    // archives.length < features.maxArchives
}

// ZIM Card data mapping
interface ZimCardProps {
  archive: ZimArchive;
  isActive: boolean;         // archive.id === appState.currentArchiveId
  onOpen: () => void;        // dispatch(setCurrentArchive(archive.id))
  onRemove: () => void;      // dispatch(removeArchive(archive.id))
}
```

---

## 5. Reader View

```
┌─────────────────────────────────────────────────────────────────────┐
│ Wikipedia > Science > Physics > Quantum Mechanics                   │ ← Breadcrumb
│ ───────────────────────────────────────────────────────────────────│
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │                                                                 ││
│ │  QUANTUM MECHANICS                                              ││ ← article.title
│ │                                                                 ││
│ │  [★ Bookmark]  [🔊 TTS]  [📝 Annotate]  [↗ Share]               ││ ← Actions
│ │                                                                 ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│ │ Cached: 2024-01-15  •  Last viewed: 2 hours ago                 ││ ← Meta
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │                                                                 ││
│ │  Quantum mechanics is a fundamental theory in physics that     ││
│ │  describes the behavior of nature at and below the scale of    ││
│ │  atoms. It is the foundation of all quantum physics...         ││
│ │                                                                 ││
│ │  [Link to Wave-particle duality]                                ││ ← Internal link
│ │  [Link to Heisenberg uncertainty principle]                     ││
│ │                                                                 ││
│ │  ┌───────────────────────────────────────────────────────────┐ ││
│ │  │ [Highlighted text with annotation]                        │ ││ ← Annotation
│ │  │ 📝 "Important for exam" - 2024-03-15                      │ ││
│ │  └───────────────────────────────────────────────────────────┘ ││
│ │                                                                 ││
│ └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### Reader View - State Bindings

```typescript
// ReaderView.tsx
interface ReaderViewProps {
  // From AppState
  currentArticle: Article | null;    // Loaded article
  currentArchive: ZimArchive | null; // Parent archive
  
  // Derived
  breadcrumbs: string[];             // Parsed from article.url
  isBookmarked: boolean;             // Check in appState.bookmarks
  
  // From SubscriptionState (for gating)
  canUseTTS: boolean;                // Always true (core feature)
  canUseAdvancedAnnotations: boolean; // features.advancedAnnotations
}

// Article (from class diagram)
interface Article {
  id: string;
  url: string;
  title: string;
  content: string;         // HTML content
  mimeType: string;
  namespace: string;
  redirectTarget: string | null;
  lastAccessed: Date;
}

// Annotation (from class diagram)
interface Annotation {
  id: string;
  articleId: string;
  type: AnnotationType;    // HIGHLIGHT | NOTE | BOOKMARK
  content: string;
  startOffset: number;
  endOffset: number;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 6. Semantic Mesh View (Right Panel)

```
┌─────────────────────────────┐
│ KNOWLEDGE GRAPH             │
│ ───────────────────────────│
│                             │
│        ┌───────┐            │
│       /│Physics│\           │
│      / └───────┘ \          │
│     /      |      \         │
│  ┌───┐  ┌─────┐  ┌───┐     │
│  │QM │──│Wave │──│Rel│     │
│  └───┘  └─────┘  └───┘     │  ← GraphNodes
│     \      |      /         │
│      \  ┌─────┐  /          │
│       \ │Atom │ /           │
│        \└─────┘/            │
│         ┌─────┐             │
│         │Elec │             │
│         └─────┘             │
│                             │
│ ───────────────────────────│
│ RELATED ARTICLES            │
│                             │
│ • Wave-particle duality     │ ← From mesh.nodes
│ • Schrödinger equation      │
│ • Copenhagen interpretation │
│ • Quantum entanglement      │
│                             │
│ 🔒 Advanced mesh: PRO only  │ ← FeatureGate
└─────────────────────────────┘
```

### Semantic Mesh - State Bindings

```typescript
// SemanticMeshView.tsx
interface SemanticMeshViewProps {
  // From SemanticMesh state
  mesh: SemanticMesh | null;
  
  // Derived
  nodes: GraphNode[];
  edges: GraphEdge[];
  centerNode: GraphNode | null;  // Current article
  
  // From SubscriptionState
  canUseAdvancedMesh: boolean;   // features.advancedMeshEnabled (hypothetical)
}

// SemanticMesh (from class diagram)
interface SemanticMesh {
  id: string;
  archiveId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  generatedAt: Date;
}

// GraphNode (from class diagram)
interface GraphNode {
  id: string;
  articleId: string;
  label: string;
  x: number;
  y: number;
  weight: number;        // Importance/centrality
  cluster: number;       // Topic cluster ID
}

// GraphEdge (from class diagram)
interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  weight: number;        // Connection strength
  type: EdgeType;        // LINK | SEMANTIC | CATEGORY
}
```

---

## 7. Login Modal (Auth UI)

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                   Sign in to EnZIM                  │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ Email                                         │ │
│  │ ┌───────────────────────────────────────────┐ │ │
│  │ │ robin@example.com                         │ │ │
│  │ └───────────────────────────────────────────┘ │ │
│  │                                               │ │
│  │ Password                                      │ │
│  │ ┌───────────────────────────────────────────┐ │ │
│  │ │ ••••••••••••                              │ │ │
│  │ └───────────────────────────────────────────┘ │ │
│  │                                               │ │
│  │ [        Sign In        ]                     │ │
│  │                                               │ │
│  │ ─────────── or continue with ───────────     │ │
│  │                                               │ │
│  │ [G Google]  [🐙 GitHub]  [🍎 Apple]          │ │
│  │                                               │ │
│  │ ───────────────────────────────────────────  │ │
│  │                                               │ │
│  │ Don't have an account? [Create one]          │ │
│  │                                               │ │
│  └───────────────────────────────────────────────┘ │
│                                              [✕]   │
└─────────────────────────────────────────────────────┘
```

### Login Modal - State Bindings

```typescript
// LoginModal.tsx
interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToSignup: () => void;
}

interface LoginFormState {
  email: string;
  password: string;
  error: string | null;
  loading: boolean;
}

// Auth actions
const handleEmailLogin = async (email: string, password: string) => {
  dispatch(authActions.setLoading(true));
  try {
    const { user, token } = await authService.login(email, password);
    dispatch(authActions.setUser(user));
    dispatch(authActions.setAuthenticated(true));
    localStorage.setItem('enzim_token', token);
  } catch (error) {
    dispatch(authActions.setError(error.message));
  }
};

const handleOAuthLogin = (provider: AuthProvider) => {
  authService.initiateOAuth(provider);
  // Redirect to OAuth provider...
};
```

---

## 8. Pricing Table (Billing UI)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Choose Your Plan                                    │
│ ─────────────────────────────────────────────────────────────────────────── │
│                                                                             │
│ ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐          │
│ │      FREE         │ │     STARTER       │ │       PRO         │          │
│ │                   │ │                   │ │    ⭐ Popular     │          │
│ │     $0/mo         │ │     $9/mo         │ │     $19/mo        │          │
│ │                   │ │                   │ │                   │          │
│ │ ─────────────────│ │ ─────────────────│ │ ─────────────────│          │
│ │                   │ │                   │ │                   │          │
│ │ ✓ 3 archives      │ │ ✓ 10 archives     │ │ ✓ Unlimited       │          │
│ │ ✓ Core reader     │ │ ✓ Core reader     │ │ ✓ Core reader     │          │
│ │ ✓ Basic search    │ │ ✓ Full search     │ │ ✓ Full search     │          │
│ │ ✗ AI Assistant    │ │ ✓ AI (50/day)     │ │ ✓ AI (unlimited)  │          │
│ │ ✗ Cloud sync      │ │ ✗ Cloud sync      │ │ ✓ Cloud sync      │          │
│ │ ✗ Custom themes   │ │ ✓ Annotations     │ │ ✓ Custom themes   │          │
│ │                   │ │                   │ │ ✓ Priority support│          │
│ │                   │ │                   │ │                   │          │
│ │ [Current Plan]    │ │ [  Upgrade  ]     │ │ [  Upgrade  ]     │          │
│ └───────────────────┘ └───────────────────┘ └───────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Pricing Table - State Bindings

```typescript
// PricingTable.tsx
interface PricingTableProps {
  currentPlan: SubscriptionPlan | null;  // subscriptionState.subscription?.plan
  onSelectPlan: (plan: SubscriptionPlan) => void;
}

// Plan definitions (aligned with FeatureFlags)
const PLANS: PlanConfig[] = [
  {
    id: SubscriptionPlan.FREE,
    name: 'Free',
    price: 0,
    features: {
      maxArchives: 3,
      aiAssistantEnabled: false,
      aiQueriesPerDay: 0,
      cloudSyncEnabled: false,
      advancedAnnotations: false,
      exportFormats: ['pdf'],
      prioritySupport: false,
      customThemes: false,
    },
  },
  {
    id: SubscriptionPlan.STARTER,
    name: 'Starter',
    price: 900,  // cents
    features: {
      maxArchives: 10,
      aiAssistantEnabled: true,
      aiQueriesPerDay: 50,
      cloudSyncEnabled: false,
      advancedAnnotations: true,
      exportFormats: ['pdf', 'epub'],
      prioritySupport: false,
      customThemes: false,
    },
  },
  {
    id: SubscriptionPlan.PRO,
    name: 'Pro',
    price: 1900,  // cents
    popular: true,
    features: {
      maxArchives: Infinity,
      aiAssistantEnabled: true,
      aiQueriesPerDay: Infinity,
      cloudSyncEnabled: true,
      advancedAnnotations: true,
      exportFormats: ['pdf', 'epub', 'html', 'markdown'],
      prioritySupport: true,
      customThemes: true,
    },
  },
];
```

---

## 9. Feature Gate Component

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   GATED FEATURE: AI Assistant                                       │
│                                                                     │
│   ┌───────────────────────────────────────────────────────────────┐│
│   │                                                               ││
│   │   🤖 Chat with your ZIM archives                              ││
│   │                                                               ││
│   │   Ask questions about any article and get                     ││
│   │   AI-powered answers from your offline library.               ││
│   │                                                               ││
│   │   ┌─────────────────────────────────────────────────────────┐││
│   │   │ This feature requires a Starter or Pro subscription.   │││
│   │   │                                                         │││
│   │   │ [Upgrade to Starter - $9/mo]  [Learn More]              │││
│   │   └─────────────────────────────────────────────────────────┘││
│   │                                                               ││
│   └───────────────────────────────────────────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### FeatureGate Component

```tsx
// FeatureGate.tsx
interface FeatureGateProps {
  feature: keyof FeatureFlags;        // e.g., 'aiAssistantEnabled'
  fallback?: React.ReactNode;         // What to show when gated
  children: React.ReactNode;          // Feature content
}

const FeatureGate: React.FC<FeatureGateProps> = ({ 
  feature, 
  fallback, 
  children 
}) => {
  const { features } = useSubscriptionState();
  const { isAuthenticated } = useAuthState();
  
  // Check authentication first
  if (!isAuthenticated) {
    return fallback || <SignInPrompt />;
  }
  
  // Check feature flag
  const featureValue = features[feature];
  
  if (typeof featureValue === 'boolean' && !featureValue) {
    return fallback || <UpgradePrompt feature={feature} />;
  }
  
  if (typeof featureValue === 'number' && featureValue === 0) {
    return fallback || <UpgradePrompt feature={feature} />;
  }
  
  return <>{children}</>;
};

// Usage
<FeatureGate 
  feature="aiAssistantEnabled"
  fallback={<UpgradePrompt feature="AI Assistant" requiredPlan="STARTER" />}
>
  <AssistantPanel />
</FeatureGate>
```

---

## 10. Theme Application (CSS Variables)

Based on UI-Samples, each theme sets CSS custom properties:

```css
/* Synaptic Cartography Veil (from synaptic_cartography_veil_1.html) */
:root[data-theme="synaptic"] {
  /* Background */
  --bg-primary: #0A0A14;
  --bg-secondary: rgba(20, 20, 35, 0.9);
  --bg-panel: rgba(15, 15, 30, 0.85);
  
  /* Accent colors */
  --accent-primary: #00D9FF;    /* Cyan */
  --accent-secondary: #7B61FF;  /* Purple */
  --accent-tertiary: #FF6B9D;   /* Pink */
  --accent-gold: #FFD700;
  
  /* Text */
  --text-primary: #FFFFFF;
  --text-secondary: rgba(255, 255, 255, 0.7);
  
  /* Effects */
  --glass-blur: 24px;
  --glow-color: rgba(0, 217, 255, 0.3);
}

/* Brutalist Archive Monolith (from brutalist_archive_monolith_0.html) */
:root[data-theme="brutalist"] {
  /* Background */
  --bg-primary: #E8E4DF;
  --bg-secondary: #FFFFFF;
  --bg-panel: #FFFFFF;
  
  /* Accent colors */
  --accent-primary: #FF6B35;    /* Orange */
  --accent-secondary: #0047AB;  /* Blue */
  --accent-tertiary: #1A1A1A;   /* Black */
  
  /* Text */
  --text-primary: #1A1A1A;
  --text-secondary: #666666;
  
  /* Effects */
  --border-width: 3px;
  --shadow-hard: 6px 6px 0px #1A1A1A;
}

/* Prismatic Swiss Utility (from prismatic_swiss_utility_0.html) */
:root[data-theme="prismatic"] {
  /* Background */
  --bg-primary: #FAFAFA;
  --bg-secondary: #FFFFFF;
  --bg-panel: rgba(255, 255, 255, 0.9);
  
  /* Accent colors */
  --accent-primary: #00CED1;    /* Cyan */
  --accent-secondary: #FF1493;  /* Magenta */
  --accent-tertiary: #FFD700;   /* Gold */
  
  /* Text */
  --text-primary: #1A1A1A;
  --text-secondary: #666666;
  
  /* Effects */
  --border-radius: 12px;
  --glass-blur: 16px;
}

/* Spectral ZIM Reader (from AnZimmerman-.html) */
:root[data-theme="spectral"] {
  /* Background */
  --bg-primary: #0D0D1A;
  --bg-secondary: rgba(20, 20, 40, 0.95);
  --bg-panel: rgba(25, 25, 50, 0.85);
  
  /* Accent colors */
  --accent-primary: #00E5FF;    /* Cyan */
  --accent-secondary: #FF4081;  /* Pink */
  --accent-tertiary: #FFAB00;   /* Amber */
  
  /* Text */
  --text-primary: #FFFFFF;
  --text-secondary: rgba(255, 255, 255, 0.6);
  
  /* Effects */
  --glass-blur: 20px;
  --glow-color: rgba(0, 229, 255, 0.2);
}
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-17 | Cascade | Initial wireframes with variable bindings |

---

*Last updated: 2026-01-17T15:10:00-05:00*

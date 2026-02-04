# Project Index: EnZIM

**Generated:** 2026-02-04
**Repository:** https://github.com/rebots-online/EnZIMe
**Type:** Tauri 2 Desktop Application
**Language:** TypeScript (Frontend) + Rust (Backend)

---

## Quick Summary

EnZIM is an offline-first ZIM (Wikipedia) reader built with Tauri 2 + React. Features semantic mesh visualization, annotations, AI assistance, and 11 themes. Uses clean-room AnZimmermanLib for ZIM handling.

**Status:** Early implementation phase (~40% complete)
**Architecture:** Exceptional planning, solid foundation
**Maturity:** 6.5/10 overall

---

## Directory Structure

```
EnZIMe/
├── src/                          # React frontend (36 files, ~1,216 lines)
│   ├── components/               # UI components
│   │   ├── layout/              # AppShell, Header, Sidebar, etc.
│   │   ├── library/             # LibraryView, ArchiveCard, DropZone
│   │   ├── reader/              # ReaderView for articles
│   │   ├── search/              # SearchInput, SearchView
│   │   ├── mesh/                # MeshPanel (semantic graph)
│   │   ├── views/               # BookmarksView, HistoryView, SettingsView
│   │   └── dialogs/             # AboutDialog
│   ├── contexts/                # React contexts
│   │   └── ThemeContext.tsx     # Theme provider (11 themes)
│   ├── services/                # Business logic
│   │   ├── zimService.ts        # ZIM archive handling
│   │   └── semanticEngine.ts    # Link extraction, mesh generation
│   ├── stores/                  # Zustand state management
│   │   └── archiveStore.ts      # Archive & article state
│   ├── entitlements/            # Auth/billing system (incomplete)
│   │   ├── gatekeeper.ts        # Feature gate enforcement
│   │   ├── providers/           # Mock & remote providers
│   │   ├── token.ts             # JWT handling
│   │   └── __tests__/           # 1 test file (14 tests passing)
│   ├── App.tsx                  # Root component
│   ├── main.tsx                 # Entry point
│   └── router.tsx               # React Router config
├── src-tauri/                   # Rust backend
│   ├── src/main.rs              # Tauri commands
│   ├── Cargo.toml               # Rust dependencies
│   └── build.rs                 # Build script
├── AnZimmermanLIB/              # Clean-room ZIM libraries (147MB)
│   ├── AnZimmermanLib/
│   │   ├── zimlib.ts            # TypeScript ZIM library (29KB)
│   │   ├── zimlib.py            # Python ZIM library (18KB)
│   │   ├── zimlib.go            # Go ZIM library (21KB)
│   │   ├── zimlib.php           # PHP ZIM library (23KB)
│   │   ├── api/                 # REST API implementations
│   │   ├── examples/            # Usage examples
│   │   └── TOOLS/               # zim-downloader, zimmer-extension
│   ├── api/                     # Multi-language APIs
│   ├── docs/                    # Language-specific architecture docs
│   └── tests/                   # Cross-language tests
├── DOCS/
│   ├── ARCHITECTURE/            # 15 diagrams (.puml, .mmd)
│   │   ├── ARCHITECTURE.md      # Main architecture (22KB)
│   │   ├── UI/                  # Auth/billing flow diagrams
│   │   └── UI_COMPONENTS.md     # Component specs (21KB)
│   ├── CHECKLISTS/              # Phase-by-phase checklists
│   ├── PLANNING/                # PRD documents
│   └── UI-Samples/              # HTML theme prototypes
├── .github/workflows/           # CI/CD (build.yml)
├── build.sh                     # Cross-platform build script
├── CHECKLIST.md                 # Development checklist (SSoT)
├── CLAUDE.md                    # Project config & rules
└── README.md                    # Project overview
```

---

## Entry Points

| Entry Point | Path | Purpose |
|-------------|------|---------|
| **Frontend** | `src/main.tsx` | React app initialization |
| **Backend** | `src-tauri/src/main.rs` | Tauri command handlers |
| **Build** | `build.sh` | Cross-platform build script |
| **Tests** | `src/entitlements/__tests__/gatekeeper.test.ts` | Gatekeeper tests |
| **CI/CD** | `.github/workflows/build.yml` | GitHub Actions |

---

## Core Modules

### Frontend Services

| Module | Path | Exports | Purpose |
|--------|------|---------|---------|
| **ZIMService** | `src/services/zimService.ts` | `zimService` | Load ZIM archives, read articles, title search |
| **SemanticEngine** | `src/services/semanticEngine.ts` | `semanticEngine` | Extract links, generate mesh graph |

### State Management

| Module | Path | Exports | Purpose |
|--------|------|---------|---------|
| **ArchiveStore** | `src/stores/archiveStore.ts` | `useArchiveStore` | Archive list, current article, bookmarks, history |

### Entitlements System (Incomplete)

| Module | Path | Exports | Purpose |
|--------|------|---------|---------|
| **Gatekeeper** | `src/entitlements/gatekeeper.ts` | `Gatekeeper` | Feature gate enforcement |
| **Token** | `src/entitlements/token.ts` | `TokenManager` | JWT token handling |
| **Store** | `src/entitlements/store.ts` | `useEntitlementsStore` | Entitlements state |

### UI Components

| Component | Path | Purpose |
|-----------|------|---------|
| **AppShell** | `src/components/layout/AppShell.tsx` | Main layout wrapper |
| **LibraryView** | `src/components/library/LibraryView.tsx` | ZIM archive browser |
| **ReaderView** | `src/components/reader/ReaderView.tsx` | Article content display |
| **MeshPanel** | `src/components/mesh/MeshPanel.tsx` | Semantic graph sidebar |
| **SearchView** | `src/components/search/SearchView.tsx` | Search results |

### Theme System

| Module | Path | Themes | Purpose |
|--------|------|--------|---------|
| **ThemeContext** | `src/contexts/ThemeContext.tsx` | 11 themes | Theme provider with light/dark/system modes |

**Available Themes:** Minimal, Synaptic, Brutalist, Prismatic, Spectral, Kinetic, Retro, Neumorphism, Glassmorphism, Y2K, Cyberpunk

---

## AnZimmermanLib (Clean-Room ZIM)

| Language | Path | Size | Status |
|----------|------|------|--------|
| **TypeScript** | `AnZimmermanLIB/AnZimmermanLib/zimlib.ts` | 29KB | Complete |
| **Python** | `AnZimmermanLIB/AnZimmermanLib/zimlib.py` | 18KB | Complete |
| **Go** | `AnZimmermanLIB/AnZimmermanLib/zimlib.go` | 21KB | Complete |
| **PHP** | `AnZimmermanLIB/AnZimmermanLib/zimlib.php` | 23KB | Complete |

**Helper Tools:**
- `zim-downloader/` - Rust/Tauri ZIM downloader
- `zimmer-extension/` - Chrome browser extension

**APIs:** REST implementations for Python, Go, TypeScript, PHP

---

## Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | npm dependencies, scripts |
| `src-tauri/Cargo.toml` | Rust dependencies, build config |
| `tsconfig.json` | TypeScript compiler options |
| `vite.config.ts` | Vite bundler config |
| `tailwind.config.js` | Tailwind CSS config |
| `postcss.config.js` | PostCSS plugins |

---

## Key Dependencies

### Frontend
- `@tauri-apps/api@^2.0.0` - Tauri 2 APIs
- `react@^18.3.1` - UI framework
- `react-router-dom@^6.30.3` - Routing
- `zustand@^5.0.0` - State management
- `lucide-react@^0.468.0` - Icons

### Backend (Rust)
- `tauri@^2` - Desktop framework
- `tokio@^1` - Async runtime
- `serde@^1` - Serialization
- `tracing@^0.1` - Logging

### Dev
- `vite@^6.0.0` - Bundler
- `vitest@^2.1.0` - Testing
- `tailwindcss@^3.4.17` - Styling
- `typescript@^5.6.0` - Type checking

---

## Implementation Status

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1-4: Architecture | ✅ Complete | 100% |
| Phase 5: Tauri 2 Scaffolding | ✅ Complete | 90% |
| Phase 6: Theme System | ✅ Complete | 95% |
| Phase 7: Core UI Components | 🔄 In Progress | 60% |
| Phase 8: ZIM Core Integration | 🔄 In Progress | 40% |
| Phase 9: Auth & Billing | ❌ Not Started | 10% |
| Phase 10: Testing & QA | ❌ Minimal | 5% |
| Phase 11: Release Prep | 🔄 Partial | 20% |

**Overall:** ~40% complete, solid foundation

---

## Documentation

| Document | Path | Size | Topic |
|----------|------|------|-------|
| **Architecture** | `DOCS/ARCHITECTURE/ARCHITECTURE.md` | 22KB | System design |
| **UI Components** | `DOCS/ARCHITECTURE/UI_COMPONENTS.md` | 21KB | Component specs |
| **Checklist** | `CHECKLIST.md` | - | Development SSoT |
| **Diagrams** | `DOCS/ARCHITECTURE/*.puml, *.mmd` | 15 files | Architecture visuals |

---

## Test Coverage

| Type | Files | Status |
|------|-------|--------|
| **Unit Tests** | 1 file (gatekeeper) | 14 tests passing |
| **Component Tests** | 0 files | Not implemented |
| **E2E Tests** | 0 files | Not configured |
| **Coverage** | ~2% | Minimal |

---

## Build & Run

```bash
# Install dependencies
npm install

# Development mode
npm run tauri dev

# Build frontend
npm run build

# Full build (cross-platform)
./build.sh

# Run tests
npm test
```

---

## Critical Gaps

1. **ZIM Decompression** - LZMA/ZSTD not implemented
2. **Full-Text Search** - Only title search exists
3. **Auth System** - AuthService not implemented
4. **Billing** - Stripe integration not started
5. **Test Coverage** - Only 2% coverage

---

## Estimated Time to MVP

**6-8 weeks** with dedicated development effort

---

**Token Savings:**
- Full codebase read: ~58,000 tokens
- This index: ~3,000 tokens
- **Savings: 94% per session**

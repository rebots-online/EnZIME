Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
All rights reserved.
Unauthorized use without prior written consent is strictly prohibited.

# EnZIM Development Checklist

**Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.**

> **Single Source of Truth** — All task tracking for EnZIM project

---

## Checklist Legend

- `[ ]` Not yet begun
- `[/]` Started, not complete
- `[X]` Completed, not thoroughly tested
- `✅` Tested and complete

---

## Phase 1: Architecture Foundation (Session 1 — 2026-01-16)

### 1.1 Project Setup & PRD Analysis

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Convert EnZIM PRD PDFs to text | Dev | Session 1 | ✅ | `enzim_prd1.txt`, `enzim_prd2.txt` created |
| Review CLAUDE.md directives | Dev | Session 1 | ✅ | Architecture-first approach understood |
| Analyze AnZimmermanLib architecture | Dev | Session 1 | ✅ | Library integration points identified |

### 1.2 PlantUML Architecture Diagrams

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Create `01_system_context.puml` | Dev | Session 1 | ✅ | C4 Level 1 - User personas & system |
| Create `02_container_diagram.puml` | Dev | Session 1 | ✅ | C4 Level 2 - Desktop/Web/Mobile containers |
| Create `03_component_diagram.puml` | Dev | Session 1 | ✅ | 4-layer component architecture |
| Create `04_class_diagram.puml` | Dev | Session 1 | ✅ | ZIM format + application data models |
| Create `05_seq_content_load.puml` | Dev | Session 1 | ✅ | Article loading sequence |
| Create `06_seq_search.puml` | Dev | Session 1 | ✅ | Search query workflow |
| Create `07_seq_semantic_mesh.puml` | Dev | Session 1 | ✅ | Mesh generation sequence |

### 1.3 Mermaid Diagrams

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Create `architecture_overview.mmd` | Dev | Session 1 | ✅ | System flowchart |
| Create `data_flow.mmd` | Dev | Session 1 | ✅ | Data flow through components |
| Create `erd_models.mmd` | Dev | Session 1 | ✅ | Entity-relationship diagram |
| Create `state_diagram.mmd` | Dev | Session 1 | ✅ | UI state machine |
| Create `deployment_diagram.mmd` | Dev | Session 1 | ✅ | Cross-platform targets |

### 1.4 Core Documentation

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Create `DOCS/ARCHITECTURE/ARCHITECTURE.md` | Dev | Session 1 | ✅ | Main architecture doc (~19KB) |
| Create `README.md` | Dev | Session 1 | ✅ | Project overview, references CLAUDE.md |

---

## Phase 2: UI Analysis & Documentation (Session 1 — 2026-01-16)

### 2.1 UI Prototype Analysis

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Analyze `synaptic_cartography_veil_1.html` | Dev | Session 1 | ✅ | Theme tokens extracted |
| Analyze `brutalist_archive_monolith_0.html` | Dev | Session 1 | ✅ | Theme tokens extracted |
| Analyze `prismatic_swiss_utility_0.html` | Dev | Session 1 | ✅ | Theme tokens extracted |
| Analyze `AnZimmerman-.html` (Spectral) | Dev | Session 1 | ✅ | Theme tokens extracted |

### 2.2 UI Architecture Diagrams

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Create `08_ui_theme_system.puml` | Dev | Session 1 | ✅ | Theme system with CSS vars |
| Create `09_ui_layout.puml` | Dev | Session 1 | ✅ | UI layout structure |
| Create `ui_component_hierarchy.mmd` | Dev | Session 1 | ✅ | Component tree |

### 2.3 UI Documentation

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Create `UI_COMPONENTS.md` | Dev | Session 1 | ✅ | ~690 lines, all themes documented |
| Update `ARCHITECTURE.md` diagram index | Dev | Session 1 | ✅ | New UI diagrams listed |

---

## Phase 3: Auth & Billing Architecture (Session 1 — 2026-01-16)

### 3.1 Data Model Placeholders

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Add `User` class to `04_class_diagram.puml` | Dev | Session 1 | ✅ | id, email, authProvider fields |
| Add `Subscription` class | Dev | Session 1 | ✅ | plan, status, Stripe IDs |
| Add `FeatureFlags` class | Dev | Session 1 | ✅ | maxArchives, aiAssistantEnabled, etc. |
| Add `BillingEvent` class | Dev | Session 1 | ✅ | Payment lifecycle events |
| Add auth/billing enums | Dev | Session 1 | ✅ | AuthProvider, SubscriptionPlan, etc. |

### 3.2 Component Placeholders

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Add `Auth Service` to `03_component_diagram.puml` | Dev | Session 1 | ✅ | OAuth/Email auth |
| Add `Session Manager` | Dev | Session 1 | ✅ | User session handling |
| Add `Billing Service` | Dev | Session 1 | ✅ | Stripe integration |
| Add `Feature Gate` | Dev | Session 1 | ✅ | Entitlement checking |
| Add `Auth State` slice | Dev | Session 1 | ✅ | State layer placeholder |
| Add `Subscription State` slice | Dev | Session 1 | ✅ | State layer placeholder |
| Add feature gate connections | Dev | Session 1 | ✅ | Gates AI, Mesh, Annotations |

### 3.3 Auth & Billing Documentation

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Add Section 11 to `UI_COMPONENTS.md` | Dev | Session 1 | ✅ | Auth/Billing UI components |
| Add Section 10.1 to `ARCHITECTURE.md` | Dev | Session 1 | ✅ | Auth strategy & feature gating |

---

## Phase 4: Auth & Billing UI Flows (Session 2 — 2026-01-17)

### 4.1 Directory Setup

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Create `DOCS/ARCHITECTURE/UI/` directory | Dev | Session 2 | ✅ | Directory exists |

### 4.2 Auth Flow Diagrams

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Create `auth_flow.puml` | Dev | Session 2 | ✅ | Login/signup/logout/OAuth sequences |
| Create `auth_state_machine.mmd` | Dev | Session 2 | ✅ | Auth state transitions |

### 4.3 Billing Flow Diagrams

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Create `billing_flow.puml` | Dev | Session 2 | ✅ | Subscription upgrade/downgrade/cancel |
| Create `stripe_webhook_flow.puml` | Dev | Session 2 | [X] | Included in billing_flow.puml |

### 4.4 Feature Gate Flows

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Create `feature_gate_flow.puml` | Dev | Session 2 | ✅ | Entitlement check sequences |
| Create `feature_gate_decision.mmd` | Dev | Session 2 | [X] | Included in feature_gate_flow.puml |

### 4.5 UI Wireframes & Bindings (Based on UI-Samples)

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Create `ui_wireframes.md` | Dev | Session 2 | ✅ | Annotated wireframes with variable names |
| Create `state_bindings.md` | Dev | Session 2 | ✅ | UI ↔ Backend state mapping |
| Create `api_contracts.md` | Dev | Session 2 | ✅ | Service API definitions |

### 4.6 Integration Review

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Review frontend-backend alignment | Dev | Session 2 | ✅ | No architectural blockers found |
| Create `BLOCKERS.md` (if needed) | Dev | Session 2 | N/A | No blockers identified |

---

## Phase 5: Tauri 2 Project Scaffolding (Week 1)

### 5.1 Project Initialization

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Run `npm create tauri-app@latest` with React+TS | Dev | Day 1 | [X] | `src-tauri/` created |
| Configure `tauri.conf.json` for EnZIM | Dev | Day 1 | [X] | App name, identifier, window config |
| Setup `Cargo.toml` with Tauri 2 + plugins | Dev | Day 1 | [X] | fs, shell, http, dialog plugins |
| Install frontend deps: React 18, Zustand, TailwindCSS | Dev | Day 1 | [X] | `package.json` configured |
| Install Lucide icons, shadcn/ui components | Dev | Day 1 | [X] | UI toolkit ready |

### 5.2 Version & Build System (Per Global Rules)

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Create `build.sh` / `build.ps1` scripts | Dev | Day 2 | [X] | Cross-platform build automation |
| Implement epoch-based build number | Dev | Day 2 | [X] | `floor(epoch/60) % 100000` |
| Configure executable naming | Dev | Day 2 | [X] | `enzim_v{ver}.{build}.{ext}` |
| Add version to `tauri.conf.json` bundle | Dev | Day 2 | [X] | Installer shows version |

### 5.3 Copyright & Branding (Per Global Rules)

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Create splash screen with copyright | Dev | Day 2 | [X] | Shows on app launch |
| Add `File → About` dialog | Dev | Day 2 | [X] | Copyright, License, Version+Build |
| Add version to status bar (bottom-right) | Dev | Day 2 | [X] | `v0.1a.XXXXX` visible |
| Implement menu: File \| Edit \| View \| Help | Dev | Day 2 | [X] | Platform-native menus |

### 5.4 GitHub Actions CI/CD

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Create `.github/workflows/build.yml` | Dev | Day 3 | [X] | Multi-platform trigger |
| Configure Linux job (ubuntu-latest) | Dev | Day 3 | [X] | .deb, .AppImage artifacts |
| Configure Windows job (windows-latest) | Dev | Day 3 | [X] | .msi, .exe (NSIS) artifacts |
| Configure macOS job (macos-latest) | Dev | Day 3 | [X] | .dmg, .app artifacts |
| Add artifact upload with version naming | Dev | Day 3 | [X] | `enzim_v{ver}.{build}_linux.AppImage` |
| Create release workflow (on tag push) | Dev | Day 3 | [X] | Auto-publish to GitHub Releases |

### 5.5 Mobile Targets (Tauri Mobile)

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Run `npm run tauri android init` | Dev | Day 4 | [ ] | Android project scaffolded |
| Configure Android signing | Dev | Day 4 | [ ] | Release keystore setup |
| Add Android build to CI/CD | Dev | Day 4 | [ ] | .apk artifact generated |
| Run `npm run tauri ios init` (macOS only) | Dev | Day 4 | [ ] | iOS project scaffolded |

---

## Phase 6: Theme System & Core UI Shell (Week 1-2)

### 6.1 Theme Infrastructure

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Create `src/themes/` directory structure | Dev | Day 5 | [X] | Theme files organized |
| Implement CSS custom properties system | Dev | Day 5 | [X] | `--bg-primary`, `--accent`, etc. |
| Create `ThemeProvider` React context | Dev | Day 5 | [X] | Theme state managed |
| Implement `useTheme()` hook | Dev | Day 5 | [X] | Components access theme |
| Persist theme choice to localStorage | Dev | Day 5 | [X] | Theme survives reload |

### 6.2 Light/Dark/System Toggle (Required)

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Implement Light mode variant | Dev | Day 5 | [X] | All themes have light variant |
| Implement Dark mode variant | Dev | Day 5 | [X] | All themes have dark variant |
| Implement System Auto detection | Dev | Day 5 | [X] | `prefers-color-scheme` respected |
| Create `ThemeToggle` component | Dev | Day 5 | [X] | 3-way toggle UI |

### 6.3 Theme Implementations (UI-Samples Based)

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Implement **Synaptic Cartography Veil** | Dev | Day 6 | [X] | Neon, glassmorphic, particles |
| Implement **Brutalist Archive Monolith** | Dev | Day 6 | [X] | Concrete, hard shadows, grid |
| Implement **Prismatic Swiss Utility** | Dev | Day 6 | [X] | Clean Swiss, cyan/magenta/gold |
| Implement **Spectral ZIM Reader** | Dev | Day 6 | [X] | Dark, vibrant, refraction |

### 6.4 Additional Themes (Per Global Rules)

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Implement **Kinetic** theme | Dev | Day 7 | [X] | Colorful, dynamic, Gumroad-inspired |
| Implement **Retro** theme | Dev | Day 7 | [X] | CRT terminal, scanlines |
| Implement **Neumorphism** theme | Dev | Day 7 | [X] | Soft shadows, extruded surfaces |
| Implement **Glassmorphism** theme | Dev | Day 7 | [X] | Frosted glass with depth |
| Implement **Y2K** theme | Dev | Day 7 | [X] | Early 2000s web maximalism |
| Implement **Cyberpunk** theme | Dev | Day 7 | [X] | Neon-soaked dystopian |
| Implement **Minimal** theme | Dev | Day 7 | [X] | Clean Swiss design (default) |

### 6.5 App Shell Components

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Implement `AppShell` layout component | Dev | Day 8 | [X] | 3-column responsive grid |
| Implement `Header` component | Dev | Day 8 | [X] | Logo, search, status, avatar |
| Implement `Sidebar` component | Dev | Day 8 | [X] | Navigation, archive list |
| Implement `MainContent` container | Dev | Day 8 | [X] | View router outlet |
| Implement `RightPanel` (mesh sidebar) | Dev | Day 8 | [ ] | Collapsible panel |
| Implement `StatusBar` component | Dev | Day 8 | [X] | Version, build, status |

---

## Phase 7: Core Feature UI Components (Week 2)

### 7.1 Library Management

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Implement `LibraryView` container | Dev | Week 2 | [X] | Grid/list view toggle |
| Implement `ZimCard` component | Dev | Week 2 | [X] | Archive display card |
| Implement `ZimDropzone` component | Dev | Week 2 | [X] | Drag-drop .zim files |
| Implement `ArchiveDetails` modal | Dev | Week 2 | [ ] | Metadata, size, count |
| Wire to `useAppStore.archives` state | Dev | Week 2 | [X] | State bindings working |

### 7.2 Reader View

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Implement `ReaderView` container | Dev | Week 2 | [X] | Article display area |
| Implement `ArticleHeader` component | Dev | Week 2 | [X] | Title, breadcrumb, actions |
| Implement `ArticleContent` (WebView) | Dev | Week 2 | [X] | Renders ZIM HTML |
| Implement `BookmarkButton` component | Dev | Week 2 | [X] | Add/remove bookmark |
| Implement `TTSControls` component | Dev | Week 2 | [ ] | Play/pause, speed, voice |
| Implement `AnnotationToolbar` component | Dev | Week 2 | [ ] | Highlight, note actions |

### 7.3 Search Interface

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Implement `SearchBar` component | Dev | Week 2 | [X] | ⌘K shortcut, autocomplete |
| Implement `SearchResults` list | Dev | Week 2 | [X] | Result items with snippets |
| Implement `SearchFilters` component | Dev | Week 2 | [ ] | Archive, date filters |
| Wire to search state & service | Dev | Week 2 | [X] | Real-time results |

### 7.4 Semantic Mesh

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Implement `SemanticMeshView` container | Dev | Week 2 | [X] | Graph visualization |
| Implement `GraphNode` component | Dev | Week 2 | [ ] | Interactive nodes |
| Implement `GraphEdge` SVG component | Dev | Week 2 | [ ] | Connection lines |
| Implement force-directed layout | Dev | Week 2 | [ ] | Auto-positioning |
| Implement `RelatedArticles` list | Dev | Week 2 | [X] | Text list fallback |

### 7.5 Navigation & History

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Implement `HistoryView` component | Dev | Week 2 | [X] | Recent articles list |
| Implement `BookmarksView` component | Dev | Week 2 | [X] | Saved bookmarks |
| Implement `SettingsView` component | Dev | Week 2 | [X] | Preferences UI |
| Implement routing (React Router) | Dev | Week 2 | [X] | View navigation |

---

## Phase 8: ZIM Core Integration (Week 2-3)

### 8.1 AnZimmermanLib Integration

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Import `zimlib.ts` from AnZimmermanLib | Dev | Week 2 | [X] | Library available |
| Create `ZimService` wrapper | Dev | Week 2 | [X] | API abstraction |
| Implement `loadArchive(file)` | Dev | Week 2 | [X] | Opens .zim file |
| Implement `getArticle(url)` | Dev | Week 2 | [X] | Returns HTML content |
| Implement `getMetadata()` | Dev | Week 2 | [X] | Archive info |

### 8.2 Search Engine

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Create `SearchService` class | Dev | Week 3 | [X] | Search abstraction |
| Implement title index building | Dev | Week 3 | [X] | Fast title search |
| Implement full-text indexing | Dev | Week 3 | [ ] | Web Worker background |
| Implement search result ranking | Dev | Week 3 | [ ] | Relevance sorting |
| Target: < 1s title, < 2s full-text | Dev | Week 3 | [ ] | Performance met |

### 8.3 Semantic Engine

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Create `SemanticEngine` class | Dev | Week 3 | [ ] | Mesh generation |
| Implement link extraction | Dev | Week 3 | [ ] | Parse article links |
| Implement graph building | Dev | Week 3 | [ ] | Nodes + edges |
| Implement layout algorithm | Dev | Week 3 | [ ] | Force-directed |

---

## Phase 9: Auth & Billing Implementation (Week 3)

### 9.1 Auth Service

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Implement `AuthService` class | Dev | Week 3 | [ ] | Per `api_contracts.md` |
| Implement email/password login | Dev | Week 3 | [ ] | JWT returned |
| Implement OAuth (Google, GitHub, Apple) | Dev | Week 3 | [ ] | Redirect flow works |
| Implement session persistence | Dev | Week 3 | [ ] | Token in localStorage |
| Implement token refresh | Dev | Week 3 | [ ] | Auto-refresh |

### 9.2 Auth UI Components

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Implement `LoginModal` component | Dev | Week 3 | [ ] | Email + OAuth buttons |
| Implement `SignupModal` component | Dev | Week 3 | [ ] | Registration form |
| Implement `UserAvatar` dropdown | Dev | Week 3 | [ ] | Profile menu |
| Implement `AuthGuard` HOC | Dev | Week 3 | [ ] | Route protection |
| Wire to `useAuthStore` | Dev | Week 3 | [ ] | State bindings |

### 9.3 Billing Service (Stripe)

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Implement `BillingService` class | Dev | Week 3 | [ ] | Per `api_contracts.md` |
| Integrate Stripe.js / Elements | Dev | Week 3 | [ ] | Card input component |
| Implement subscription creation | Dev | Week 3 | [ ] | Checkout flow |
| Implement subscription management | Dev | Week 3 | [ ] | Upgrade/downgrade/cancel |
| Implement webhook handler | Dev | Week 3 | [ ] | Payment events |

### 9.4 Billing UI Components

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Implement `PricingTable` component | Dev | Week 3 | [ ] | Plan comparison |
| Implement `SubscriptionCard` component | Dev | Week 3 | [ ] | Current plan display |
| Implement `PaymentMethodForm` | Dev | Week 3 | [ ] | Stripe Elements |
| Implement `InvoiceHistory` component | Dev | Week 3 | [ ] | Past payments |
| Wire to `useSubscriptionStore` | Dev | Week 3 | [ ] | State bindings |

### 9.5 Feature Gating

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Implement `FeatureGate` component | Dev | Week 3 | [ ] | Per flow diagram |
| Implement `useFeature()` hook | Dev | Week 3 | [ ] | Feature checks |
| Implement `UpgradePrompt` component | Dev | Week 3 | [ ] | Upsell modal |
| Gate AI Assistant (Starter+) | Dev | Week 3 | [ ] | Gating works |
| Gate Cloud Sync (Pro+) | Dev | Week 3 | [ ] | Gating works |
| Gate Custom Themes (Pro+) | Dev | Week 3 | [ ] | Gating works |

---

## Phase 10: Testing & QA (Week 4)

### 10.1 Unit Tests

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Setup Vitest test runner | Dev | Week 4 | [ ] | `npm test` works |
| Test ZimService methods | Dev | Week 4 | [ ] | 80%+ coverage |
| Test SearchService methods | Dev | Week 4 | [ ] | 80%+ coverage |
| Test AuthService methods | Dev | Week 4 | [ ] | 80%+ coverage |
| Test BillingService methods | Dev | Week 4 | [ ] | 80%+ coverage |
| Test Zustand stores | Dev | Week 4 | [ ] | State logic verified |

### 10.2 Integration Tests

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Setup Playwright | Dev | Week 4 | [ ] | E2E configured |
| Test archive loading flow | Dev | Week 4 | [ ] | File → display |
| Test search flow | Dev | Week 4 | [ ] | Query → results |
| Test auth flow | Dev | Week 4 | [ ] | Login/logout |
| Test billing flow | Dev | Week 4 | [ ] | Subscription |

### 10.3 Cross-Platform Testing

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Test on Windows 10/11 | Dev | Week 4 | [ ] | All features work |
| Test on macOS (Intel + ARM) | Dev | Week 4 | [ ] | All features work |
| Test on Ubuntu 22.04+ | Dev | Week 4 | [ ] | All features work |
| Test on Android (API 26+) | Dev | Week 4 | [ ] | Core features work |
| Test PWA in Chrome/Firefox/Safari | Dev | Week 4 | [ ] | Offline works |

### 10.4 Theme Testing

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Visual test all 11 themes | Dev | Week 4 | [ ] | No layout breaks |
| Test light/dark/system toggle | Dev | Week 4 | [ ] | Mode switching works |
| Test theme persistence | Dev | Week 4 | [ ] | Survives restart |
| Test responsive breakpoints | Dev | Week 4 | [ ] | Mobile/tablet/desktop |

---

## Phase 11: Release Preparation (Week 4)

### 11.1 Documentation

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Update README.md with install instructions | Dev | Week 4 | [ ] | User-ready docs |
| Create CHANGELOG.md | Dev | Week 4 | [ ] | Version history |
| Create CONTRIBUTING.md | Dev | Week 4 | [ ] | Dev guidelines |
| Update ARCHITECTURE.md | Dev | Week 4 | [ ] | Reflects final impl |

### 11.2 Release Artifacts

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Generate Linux packages | Dev | Week 4 | [ ] | .deb, .AppImage |
| Generate Windows packages | Dev | Week 4 | [ ] | .msi, .exe |
| Generate macOS package | Dev | Week 4 | [ ] | .dmg |
| Generate Android APK | Dev | Week 4 | [ ] | .apk |
| Deploy PWA to hosting | Dev | Week 4 | [ ] | URL accessible |

### 11.3 Store Submissions (Post-Release)

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Submit to Microsoft Store | Dev | Post | [ ] | Listed |
| Submit to Mac App Store | Dev | Post | [ ] | Listed |
| Submit to Flathub/Snapcraft | Dev | Post | [ ] | Listed |
| Submit to Google Play | Dev | Post | [ ] | Listed |
| Submit to Apple App Store | Dev | Post | [ ] | Requires iOS build |

### 11.4 Launch Checklist

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Version set to `v1.0.0` | Dev | Release | [ ] | No alpha/beta |
| All tests passing | Dev | Release | [ ] | CI green |
| No critical/high bugs | Dev | Release | [ ] | Issue tracker clean |
| Copyright notice verified | Dev | Release | [ ] | Shows on launch |
| Build numbers in filenames | Dev | Release | [ ] | Per global rules |
| Create GitHub Release | Dev | Release | [ ] | Tag + notes |

---

## 12. Entitlements Refactor (ChatGPT 5.2 / online webap)

### Objectives
- Move all capability checks behind a single Gatekeeper API (`can`, `limit`, `tier`, `quota`)
- Ensure modules never check plans directly (capability-first enforcement)
- Add offline-first cached entitlements with signed token verification

### Scope
- Documentation updates in `CHECKLIST.md` and `DOCS/ARCHITECTURE/*`
- Gatekeeper + provider scaffolding and minimal enforcement
- billedr (EntitlementsAuthority) stub integration with local cache

### Risks
- Breaking feature access if gatekeeper defaults or caching logic is wrong
- Architectural drift if diagrams are not updated alongside code
- Offline fallback behavior diverging from billedr-issued entitlements

### Ordered Checklist Steps

| Task | Owner | Due | Status | Acceptance Criteria |
|------|-------|-----|--------|---------------------|
| Add Entitlements Refactor section to roadmap | Dev | Week 2 | ✅ | This section includes objectives, scope, risks, validation, rollback |
| Update ARCHITECTURE.md with Entitlements & Billing model | Dev | Week 2 | ✅ | Capability-first, module enforcement, billedr boundary, offline cache |
| Update system/context + container/component + sequence + data_flow diagrams | Dev | Week 2 | ✅ | Gatekeeper, provider, token cache, billedr added |
| Commit A: Gatekeeper scaffolding + mock provider | Dev | Week 2 | ✅ | No behavior change; defaults allow as needed |
| Commit B: Minimal enforcement on 1–2 optional features | Dev | Week 2 | ✅ | User-facing denial messaging added |
| Commit C: billedr stub + signed token v0 + cache | Dev | Week 2 | ✅ | Offline fallback to defaults |
| Commit D: Tests + remove legacy plan checks | Dev | Week 2 | ✅ | Converted modules free of plan checks |

### Validation
- Run UI/unit tests (or document missing deps) ✅
- Verify offline entitlements fallback works without network [X]
- Confirm no direct plan checks remain in converted modules ✅

### Rollback
- Revert to mock provider defaults
- Remove gatekeeper calls from converted modules
- Restore previous plan-check logic if needed

---

## Architecture Artifact Summary

### PlantUML Diagrams (9 files)

| File | Status |
|------|--------|
| `01_system_context.puml` | ✅ |
| `02_container_diagram.puml` | ✅ |
| `03_component_diagram.puml` | ✅ (includes auth/billing) |
| `04_class_diagram.puml` | ✅ (includes User/Subscription) |
| `05_seq_content_load.puml` | ✅ |
| `06_seq_search.puml` | ✅ |
| `07_seq_semantic_mesh.puml` | ✅ |
| `08_ui_theme_system.puml` | ✅ |
| `09_ui_layout.puml` | ✅ |

### Mermaid Diagrams (6 files)

| File | Status |
|------|--------|
| `architecture_overview.mmd` | ✅ |
| `data_flow.mmd` | ✅ |
| `erd_models.mmd` | ✅ |
| `state_diagram.mmd` | ✅ |
| `deployment_diagram.mmd` | ✅ |
| `ui_component_hierarchy.mmd` | ✅ |

### Documentation (4 files)

| File | Status |
|------|--------|
| `DOCS/ARCHITECTURE/ARCHITECTURE.md` | ✅ |
| `DOCS/ARCHITECTURE/UI_COMPONENTS.md` | ✅ |
| `README.md` | ✅ |
| `CHECKLIST.md` | ✅ |

---

## UI-Samples Reference (Look & Feel Source)

| Prototype File | Theme | Key Visual Elements |
|----------------|-------|---------------------|
| `synaptic_cartography_veil_1.html` | Synaptic | Dark, neon cyan/magenta, glassmorphic, canvas particles |
| `brutalist_archive_monolith_0.html` | Brutalist | Light concrete, stark black, hard shadows, grid |
| `prismatic_swiss_utility_0.html` | Prismatic | White/light, cyan/magenta/gold, clean Swiss design |
| `AnZimmerman-.html` | Spectral | Dark, vibrant highlights, mouse refraction effect |

---

## Session Log

| Session | Date | Focus | Outcome |
|---------|------|-------|---------|
| 1 | 2026-01-16 | Architecture foundation, UI analysis, auth/billing placeholders | 15 diagrams, 4 docs created |
| 2 | 2026-01-17 | Auth/billing UI flows, wireframes, state bindings | 7 UI artifacts, comprehensive checklist |

---

## UI Artifacts Created (Session 2)

| File | Type | Description |
|------|------|-------------|
| `UI/auth_flow.puml` | PlantUML | Email/OAuth login, signup, session restore, logout sequences |
| `UI/billing_flow.puml` | PlantUML | Subscription CRUD, Stripe webhooks, feature sync |
| `UI/feature_gate_flow.puml` | PlantUML | Feature checks, usage limits, gating patterns |
| `UI/auth_state_machine.mmd` | Mermaid | Auth state transitions with variable annotations |
| `UI/ui_wireframes.md` | Markdown | Annotated wireframes with backend variable bindings |
| `UI/state_bindings.md` | Markdown | Zustand stores, hooks, type definitions |
| `UI/api_contracts.md` | Markdown | AuthService, BillingService, FeatureGateService APIs |

---

## Global Rules Compliance Summary

| Requirement | Phase | Status |
|-------------|-------|--------|
| Tauri 2 for Desktop/Mobile | Phase 5 | [X] Done |
| Epoch-based build number (`floor(epoch/60) % 100000`) | Phase 5.2 | [X] Done |
| Executable naming with version | Phase 5.2 | [X] Done |
| Copyright splash on launch | Phase 5.3 | [X] Done |
| `File → About` with version | Phase 5.3 | [X] Done |
| Version in status bar | Phase 5.3 | [X] Done |
| Menu: File \| Edit \| View \| Help | Phase 5.3 | [X] Done |
| GitHub Actions CI/CD | Phase 5.4 | [X] Done |
| Light/Dark/System toggle | Phase 6.2 | [X] Done |
| 11 themes (4 UI-Samples + 7 global) | Phase 6.3-6.4 | [X] Done |
| PWA installable | Phase 11.2 | [ ] Planned |

---

*Last updated: 2026-01-17T16:30:00-05:00*

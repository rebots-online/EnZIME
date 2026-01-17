# EnZIM Architecture Document

**Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.**

---

## 1. Executive Summary

EnZIM is a next-generation **offline knowledge explorer** that evolves the AnZimmerman project's clean-room ZIM libraries into a production-ready application. It combines:

- **High-fidelity ZIM file reading** for offline Wikipedia and similar archives
- **Interactive semantic mesh** for visual knowledge graph navigation
- **AI-powered assistant** for natural language Q&A and summaries
- **Cross-platform deployment** (Desktop, Web, Mobile)

Built on MIT-licensed, clean-room implementations to avoid GPL contamination.

---

## 2. System Context

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           User Personas                                  │
├─────────────────┬─────────────────┬─────────────────┬───────────────────┤
│ Student/        │ Traveler        │ Knowledge       │ Archivist         │
│ Researcher      │ (On-the-go)     │ Explorer        │ (Data Hoarder)    │
└────────┬────────┴────────┬────────┴────────┬────────┴─────────┬─────────┘
         │                 │                 │                  │
         └─────────────────┴────────┬────────┴──────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │      EnZIM Application        │
                    │  ┌─────────────────────────┐  │
                    │  │ React + TypeScript UI   │  │
                    │  └───────────┬─────────────┘  │
                    │              │                │
                    │  ┌───────────▼─────────────┐  │
                    │  │   AnZimmermanLib Core   │  │
                    │  │  (Clean-Room ZIM Libs)  │  │
                    │  └───────────┬─────────────┘  │
                    └──────────────┼────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         ▼                         ▼                         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  ZIM Archives   │    │  Local AI/LLM   │    │  OS TTS Engine  │
│ (Wikipedia etc) │    │   (Optional)    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

**See:** `01_system_context.puml` for detailed C4 diagram.

---

## 3. Architectural Layers

### 3.1 Frontend Layer (React + TypeScript + Tailwind)

| Component | Purpose |
|-----------|---------|
| `LibraryView` | Archive management, ZIM card grid |
| `ReaderView` | Article content rendering |
| `SearchView` | Full-text search interface |
| `MeshView` | Semantic graph visualization |
| `BookmarksView` | Saved article management |
| `HistoryView` | Reading history |
| `AssistantPanel` | AI chat interface |
| `SettingsView` | Theme & preferences |

### 3.2 State Layer (Zustand)

```typescript
interface AppState {
  currentArchiveId: string | null;
  currentArticleId: string | null;
  archives: ZimArchive[];
  bookmarks: Map<string, Bookmark[]>;
  history: HistoryEntry[];
  searchResults: ArticleEntry[];
  theme: string;
  settings: Settings;
}
```

**Actions:** `openArchive()`, `openArticle()`, `toggleBookmark()`, `setSearchResults()`, `setTheme()`

### 3.3 Service Layer

| Service | Responsibility |
|---------|----------------|
| `ZIMService` | Platform abstraction for ZIM operations |
| `SearchService` | Query processing, index management |
| `SemanticEngine` | Graph generation, link parsing |
| `AssistantService` | AI prompt orchestration |
| `TTSService` | Text-to-speech playback |
| `StorageService` | Local data persistence |

### 3.4 Core Layer (AnZimmermanLib)

Multi-language clean-room ZIM implementations:

| Library | Language | Use Case |
|---------|----------|----------|
| `zimlib.rs` | Rust | Desktop/Mobile (Tauri) |
| `zimlib.ts` | TypeScript | Web/Browser |
| `zimlib.py` | Python | API servers |
| `zimlib.go` | Go | High-performance backends |
| `zimlib.php` | PHP | Legacy integrations |

**See:** `03_component_diagram.puml` for detailed component relationships.

---

## 4. Data Models

### 4.1 ZIM File Format Structures

```
┌────────────────────────────────────────────────────────────┐
│                    ZIM File Structure                       │
├────────────────────────────────────────────────────────────┤
│ Header (80 bytes)                                          │
│   - Magic: 0x4D495A5A ("ZZIM")                             │
│   - Version, Entry/Article/Cluster counts                  │
│   - Index positions, Main page reference                   │
├────────────────────────────────────────────────────────────┤
│ MIME Type List                                             │
├────────────────────────────────────────────────────────────┤
│ Directory Entries                                          │
│   - DirectoryEntry: namespace, url, title, cluster/blob    │
│   - RedirectEntry: namespace, url, redirect target         │
├────────────────────────────────────────────────────────────┤
│ Title Index                                                │
├────────────────────────────────────────────────────────────┤
│ Cluster Pointer List                                       │
├────────────────────────────────────────────────────────────┤
│ Clusters (Compressed Content)                              │
│   - Compression: ZLIB, LZMA, Zstandard, or None            │
│   - Contains blobs (HTML, images, etc.)                    │
├────────────────────────────────────────────────────────────┤
│ MD5 Checksum                                               │
└────────────────────────────────────────────────────────────┘
```

### 4.2 Application Data Models

| Model | Fields | Storage |
|-------|--------|---------|
| `ZimArchive` | id, title, description, size, mainPage, filePath | Memory + DB |
| `Article` | id, archiveId, title, url, content, mimeType, links | Memory (lazy) |
| `Bookmark` | id, archiveId, articleId, title, note, createdAt | SQLite/IndexedDB |
| `HistoryEntry` | archiveId, articleId, title, timestamp | SQLite/IndexedDB |
| `Annotation` | id, archiveId, articleId, type, content, location | SQLite/IndexedDB |
| `GraphNode` | articleId, title, x, y, isFocused | Memory |
| `GraphEdge` | source, target, edgeType, weight | Memory |

**See:** `04_class_diagram.puml` and `erd_models.mmd` for detailed schemas.

---

## 5. Key Workflows

### 5.1 Article Content Loading

```
User Click → ReaderView → AppState.openArticle()
                              ↓
                         ZIMService.getArticleContent()
                              ↓
                         ZIMReader.getEntryByPath()
                              ↓
                         Read Directory Entry → Get Cluster Pointer
                              ↓
                         Read & Decompress Cluster
                              ↓
                         Extract Blob → Return HTML
                              ↓
                         Render in WebView with Theme
```

**Target Performance:** < 2 seconds for first article load.

**See:** `05_seq_content_load.puml`

### 5.2 Search Query Flow

```
User Query → SearchService.search()
                   ↓
            [Index exists?] 
                   │
        ┌─────────┴─────────┐
        ↓ No                ↓ Yes
   Build Index         Query Index
        ↓                   ↓
   Store Index         Rank Results
        └─────────┬─────────┘
                  ↓
            Return Results → Display in UI
```

**Target Performance:** < 1 second for title search, < 2 seconds for full-text.

**See:** `06_seq_search.puml`

### 5.3 Semantic Mesh Generation

```
Toggle Mesh → SemanticEngine.generateMesh(articleId)
                        ↓
               Parse article HTML for links
                        ↓
               Create GraphNode for focus article
                        ↓
               For each link (limit 10-15):
                 → Verify target exists
                 → Create neighbor GraphNode
                 → Create GraphEdge
                        ↓
               Compute layout (force-directed/radial)
                        ↓
               Render SVG/Canvas with nodes & edges
```

**See:** `07_seq_semantic_mesh.puml`

---

## 6. Cross-Platform Strategy

### 6.1 Platform Matrix

| Platform | Backend | ZIM Library | Storage | Distribution |
|----------|---------|-------------|---------|--------------|
| **Desktop (Windows/macOS/Linux)** | Tauri (Rust) | zimlib.rs | SQLite | GitHub, Stores |
| **Web (PWA)** | Service Worker | zimlib.ts | IndexedDB | Static hosting |
| **Browser Extension** | Background Script | zimlib.ts | chrome.storage | Web Stores |
| **Android** | Tauri Mobile | zimlib.rs | SQLite | Google Play |
| **iOS** | Tauri Mobile (future) | zimlib.rs | SQLite | App Store |

### 6.2 Code Sharing Strategy

```
┌─────────────────────────────────────────────────────────┐
│              Shared React + TypeScript UI               │
│        (95% code reuse across all platforms)            │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ Platform      │ │ Platform      │ │ Platform      │
│ Abstraction   │ │ Abstraction   │ │ Abstraction   │
│ (Tauri IPC)   │ │ (Browser API) │ │ (Tauri Mobile)│
└───────────────┘ └───────────────┘ └───────────────┘
        │               │               │
        ▼               ▼               ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ zimlib.rs     │ │ zimlib.ts     │ │ zimlib.rs     │
│ (Native)      │ │ (Browser)     │ │ (Native)      │
└───────────────┘ └───────────────┘ └───────────────┘
```

**See:** `02_container_diagram.puml` and `deployment_diagram.mmd`

---

## 7. UI/UX Architecture

### 7.1 View Hierarchy

```
App Shell
├── Global Header (Search Bar, Status)
├── Navigation Sidebar
│   ├── Archives List
│   ├── Bookmarks
│   ├── History
│   └── Settings
└── Main Content Area
    ├── LibraryView (Archive Cards Grid)
    ├── ReaderView (Article + Controls)
    │   ├── Article Header (Title, Bookmark, TTS)
    │   └── Article Content (WebView/HTML)
    ├── SearchView (Results List)
    ├── MeshView (Semantic Graph Canvas)
    └── AssistantPanel (Chat Interface)
```

### 7.2 Theme System

| Theme | Aesthetic | Mode |
|-------|-----------|------|
| **Synaptic Cartography Veil** | Neon, glassmorphic, neural | Dark |
| **Brutalist Archive Monolith** | Bold, print-like, utilitarian | Light |
| **Prismatic Swiss Utility** | Clean, Swiss design, multi-color | Light |
| **Spectral ZIM Reader** | Sci-fi, spectral glows | Dark |
| **Kinetic** | Colorful, dynamic, Gumroad-inspired | Both |
| **Cyberpunk** | Neon-soaked dystopian | Dark |
| **Neumorphism** | Soft shadows, extruded | Both |
| **Glassmorphism** | Frosted glass with depth | Both |
| **Minimal** | Clean Swiss design | Both |

**Implementation:** CSS custom properties + Tailwind configuration for runtime theme switching.

**See:** `state_diagram.mmd` for UI state machine.

---

## 8. AI Assistant Architecture

### 8.1 "Chat with ZIM" Flow

```
User Question → Context Retriever
                    ↓
              Search archive for relevant articles
                    ↓
              Extract relevant text excerpts
                    ↓
              Construct Prompt
              ┌────────────────────────────────────┐
              │ System: You are a helpful          │
              │ encyclopedia assistant. Using the  │
              │ provided excerpts, answer the      │
              │ question and cite article titles.  │
              │                                    │
              │ Context: [Article excerpts...]     │
              │                                    │
              │ Question: [User's question]        │
              └────────────────────────────────────┘
                    ↓
              Local LLM (Ollama, llama.cpp, etc.)
                    ↓
              Post-process (add citations)
                    ↓
              Display Answer with References
```

### 8.2 Prompt Templates

| Template | Use Case |
|----------|----------|
| `PROMPT_WikiQA` | Factual Q&A with citations |
| `PROMPT_WikiSummary` | Article/section summarization |
| `PROMPT_WikiGuide` | Navigation recommendations |
| `PROMPT_Conversational` | Friendly, chatty mode |

---

## 9. Performance Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| First article load | < 2 seconds | Cluster caching, lazy images |
| Title search | < 1 second | In-memory prefix index |
| Full-text search | < 2 seconds | Background indexing |
| Mesh generation | < 500ms | Limit to 10-15 nodes |
| Memory (4GB ZIM) | < 500MB RAM | Streaming, no full load |
| App startup | < 3 seconds | Lazy archive loading |

---

## 10. Security Considerations

- **Content Sandboxing:** HTML from ZIM rendered in sandboxed WebView with strict CSP
- **No Remote Execution:** Scripts in ZIM content stripped or blocked
- **Local-Only:** No network calls by default (offline-first)
- **Clean-Room:** No GPL code contamination (MIT licensed)
- **Credential Safety:** No secrets stored in ZIM or app data

---

## 10.1 User Authentication & Billing (Future)

> **PLACEHOLDER:** Architecture provisions for future user login and subscription management.

### Authentication Strategy

| Provider | Method | Notes |
|----------|--------|-------|
| Email/Password | Standard auth | Primary method |
| Google OAuth | Social login | Optional |
| GitHub OAuth | Social login | Developer-friendly |
| Apple Sign-In | Social login | Required for iOS |

### Feature Gating Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Feature Gate Flow                        │
├─────────────────────────────────────────────────────────────┤
│  User Request → Auth Check → Subscription Check → Feature   │
│                                                              │
│  [Anonymous] → [Free Tier Features Only]                    │
│  [Logged In] → [Check Plan] → [Gate/Allow Feature]          │
└─────────────────────────────────────────────────────────────┘
```

### Gated Features (Planned)

| Feature | Free | Paid |
|---------|------|------|
| Core Reader | ✅ | ✅ |
| Max Archives | 3 | Unlimited |
| AI Assistant | ❌ | ✅ |
| Cloud Sync | ❌ | ✅ |
| Advanced Annotations | ❌ | ✅ |
| Custom Themes | ❌ | ✅ |
| Export (PDF/EPUB) | Limited | Full |

### Billing Integration

- **Provider:** Stripe (via MCP integration)
- **Webhook Events:** Subscription lifecycle management
- **Data Models:** See `04_class_diagram.puml` for `User`, `Subscription`, `FeatureFlags`
- **UI Components:** See `UI_COMPONENTS.md` Section 11

---

## 11. Diagram Index

### PlantUML Diagrams (`.puml`)

| File | Description |
|------|-------------|
| `01_system_context.puml` | C4 Level 1 - System context |
| `02_container_diagram.puml` | C4 Level 2 - Container architecture |
| `03_component_diagram.puml` | Component relationships |
| `04_class_diagram.puml` | Data model classes |
| `05_seq_content_load.puml` | Article loading sequence |
| `06_seq_search.puml` | Search workflow sequence |
| `07_seq_semantic_mesh.puml` | Mesh generation sequence |
| `08_ui_theme_system.puml` | Theme system architecture |
| `09_ui_layout.puml` | UI layout & view structure |

### Mermaid Diagrams (`.mmd`)

| File | Description |
|------|-------------|
| `architecture_overview.mmd` | System architecture flowchart |
| `data_flow.mmd` | Data flow through components |
| `erd_models.mmd` | Entity-relationship diagram |
| `state_diagram.mmd` | UI state machine |
| `deployment_diagram.mmd` | Cross-platform deployment |
| `ui_component_hierarchy.mmd` | UI component tree structure |

### UI Design Documentation

| File | Description |
|------|-------------|
| `UI_COMPONENTS.md` | Component specs from UI-Samples prototypes |

---

## 12. Development Milestones

| Milestone | Features | Status |
|-----------|----------|--------|
| **M1: Core Reader MVP** | Open ZIM, render articles, basic nav | Pending |
| **M2: Library & Search** | Multi-archive, title/full-text search | Pending |
| **M3: Semantic Explorer** | Mesh view, advanced navigation | Pending |
| **M4: AI Assistant** | Chat interface, Q&A, summaries | Pending |
| **M5: Production Hardening** | Performance, cross-platform, polish | Pending |

---

## 13. References

- [AnZimmerman Library Documentation](../AnZimmermanLIB/AnZimmermanLib/README.md)
- [AnZimmerman Architecture](../AnZimmermanLIB/AnZimmermanLib/ARCHITECTURE.md)
- [OpenZIM Specification](https://wiki.openzim.org/wiki/ZIM_file_format)
- [EnZIM PRD Documents](../DOCS/PLANNING/)

---

*Document generated: 2026-01-17*
*Architecture version: 1.0.0*

Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
All rights reserved.
Unauthorized use without prior written consent is strictly prohibited.

# EnZIM — Offline ZIM Reader & Knowledge Assistant

**Copyright (C) 2025-2026 Robin L. M. Cheung, MBA. All rights reserved.**

---

> **EnZIM** is an offline-first knowledge companion that transforms static ZIM archives (like Wikipedia) into an interactive, AI-powered exploration experience.

---

## 🌟 Features

<img src="file:///home/robin/github/EnZIMe/DOCS/UI-Samples/history_entitlements.png" title="" alt="" data-align="center">

### Core Capabilities

- **📚 Offline Article Reader** — High-fidelity rendering of ZIM archives with full text, images, links, and styling
- **📂 Library Management** — Manage multiple ZIM archives with metadata display and easy switching
- **🔍 Full-Text Search** — Fast title and content search with result ranking and snippets
- **🕸️ Semantic Mesh** — Interactive 2.5D knowledge graph visualization of article relationships
- **⭐ Bookmarks & History** — Persistent user data for quick access to favorite and recent content
- **📝 Annotations** — Highlights, text notes, voice notes, and ink drawings on articles
- **🤖 AI Assistant** — "Chat with ZIM" for natural language Q&A, summaries, and navigation guidance
- **🔊 Text-to-Speech** — Read articles aloud using system or bundled TTS engines

### Platform Support

| Platform             | Technology             | Status  |
| -------------------- | ---------------------- | ------- |
| **Windows**          | Tauri (Rust + WebView) | Planned |
| **macOS**            | Tauri (Rust + WebView) | Planned |
| **Linux**            | Tauri (Rust + WebView) | Planned |
| **Web (PWA)**        | React + Service Worker | Planned |
| **Chrome Extension** | Manifest V3            | Planned |
| **Android**          | Tauri Mobile           | Planned |
| **iOS**              | Tauri Mobile           | Future  |

### Multi-Theme Support

EnZIM includes 9+ beautiful themes with Light/Dark/System auto modes:

| Theme                          | Aesthetic                           |
| ------------------------------ | ----------------------------------- |
| **Synaptic Cartography Veil**  | Neon, glassmorphic, neural network  |
| **Brutalist Archive Monolith** | Bold, print-like, utilitarian       |
| **Prismatic Swiss Utility**    | Clean Swiss design, multi-color     |
| **Spectral ZIM Reader**        | Sci-fi, spectral glows              |
| **Kinetic**                    | Colorful, dynamic, Gumroad-inspired |
| **Cyberpunk**                  | Neon-soaked dystopian               |
| **Neumorphism**                | Soft shadows, extruded surfaces     |
| **Glassmorphism**              | Frosted glass with depth            |
| **Minimal**                    | Clean Swiss design                  |

---

## 🏗️ Architecture

EnZIM is built on the **AnZimmermanLib** clean-room ZIM library implementations, ensuring:

- **Proprietary Licensed** — No GPL contamination
- **Multi-Language** — Rust, TypeScript, Python, Go, PHP implementations
- **Cross-Platform** — Single codebase for all platforms
- **Offline-First** — All features work without internet

```
┌─────────────────────────────────────────────────────────┐
│                    EnZIM Application                     │
├─────────────────────────────────────────────────────────┤
│  Frontend Layer     │  React + TypeScript + Tailwind    │
├─────────────────────────────────────────────────────────┤
│  State Layer        │  Zustand (Global State Store)     │
├─────────────────────────────────────────────────────────┤
│  Service Layer      │  ZIM, Search, Semantic, AI, TTS   │
├─────────────────────────────────────────────────────────┤
│  Core Layer         │  AnZimmermanLib (Clean-Room ZIM)  │
└─────────────────────────────────────────────────────────┘
```

**Full architecture documentation:** [DOCS/ARCHITECTURE/ARCHITECTURE.md](DOCS/ARCHITECTURE/ARCHITECTURE.md)

---

## 📁 Project Structure

```
EnZIMe/
├── AnZimmermanLIB/           # Clean-room ZIM library implementations
│   └── AnZimmermanLib/
│       ├── zimlib.py         # Python ZIM library
│       ├── zimlib.ts         # TypeScript ZIM library
│       ├── zimlib.go         # Go ZIM library
│       ├── zimlib.php        # PHP ZIM library
│       ├── api/              # REST API implementations
│       ├── TOOLS/            # zim-downloader, zimmer-extension
│       └── examples/         # Usage examples
├── DOCS/
│   ├── ARCHITECTURE/         # Architecture diagrams (.puml, .mmd)
│   │   ├── ARCHITECTURE.md   # Main architecture document
│   │   ├── *.puml            # PlantUML diagrams
│   │   └── *.mmd             # Mermaid diagrams
│   └── PLANNING/             # PRD and specification documents
├── CLAUDE.md                 # Agent configuration & dev guidelines
├── README.md                 # This file
└── CHECKLIST.md              # Development milestones (to be created)
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (for frontend development)
- **Rust** 1.70+ (for Tauri desktop builds)
- **pnpm** or **npm** (package manager)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/rebots-online/EnZIMe.git
cd EnZIMe

# Install dependencies (when frontend is set up)
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build
```

### Using the AnZimmermanLib

#### Python

```python
from AnZimmermanLIB.AnZimmermanLib.zimlib import ZIMReader, ZIMWriter, Namespace

# Read a ZIM file
with ZIMReader('wikipedia.zim') as reader:
    entry = reader.get_entry_by_path('A/Main_Page')
    content = reader.get_article_content(entry)
    print(content.decode('utf-8'))
```

#### TypeScript

```typescript
import { ZIMReader, ZIMReaderBrowser } from './AnZimmermanLIB/AnZimmermanLib/zimlib';

// Node.js
const reader = new ZIMReader('wikipedia.zim');
reader.open();
const entry = reader.getEntryByPath('A/Main_Page');
const content = reader.getArticleContent(entry);
reader.close();

// Browser
const zimReader = new ZIMReaderBrowser(arrayBuffer);
await zimReader.open();
const article = await zimReader.getArticleContent(entry);
```

---

## 📖 Documentation

| Document                                                         | Purpose                                            |
| ---------------------------------------------------------------- | -------------------------------------------------- |
| [CLAUDE.md](CLAUDE.md)                                           | Agent configuration, development rules, versioning |
| [ARCHITECTURE.md](DOCS/ARCHITECTURE/ARCHITECTURE.md)             | System design, components, data models             |
| [AnZimmermanLib README](AnZimmermanLIB/AnZimmermanLib/README.md) | ZIM library documentation                          |
| [PRD Documents](DOCS/PLANNING/)                                  | Product requirements and specifications            |

---

## 🎯 Development Guidelines

For AI agents and human developers, see **[CLAUDE.md](CLAUDE.md)** for:

- Operating mode and architecture-first principles
- Required project artifacts
- Attribution and versioning scheme
- UI theming system requirements
- Checklist conventions
- PiecesOS MCP integration for long-term memory

### Key Principles

1. **Architecture First** — Do not begin coding until architecture is approved
2. **Living Documentation** — Keep docs accurate and current
3. **Single Source of Truth** — One checklist, one architecture spec
4. **Clean-Room** — No GPL code contamination

---

## 📊 Development Roadmap

| Milestone                 | Features                               | Target   |
| ------------------------- | -------------------------------------- | -------- |
| **M1: Core Reader MVP**   | ZIM open, article rendering, basic nav | Week 1-2 |
| **M2: Library & Search**  | Multi-archive, title/full-text search  | Week 2-3 |
| **M3: Semantic Explorer** | Mesh view, graph navigation            | Week 3-4 |
| **M4: AI Assistant**      | Chat interface, Q&A, summaries         | Week 4-5 |
| **M5: Production**        | Performance, cross-platform, polish    | Week 5-6 |

---

## 🛠️ Technology Stack

| Layer           | Technology                             |
| --------------- | -------------------------------------- |
| **Frontend**    | React 18, TypeScript, Tailwind CSS     |
| **State**       | Zustand                                |
| **Desktop**     | Tauri 2.0 (Rust)                       |
| **Mobile**      | Tauri Mobile                           |
| **Web**         | Vite, Service Workers                  |
| **ZIM Parsing** | AnZimmermanLib (Rust/TS/Python/Go/PHP) |
| **Icons**       | Lucide React                           |
| **Diagrams**    | PlantUML, Mermaid                      |

---

## 📜 License

**Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.**

This software is proprietary. No part of this Software may be reproduced, distributed, or transmitted in any form without prior written permission.

This is a **clean-room implementation** with no licensing contamination from existing GPL ZIM implementations.

---

## 🔗 Related Projects

- **[AnZimmermanLib](AnZimmermanLIB/AnZimmermanLib/)** — Clean-room ZIM library implementations
- **[zim-downloader](AnZimmermanLIB/AnZimmermanLib/TOOLS/zim-downloader/)** — Rust/Tauri ZIM download tool
- **[Zimmer Extension](AnZimmermanLIB/AnZimmermanLib/TOOLS/zimmer-extension/)** — Chrome extension for ZIM

---

## 👤 Author

**Robin L. M. Cheung, MBA**

---

*EnZIM — Bringing offline knowledge to life.*

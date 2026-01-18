Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
All rights reserved.
Unauthorized use without prior written consent is strictly prohibited.

# AnZimmerman Architecture

**Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.**

## Overview

AnZimmerman is a clean-room implementation of ZIM (Zeno IMproved) file format libraries across multiple programming languages. The architecture ensures no licensing contamination from existing ZIM implementations while providing full read/write capabilities.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AnZimmerman Project                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐│
│  │  zimlib.py  │  │ zimlib.ts   │  │  zimlib.go  │  │zimlib.php││
│  │   Python    │  │ TypeScript  │  │     Go      │  │   PHP   ││
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────┬────┘│
│         │                │                │               │     │
│         └────────────────┴────────────────┴───────────────┘     │
│                              │                                  │
│                    ┌─────────▼─────────┐                       │
│                    │  ZIM File Format  │                       │
│                    │   Specification   │                       │
│                    └───────────────────┘                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    TOOLS                                │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │  zim-downloader (Rust/Tauri)                    │   │   │
│  │  │  - TUI mode (ratatui)                           │   │   │
│  │  │  - GUI mode (Tauri tray app)                    │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     APIs                                │   │
│  │  Python (FastAPI) │ TypeScript (Express) │ PHP │ Go    │   │
│  │  All with Swagger UI documentation                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## ZIM File Format Structure

### Header (80 bytes)

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 4 | Magic Number | `0x4D495A5A` ("ZZIM" LE) |
| 4 | 2 | Major Version | Format version (typically 4) |
| 6 | 2 | Minor Version | Minor version (typically 0) |
| 8 | 4 | Entry Count | Total directory entries |
| 12 | 4 | Article Count | Number of articles |
| 16 | 4 | Cluster Count | Number of clusters |
| 20 | 4 | Redirect Count | Number of redirects |
| 24 | 8 | MIME List Pos | Position of MIME type list |
| 32 | 8 | Title Index Pos | Position of title index |
| 40 | 8 | Cluster Ptr Pos | Position of cluster pointers |
| 48 | 8 | Cluster Count Pos | Position of cluster count |
| 56 | 4 | Main Page Index | Main page entry index |
| 60 | 4 | Layout Page Index | Layout page entry index |
| 64 | 8 | Checksum Pos | Position of MD5 checksum |

### Directory Entry Types

```
┌──────────────────────────────────────┐
│         Directory Entry              │
├──────────────────────────────────────┤
│ mimetype_index (4 bytes)             │
│ namespace (1 byte)                   │
│ revision (4 bytes)                   │
│ cluster_number (4 bytes)             │
│ blob_number (4 bytes)                │
│ url (null-terminated string)         │
│ title (null-terminated string)       │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│         Redirect Entry               │
├──────────────────────────────────────┤
│ mimetype_index = 0xFFFF (4 bytes)    │
│ namespace (1 byte)                   │
│ revision (4 bytes)                   │
│ redirect_index (4 bytes)             │
│ url (null-terminated string)         │
│ title (null-terminated string)       │
└──────────────────────────────────────┘
```

### Namespaces

| Code | Description |
|------|-------------|
| `A` | Main articles |
| `I` | Images |
| `M` | Metadata |
| `-` | Raw data |
| `S` | CSS stylesheets |
| `J` | JavaScript |
| `T` | Fonts |

### Compression Types

| Code | Type |
|------|------|
| 0 | Default (none) |
| 1 | None |
| 2 | ZLIB |
| 3 | BZIP2 |
| 4 | LZMA |
| 5 | Zstandard |

## Component Details

### Core Libraries

Each library implements:

1. **BinaryReader/BinaryWriter** - Low-level binary I/O utilities
2. **ZIMHeader** - Header parsing and serialization
3. **DirectoryEntry/RedirectEntry** - Entry type handling
4. **ZIMReader** - Read operations with streaming support
5. **ZIMWriter** - Write operations with cluster management
6. **ZIMReaderBrowser** (TypeScript only) - ArrayBuffer-based browser support

### Data Flow

```
Read Flow:
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Open    │───▶│  Parse   │───▶│  Read    │───▶│ Decomp.  │
│  File    │    │  Header  │    │  Entry   │    │  Content │
└──────────┘    └──────────┘    └──────────┘    └──────────┘

Write Flow:
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Create  │───▶│   Add    │───▶│  Build   │───▶│ Finalize │
│  Writer  │    │ Articles │    │ Clusters │    │  Header  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

## Integration Points

### Chrome Extension "Zimmer"

- Uses `ZIMReaderBrowser` class from TypeScript library
- ArrayBuffer-based for in-memory ZIM handling
- Service Worker support for offline access

### Kiwix-Scale Backend

- REST APIs with Swagger documentation
- Microservice-ready architecture
- Large file streaming support

## Clean-Room Methodology

1. **Specification Only**: Implementations derived solely from openZIM format spec
2. **No Source Review**: No examination of existing ZIM library source code
3. **Independent Testing**: Test cases created from format documentation
4. **Audit Trail**: All design decisions documented

## Directory Structure

```
AnZimmerman/
├── zimlib.py          # Python library
├── zimlib.ts          # TypeScript library
├── zimlib.go          # Go library
├── zimlib.php         # PHP library
├── LICENSE            # All rights reserved
├── version.json       # Version/build info
├── api/               # REST API implementations
│   ├── python/
│   ├── typescript/
│   ├── php/
│   └── go/
├── docs/              # Per-language architecture docs
├── examples/          # Usage examples
├── scripts/           # Build scripts
└── TOOLS/
    └── zim-downloader/  # Rust/Tauri download tool
```

## Version Information

Version and build numbers follow the format: `MAJOR.MINOR.PATCH+BUILD`

- **BUILD**: Last 5 digits of epoch minutes (auto-generated)
- Run `scripts/build.sh` to update version across all components

---

*For detailed per-language implementation notes, see the individual architecture documents in `docs/`.*

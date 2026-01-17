# TypeScript/Node.js ZIM Library Architecture

## Overview

The TypeScript ZIM library (`zimlib.ts`) provides a dual-environment implementation supporting both Node.js server-side operations and browser-based Chrome extension integration. It features type-safe interfaces, promise-based APIs, and efficient binary handling.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              zimlib.ts                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         Type Definitions                                │ │
│  │                                                                         │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │ │
│  │  │ ZIMHeader   │  │DirectoryEntry│ │RedirectEntry│  │   Entry     │   │ │
│  │  │ (interface) │  │ (interface) │  │ (interface) │  │ (union type)│   │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         Enumerations                                    │ │
│  │                                                                         │ │
│  │  ┌─────────────────────────┐    ┌─────────────────────────┐            │ │
│  │  │    CompressionType      │    │       Namespace         │            │ │
│  │  │                         │    │                         │            │ │
│  │  │ DEFAULT = 0             │    │ MAIN_ARTICLE = 65 ('A') │            │ │
│  │  │ NONE = 1                │    │ IMAGE = 73 ('I')        │            │ │
│  │  │ ZLIB = 2                │    │ METADATA = 77 ('M')     │            │ │
│  │  │ BZIP2 = 3               │    │ RAW_DATA = 45 ('-')     │            │ │
│  │  │ LZMA = 4                │    │ STYLE = 83 ('S')        │            │ │
│  │  │ ZSTD = 5                │    │ SCRIPT = 74 ('J')       │            │ │
│  │  └─────────────────────────┘    └─────────────────────────┘            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─────────────────────────┐    ┌─────────────────────────┐                │
│  │      BinaryReader       │    │      BinaryWriter       │                │
│  │                         │    │                         │                │
│  │ - buffer: Buffer        │    │ - buffer: Buffer        │                │
│  │ - position: number      │    │ - position: number      │                │
│  │                         │    │                         │                │
│  │ + readUInt32LE()        │    │ + writeUInt32LE()       │                │
│  │ + readUInt16LE()        │    │ + writeUInt16LE()       │                │
│  │ + readUInt8()           │    │ + writeUInt8()          │                │
│  │ + readUInt64LE()        │    │ + writeUInt64LE()       │                │
│  │ + readNullTerminated    │    │ + writeNullTerminated   │                │
│  │   String()              │    │   String()              │                │
│  │ + seek()                │    │ + seek()                │                │
│  │ + readBytes()           │    │ + writeBytes()          │                │
│  └─────────────────────────┘    └─────────────────────────┘                │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                     Main Classes                                         ││
│  │                                                                          ││
│  │  ┌─────────────────────┐  ┌─────────────────────┐                       ││
│  │  │     ZIMReader       │  │     ZIMWriter       │                       ││
│  │  │   (Node.js only)    │  │   (Node.js only)    │                       ││
│  │  │                     │  │                     │                       ││
│  │  │ - filePath: string  │  │ - filePath: string  │                       ││
│  │  │ - fileBuffer: Buffer│  │ - mimeTypes: string[]│                      ││
│  │  │ - header: ZIMHeader │  │ - entries: Entry[]  │                       ││
│  │  │ - mimeTypes: string[]│ │ - clusters: Buffer[]│                       ││
│  │  │ - entries: Entry[]  │  │                     │                       ││
│  │  │ - clusterOffsets    │  │ + create()          │                       ││
│  │  │                     │  │ + addMimeType()     │                       ││
│  │  │ + open()            │  │ + addArticle()      │                       ││
│  │  │ + close()           │  │ + addRedirect()     │                       ││
│  │  │ + getEntryByPath()  │  │ + finalize()        │                       ││
│  │  │ + getArticleContent()│ │ + close()           │                       ││
│  │  │ + getMainPage()     │  │                     │                       ││
│  │  │ + listArticles()    │  │                     │                       ││
│  │  └─────────────────────┘  └─────────────────────┘                       ││
│  │                                                                          ││
│  │  ┌───────────────────────────────────────────────────────────────────┐  ││
│  │  │                    ZIMReaderBrowser                                │  ││
│  │  │              (Browser/Chrome Extension compatible)                 │  ││
│  │  │                                                                    │  ││
│  │  │ - arrayBuffer: ArrayBuffer                                         │  ││
│  │  │ - header: ZIMHeader                                                │  ││
│  │  │ - mimeTypes: string[]                                              │  ││
│  │  │ - directoryEntries: Entry[]                                        │  ││
│  │  │ - clusterOffsets: bigint[]                                         │  ││
│  │  │                                                                    │  ││
│  │  │ + async open(): Promise<void>                                      │  ││
│  │  │ + getEntryByPath(path: string): Entry | undefined                  │  ││
│  │  │ + async getArticleContent(entry): Promise<Uint8Array>              │  ││
│  │  │ + getMainPage(): Entry | undefined                                 │  ││
│  │  │ + listArticles(): DirectoryEntry[]                                 │  ││
│  │  └───────────────────────────────────────────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Type Definitions

#### ZIMHeader Interface

```typescript
export interface ZIMHeader {
    magicNumber: number;      // 4 bytes - 0x4D495A5A ("ZZIM")
    majorVersion: number;     // 2 bytes - Format version major
    minorVersion: number;     // 2 bytes - Format version minor
    entryCount: number;       // 4 bytes - Total entries
    articleCount: number;     // 4 bytes - Article count
    clusterCount: number;     // 4 bytes - Cluster count
    redirectCount: number;    // 4 bytes - Redirect count
    mimeTypeListPos: bigint;  // 8 bytes - MIME list position
    titleIndexPos: bigint;    // 8 bytes - Title index position
    clusterPtrPos: bigint;    // 8 bytes - Cluster pointer position
    clusterCountPos: bigint;  // 8 bytes - Cluster count position
    mainPageIndex: number;    // 4 bytes - Main page index
    layoutPageIndex: number;  // 4 bytes - Layout page index
    checksumPos: bigint;      // 8 bytes - Checksum position
}
```

#### DirectoryEntry Interface

```typescript
export interface DirectoryEntry {
    mimetypeIndex: number;    // Index into MIME type array
    namespace: number;        // Namespace byte value
    revision: number;         // Entry revision
    clusterNumber: number;    // Cluster containing content
    blobNumber: number;       // Blob index in cluster
    url: string;              // URL path
    title: string;            // Human-readable title
}
```

#### RedirectEntry Interface

```typescript
export interface RedirectEntry {
    mimetypeIndex: number;    // Always 0xFFFF for redirects
    namespace: number;        // Namespace byte value
    revision: number;         // Entry revision
    redirectIndex: number;    // Target entry index
    url: string;              // Source URL
    title: string;            // Redirect title
}
```

#### Union Type

```typescript
export type Entry = DirectoryEntry | RedirectEntry;
```

### 2. BinaryReader Class

Handles reading binary data from Buffer with automatic position tracking.

```typescript
class BinaryReader {
    private buffer: Buffer;
    private position: number = 0;

    constructor(buffer: Buffer);
    
    readUInt32LE(): number;           // Read 4-byte unsigned int
    readUInt16LE(): number;           // Read 2-byte unsigned int
    readUInt8(): number;              // Read single byte
    readUInt64LE(): bigint;           // Read 8-byte unsigned int
    readNullTerminatedString(): string; // Read until null byte
    seek(position: number): void;     // Set read position
    getPosition(): number;            // Get current position
    readBytes(length: number): Buffer; // Read n bytes
}
```

### 3. BinaryWriter Class

Handles writing binary data with automatic buffer expansion.

```typescript
class BinaryWriter {
    private buffer: Buffer;
    private position: number = 0;

    constructor(initialSize: number);
    
    writeUInt32LE(value: number): void;
    writeUInt16LE(value: number): void;
    writeUInt8(value: number): void;
    writeUInt64LE(value: bigint): void;
    writeNullTerminatedString(str: string): void;
    writeBytes(bytes: Buffer): void;
    seek(position: number): void;
    getPosition(): number;
    getBuffer(): Buffer;              // Returns trimmed buffer
}
```

## ZIMReader Architecture (Node.js)

### Class Structure

```typescript
export class ZIMReader {
    private filePath: string;
    private fileHandle?: number;
    private fileBuffer?: Buffer;
    private header?: ZIMHeader;
    private mimeTypes: string[] = [];
    private directoryEntries: Entry[] = [];
    private clusterOffsets: bigint[] = [];

    constructor(filePath: string);
    
    open(): void;
    close(): void;
    
    private readHeader(): void;
    private readMimeTypes(): void;
    private readDirectory(): void;
    private readClusterPointers(): void;
    private readDirectoryEntry(reader: BinaryReader): DirectoryEntry;
    private readRedirectEntry(reader: BinaryReader): RedirectEntry;
    
    getEntryByPath(path: string): Entry | undefined;
    getArticleContent(entry: DirectoryEntry): Buffer;
    getMainPage(): Entry | undefined;
    listArticles(): DirectoryEntry[];
    getMimeTypes(): string[];
    getHeader(): ZIMHeader | undefined;
}
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        ZIMReader.open()                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    readFileSync(filePath)                        │
│                   Load entire file into Buffer                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        readHeader()                              │
│                                                                  │
│  BinaryReader ──► Parse 80-byte header ──► Validate magic number │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      readMimeTypes()                             │
│                                                                  │
│  Seek to mimeTypeListPos ──► Read until \x00\x00 ──► Split by \x00│
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      readDirectory()                             │
│                                                                  │
│  Read index pointer list (8 bytes each)                          │
│            │                                                     │
│            ▼                                                     │
│  For each pointer:                                               │
│    ├─ Read mimetype (4 bytes)                                    │
│    ├─ If 0xFFFF: readRedirectEntry()                             │
│    └─ Else: readDirectoryEntry()                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   readClusterPointers()                          │
│                                                                  │
│  Seek to clusterPtrPos ──► Read clusterCount × 8-byte pointers   │
└─────────────────────────────────────────────────────────────────┘
```

## ZIMReaderBrowser Architecture

Designed for browser environments and Chrome extensions where Node.js APIs aren't available.

### Key Differences from ZIMReader

| Feature | ZIMReader (Node.js) | ZIMReaderBrowser |
|---------|---------------------|------------------|
| Input | File path string | ArrayBuffer |
| Buffer type | Node.js Buffer | Uint8Array/Buffer polyfill |
| File I/O | fs.readFileSync | None (pre-loaded) |
| Async | Synchronous | Promise-based |
| Memory | File handle or buffer | Full ArrayBuffer in memory |

### Browser Integration Pattern

```typescript
// Chrome Extension Usage
async function loadZIMInExtension(file: File): Promise<ZIMReaderBrowser> {
    const arrayBuffer = await file.arrayBuffer();
    const reader = new ZIMReaderBrowser(arrayBuffer);
    await reader.open();
    return reader;
}

// Service Worker Usage
self.addEventListener('fetch', (event: FetchEvent) => {
    if (event.request.url.startsWith('zim://')) {
        event.respondWith(handleZIMRequest(event.request));
    }
});

async function handleZIMRequest(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    const entry = zimReader.getEntryByPath(path);
    
    if (entry && 'clusterNumber' in entry) {
        const content = await zimReader.getArticleContent(entry);
        return new Response(content, {
            headers: { 'Content-Type': 'text/html' }
        });
    }
    
    return new Response('Not Found', { status: 404 });
}
```

## ZIMWriter Architecture

### Class Structure

```typescript
export class ZIMWriter {
    private filePath: string;
    private mimeTypes: string[] = [];
    private directoryEntries: Entry[] = [];
    private clusters: Buffer[] = [];
    private mainPageIndex: number = 0;

    constructor(filePath: string);
    
    create(): void;
    addMimeType(mimeType: string): number;
    addArticle(namespace: number, url: string, title: string, 
               content: Buffer, mimeType?: string): void;
    addRedirect(namespace: number, url: string, title: string, 
                redirectIndex: number): void;
    finalize(): void;
    close(): void;
    
    private createCluster(blobs: Buffer[], compression: CompressionType): Buffer;
    private serializeEntry(entry: Entry): Buffer;
}
```

### Writing Flow

```
┌─────────────────┐
│    create()     │
│                 │
│ Write 80-byte   │
│ placeholder     │
│ header          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  addArticle()   │────▶│ addMimeType()   │
│                 │     │ Returns index   │
│ createCluster() │     └─────────────────┘
│ Store entry     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  addRedirect()  │
│                 │
│ Store redirect  │
│ entry           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   finalize()    │
└────────┬────────┘
         │
         ├─── Calculate positions ───────────────────────┐
         │                                               │
         ├─── Serialize MIME types ──────────────────────┤
         │                                               │
         ├─── Serialize directory entries ───────────────┤
         │                                               │
         ├─── Write index pointer list ──────────────────┤
         │                                               │
         ├─── Write cluster pointer list ────────────────┤
         │                                               │
         ├─── Write clusters ────────────────────────────┤
         │                                               │
         ├─── Update header with final values ───────────┤
         │                                               │
         └─── Write checksum placeholder ────────────────┘
```

## Type Guards

```typescript
// Check if entry is a DirectoryEntry
function isDirectoryEntry(entry: Entry): entry is DirectoryEntry {
    return 'clusterNumber' in entry && 'blobNumber' in entry;
}

// Check if entry is a RedirectEntry
function isRedirectEntry(entry: Entry): entry is RedirectEntry {
    return 'redirectIndex' in entry;
}

// Usage
const entry = reader.getEntryByPath('A/Main_Page');
if (entry && isDirectoryEntry(entry)) {
    const content = reader.getArticleContent(entry);
}
```

## Memory Management

### Node.js Environment

```
┌─────────────────────────────────────────────────────────────┐
│                    Memory Layout                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  fileBuffer: Buffer (entire file loaded)                     │
│  ├── Header (80 bytes)                                       │
│  ├── MIME types (variable)                                   │
│  ├── Directory entries (variable)                            │
│  ├── Index pointers (8 × entryCount bytes)                   │
│  ├── Cluster pointers (8 × clusterCount bytes)               │
│  └── Clusters (variable, largest portion)                    │
│                                                              │
│  directoryEntries: Entry[] (parsed objects)                  │
│  clusterOffsets: bigint[] (cluster positions)                │
│  mimeTypes: string[] (parsed strings)                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Browser Environment

```
┌─────────────────────────────────────────────────────────────┐
│                Browser Memory Layout                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  arrayBuffer: ArrayBuffer                                    │
│  ├── Entire ZIM file in memory                               │
│  └── Accessed via Uint8Array views                           │
│                                                              │
│  Considerations:                                             │
│  - Chrome extension storage limits                           │
│  - IndexedDB for large file storage                          │
│  - File System Access API for streaming                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling

```typescript
// Custom error types (recommended additions)
class ZIMError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ZIMError';
    }
}

class ZIMFormatError extends ZIMError {
    constructor(message: string) {
        super(message);
        this.name = 'ZIMFormatError';
    }
}

class ZIMCompressionError extends ZIMError {
    constructor(compressionType: number) {
        super(`Unsupported compression type: ${compressionType}`);
        this.name = 'ZIMCompressionError';
    }
}
```

## Compression Support

| Type | Node.js Support | Browser Support |
|------|-----------------|-----------------|
| None | ✓ Native | ✓ Native |
| ZLIB | ✓ zlib module | ✓ pako library |
| LZMA | ⚠ Requires lzma-native | ⚠ Requires lzma-js |
| ZSTD | ⚠ Requires zstd-codec | ⚠ Requires zstd-codec |
| BZIP2 | ⚠ Requires bzip2 | ⚠ Requires bzip2.js |

## Performance Optimization

### Lazy Loading Pattern

```typescript
class LazyZIMReader extends ZIMReader {
    private entryCache: Map<string, Entry> = new Map();
    private contentCache: LRUCache<string, Buffer>;
    
    constructor(filePath: string, cacheSize: number = 100) {
        super(filePath);
        this.contentCache = new LRUCache({ max: cacheSize });
    }
    
    getArticleContent(entry: DirectoryEntry): Buffer {
        const key = `${entry.clusterNumber}:${entry.blobNumber}`;
        
        if (this.contentCache.has(key)) {
            return this.contentCache.get(key)!;
        }
        
        const content = super.getArticleContent(entry);
        this.contentCache.set(key, content);
        return content;
    }
}
```

### Streaming Large Files

```typescript
// For very large ZIM files, use streaming approach
import { createReadStream } from 'fs';

async function streamZIMFile(filePath: string): Promise<void> {
    const headerBuffer = Buffer.alloc(80);
    const stream = createReadStream(filePath, { start: 0, end: 79 });
    
    await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunk.copy(headerBuffer));
        stream.on('end', resolve);
        stream.on('error', reject);
    });
    
    // Parse header and seek to specific positions as needed
}
```

## TypeScript Configuration

```json
// tsconfig.json for this library
{
    "compilerOptions": {
        "target": "ES2020",
        "module": "commonjs",
        "lib": ["ES2020"],
        "declaration": true,
        "strict": true,
        "noImplicitAny": true,
        "strictNullChecks": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "outDir": "./dist",
        "rootDir": "./src"
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules", "dist"]
}
```

## Dependencies

```json
// package.json dependencies
{
    "dependencies": {},
    "devDependencies": {
        "@types/node": "^18.0.0",
        "typescript": "^5.0.0"
    },
    "peerDependencies": {
        "@types/node": ">=14.0.0"
    }
}
```

## Chrome Extension Integration

### Manifest V3 Configuration

```json
{
    "manifest_version": 3,
    "name": "Zimmer",
    "permissions": [
        "storage",
        "unlimitedStorage"
    ],
    "background": {
        "service_worker": "background.js",
        "type": "module"
    }
}
```

### Service Worker Pattern

```typescript
// background.ts
import { ZIMReaderBrowser } from './zimlib';

const zimReaders = new Map<string, ZIMReaderBrowser>();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message).then(sendResponse);
    return true; // Keep channel open for async response
});

async function handleMessage(message: any): Promise<any> {
    switch (message.type) {
        case 'LOAD_ZIM':
            return loadZIM(message.id, message.data);
        case 'GET_ARTICLE':
            return getArticle(message.zimId, message.path);
        default:
            return { error: 'Unknown message type' };
    }
}
```

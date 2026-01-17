# Clean-room ZIM Libraries for Chrome Extension "Zimmer" and Kiwix-Scale

This repository contains **clean-room implementations** of ZIM (Zeno IMproved) file format readers and writers in multiple programming languages, specifically designed for use in the Chrome extension "zimmer" and kiwix-scale Wikipedia ZIM-size handling capabilities.

## 📋 Table of Contents

- [Overview](#overview)
- [Libraries Included](#libraries-included)
- [Architecture Documentation](#architecture-documentation)
- [Examples](#examples)
- [Quick Start](#quick-start)
- [ZIM File Format](#zim-file-format)
- [Integration Guide](#integration-guide)
- [API Reference](#api-reference)
- [License](#license)

## Overview

ZIM is an open file format that stores website content for offline usage, primarily used to store Wikipedia and other Wikimedia projects. These libraries provide clean-room implementations based solely on the ZIM file format specification from openZIM, ensuring no licensing contamination from existing implementations.

### Research Sources

The implementations are based on research of permissively-licensed ZIM implementations:
- **libzim** (GPLv2) - Reference C++ implementation by openZIM
- **kiwix-js** (GPLv3) - JavaScript ZIM reader for browsers
- **python-libzim** (GPLv3) - Python bindings for libzim
- **go-zim** (MIT) - Go implementation by Bornholm
- **gozim** (MIT) - Pure Go implementation by akhenakh
- **ZIMply** (GPL) - Pure Python ZIM reader

Our clean-room implementations use only the **ZIM file format specification** from openZIM wiki, not any source code.

## Libraries Included

| Language | File | Reader | Writer | Browser Support |
|----------|------|--------|--------|-----------------|
| Python | `zimlib.py` | ✓ | ✓ | Backend only |
| TypeScript | `zimlib.ts` | ✓ | ✓ | ✓ (ZIMReaderBrowser) |
| PHP | `zimlib.php` | ✓ | ✓ | Backend only |
| Go | `zimlib.go` | ✓ | ✓ | Backend only |

### 1. Python Library (`zimlib.py`)
- **Features**: Complete ZIM reader and writer implementation
- **Dependencies**: Standard library only (struct, zlib, lzma)
- **Usage**: Simple context manager interface for file operations
- **Compression Support**: ZLIB, LZMA, uncompressed
- **Architecture**: See [docs/ARCHITECTURE_PYTHON.md](docs/ARCHITECTURE_PYTHON.md)

### 2. TypeScript/Node.js Library (`zimlib.ts`)
- **Features**: Full ZIM reader/writer with browser compatibility
- **Dependencies**: Node.js fs, zlib modules (optional for browser)
- **Usage**: Promise-based API with browser-compatible `ZIMReaderBrowser` class
- **Browser Support**: Includes `ZIMReaderBrowser` for ArrayBuffer-based reading
- **Architecture**: See [docs/ARCHITECTURE_TYPESCRIPT.md](docs/ARCHITECTURE_TYPESCRIPT.md)

### 3. PHP Library (`zimlib.php`)
- **Features**: Complete ZIM reader and writer implementation
- **Dependencies**: PHP standard library (zlib for compression)
- **Usage**: Object-oriented interface with file handle management
- **Architecture**: See [docs/ARCHITECTURE_PHP.md](docs/ARCHITECTURE_PHP.md)

### 4. Go Library (`zimlib.go`)
- **Features**: High-performance ZIM reader and writer
- **Dependencies**: Go standard library only
- **Usage**: Clean Go idioms with proper error handling
- **Architecture**: See [docs/ARCHITECTURE_GO.md](docs/ARCHITECTURE_GO.md)

## Architecture Documentation

Detailed architecture documentation for each library:

| Library | Documentation |
|---------|---------------|
| Python | [docs/ARCHITECTURE_PYTHON.md](docs/ARCHITECTURE_PYTHON.md) |
| TypeScript | [docs/ARCHITECTURE_TYPESCRIPT.md](docs/ARCHITECTURE_TYPESCRIPT.md) |
| PHP | [docs/ARCHITECTURE_PHP.md](docs/ARCHITECTURE_PHP.md) |
| Go | [docs/ARCHITECTURE_GO.md](docs/ARCHITECTURE_GO.md) |

Each architecture document includes:
- Component diagrams
- Data structure definitions
- Read/Write flow diagrams
- Memory management strategies
- Error handling patterns
- Performance characteristics
- Thread safety considerations

## Examples

Complete working examples are provided for each library:

### Python Examples (`examples/python/`)
| Example | Description |
|---------|-------------|
| `01_create_zim.py` | Create ZIM files with articles, CSS, and redirects |
| `02_read_zim.py` | Read ZIM files, list entries, search articles |
| `03_edit_zim.py` | Modify existing ZIM files (copy with changes) |

### TypeScript Examples (`examples/typescript/`)
| Example | Description |
|---------|-------------|
| `01_create_zim.ts` | Create ZIM files in Node.js |
| `02_read_zim.ts` | Read and analyze ZIM files |
| `03_edit_zim.ts` | ZIMEditor class for modifications |

### PHP Examples (`examples/php/`)
| Example | Description |
|---------|-------------|
| `01_create_zim.php` | Create ZIM files with PHP |
| `02_read_zim.php` | Read ZIM files and extract content |
| `03_edit_zim.php` | Modify ZIM files with ZIMEditor class |

### Go Examples (`examples/go/`)
| Example | Description |
|---------|-------------|
| `01_create_zim.go` | Create ZIM files in Go |
| `02_read_zim.go` | Read and analyze ZIM files |
| `03_edit_zim.go` | ZIMEditor for modifications |

## Quick Start

### Python
```python
from zimlib import ZIMReader, ZIMWriter, Namespace

# Write a ZIM file
with ZIMWriter('wiki.zim') as writer:
    writer.add_article(Namespace.MAIN_ARTICLE, 'Main_Page', 'Home',
                       b'<html><body>Hello!</body></html>', 'text/html')

# Read a ZIM file
with ZIMReader('wiki.zim') as reader:
    entry = reader.get_entry_by_path('A/Main_Page')
    content = reader.get_article_content(entry)
    print(content.decode('utf-8'))
```

### TypeScript/Node.js
```typescript
import { ZIMReader, ZIMWriter, Namespace } from './zimlib';

// Write
const writer = new ZIMWriter('wiki.zim');
writer.create();
writer.addArticle(Namespace.MAIN_ARTICLE, 'Main_Page', 'Home',
                  Buffer.from('<html><body>Hello!</body></html>'), 'text/html');
writer.finalize();

// Read
const reader = new ZIMReader('wiki.zim');
reader.open();
const entry = reader.getEntryByPath('A/Main_Page');
if (entry && 'clusterNumber' in entry) {
    const content = reader.getArticleContent(entry);
    console.log(content.toString());
}
reader.close();
```

### PHP
```php
require_once 'zimlib.php';

// Write
$writer = new ZIMWriter('wiki.zim');
$writer->create();
$writer->addArticle(ZIMNamespace::MAIN_ARTICLE, 'Main_Page', 'Home',
                    '<html><body>Hello!</body></html>', 'text/html');
$writer->finalize();

// Read
$reader = new ZIMReader('wiki.zim');
$reader->open();
$entry = $reader->getEntryByPath('A/Main_Page');
$content = $reader->getArticleContent($entry);
echo $content;
$reader->close();
```

### Go
```go
import "github.com/yourproject/zimlib"

// Write
writer := zimlib.NewWriter("wiki.zim")
writer.Create()
writer.AddArticle(zimlib.NamespaceMainArticle, "Main_Page", "Home",
                  []byte("<html><body>Hello!</body></html>"), "text/html")
writer.Finalize()

// Read
reader := zimlib.NewReader("wiki.zim")
reader.Open()
defer reader.Close()
entry := reader.GetEntryByPath("A/Main_Page")
if dirEntry, ok := entry.(*zimlib.DirectoryEntry); ok {
    content, _ := reader.GetArticleContent(dirEntry)
    fmt.Println(string(content))
}
```

## ZIM File Format

### Header Structure (80 bytes)
| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 4 | Magic Number | 0x4D495A5A ("ZZIM") |
| 4 | 2 | Major Version | Format version (4) |
| 6 | 2 | Minor Version | Minor version (0) |
| 8 | 4 | Entry Count | Total directory entries |
| 12 | 4 | Article Count | Number of articles |
| 16 | 4 | Cluster Count | Number of clusters |
| 20 | 4 | Redirect Count | Number of redirects |
| 24 | 8 | MIME Type List Pos | Position of MIME list |
| 32 | 8 | Title Index Pos | Position of title index |
| 40 | 8 | Cluster Ptr Pos | Position of cluster pointers |
| 48 | 8 | Cluster Count Pos | Position of cluster count |
| 56 | 4 | Main Page Index | Main page entry index |
| 60 | 4 | Layout Page Index | Layout page entry index |
| 64 | 8 | Checksum Pos | Position of MD5 checksum |

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

## Integration Guide

### Chrome Extension "Zimmer"

#### Frontend Integration (TypeScript)

```typescript
import { ZIMReaderBrowser } from './zimlib';
async function loadZIMFile(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const zimReader = new ZIMReaderBrowser(arrayBuffer);
    
    await zimReader.open();
    
    // Get main page
    const mainPage = zimReader.getMainPage();
    if (mainPage && 'clusterNumber' in mainPage) {
        const content = await zimReader.getArticleContent(mainPage);
        // Display content in extension
        displayArticle(content);
    }
    
    // Search for specific article
    const entry = zimReader.getEntryByPath('A/Python_(programming_language)');
    if (entry && 'clusterNumber' in entry) {
        const content = await zimReader.getArticleContent(entry);
        displayArticle(content);
    }
}
```

### Backend Integration (Python)

```python
from zimlib import ZIMReader

# Flask backend for Chrome extension
@app.route('/api/zim/<path:article_path>')
def get_article(article_path):
    zim_file = request.args.get('zim_file')
    with ZIMReader(zim_file) as zim:
        entry = zim.get_entry_by_path(article_path)
        if entry and hasattr(entry, 'cluster_number'):
            content = zim.get_article_content(entry)
            return Response(content, mimetype='text/html')
    return jsonify({'error': 'Article not found'}), 404
```

## Integration for Kiwix-Scale Wikipedia ZIM-Size Handling

### Large File Processing

All libraries are designed to handle large Wikipedia ZIM files efficiently:

1. **Memory Management**: Streaming readers for large files
2. **Index Optimization**: Fast article lookup without full file scan
3. **Compression Handling**: Support for ZSTD, LZMA, ZLIB compression
4. **Namespace Support**: Proper handling of Wikipedia namespaces

### Example: Wikipedia Size Analysis (Python)

```python
from zimlib import ZIMReader

def analyze_wikipedia_zim(zim_path):
    with ZIMReader(zim_path) as zim:
        articles = zim.list_articles()
        
        # Count articles by namespace
        namespace_counts = {}
        total_size = 0
        
        for article in articles:
            namespace = chr(article.namespace)
            namespace_counts[namespace] = namespace_counts.get(namespace, 0) + 1
            
            # Get content size
            content = zim.get_article_content(article)
            total_size += len(content)
        
        return {
            'total_articles': len(articles),
            'total_size': total_size,
            'namespace_distribution': namespace_counts,
            'mime_types': zim.get_mime_types()
        }
```

### Example: High-Performance Server (Go)

```go
package main

import (
    "net/http"
    "log"
    "github.com/yourproject/zimlib"
)

func main() {
    zimReader := zimlib.NewReader("wikipedia_en_all.zim")
    err := zimReader.Open()
    if err != nil {
        log.Fatal(err)
    }
    defer zimReader.Close()
    
    http.HandleFunc("/article/", func(w http.ResponseWriter, r *http.Request) {
        path := r.URL.Path[len("/article/"):]
        entry := zimReader.GetEntryByPath(path)
        
        if dirEntry, ok := entry.(*zimlib.DirectoryEntry); ok {
            content, err := zimReader.GetArticleContent(dirEntry)
            if err != nil {
                http.Error(w, err.Error(), http.StatusInternalServerError)
                return
            }
            w.Write(content)
        } else {
            http.NotFound(w, r)
        }
    })
    
    log.Println("Server starting on :8080")
    http.ListenAndServe(":8080", nil)
}
```

## Chrome Extension Specific Features

### File System Access

The TypeScript library includes browser-specific optimizations:

```typescript
// Chrome extension file system API integration
chrome.runtime.getPackageDirectoryEntry((rootDir) => {
    rootDir.getFile('wikipedia.zim', {}, (fileEntry) => {
        fileEntry.file((file) => {
            loadZIMFile(file);
        });
    });
});
```

### Service Worker Support

```typescript
// Service worker for offline ZIM access
self.addEventListener('fetch', (event) => {
    if (event.request.url.startsWith('zim://')) {
        event.respondWith(handleZIMRequest(event.request));
    }
});

async function handleZIMRequest(request) {
    const path = new URL(request.url).pathname;
    const entry = zimReader.getEntryByPath(path);
    
    if (entry && 'clusterNumber' in entry) {
        const content = await zimReader.getArticleContent(entry);
        return new Response(content);
    }
    
    return new Response('Not found', { status: 404 });
}
```

## Performance Considerations

### Memory Usage
- **Python**: Uses generators for large file processing
- **TypeScript**: ArrayBuffer-based for browser efficiency
- **PHP**: Stream-based reading for memory efficiency
- **Go**: Zero-copy operations where possible

### Compression Support
- **ZSTD**: Modern compression (requires external library in some languages)
- **LZMA**: High compression ratio
- **ZLIB**: Widely supported
- **Uncompressed**: Fastest access

### Index Optimization
- Binary search for article lookup
- Namespace-based filtering
- Title-based sorting for fast navigation

## Usage Examples

### Basic Reading (All Languages)

```python
# Python
with ZIMReader('file.zim') as zim:
    entry = zim.get_entry_by_path('A/Main_Page')
    content = zim.get_article_content(entry)
```

```typescript
// TypeScript
const zim = new ZIMReader('file.zim');
zim.open();
const entry = zim.getEntryByPath('A/Main_Page');
const content = await zim.getArticleContent(entry);
zim.close();
```

```php
// PHP
$zim = new ZIMReader('file.zim');
$zim->open();
$entry = $zim->getEntryByPath('A/Main_Page');
$content = $zim->getArticleContent($entry);
$zim->close();
```

```go
// Go
zim := zimlib.NewReader('file.zim')
zim.Open()
defer zim.Close()
entry := zim.GetEntryByPath('A/Main_Page')
content := zim.GetArticleContent(entry.(*zimlib.DirectoryEntry))
```

### Writing ZIM Files

```python
# Python
with ZIMWriter('output.zim') as writer:
    writer.add_article(Namespace.MAIN_ARTICLE, 'home', 'Home', '<html>...</html>')
    writer.finalize()
```

## Chrome Extension Deployment

### Manifest Configuration

```json
{
    "name": "Zimmer - ZIM Reader",
    "version": "1.0",
    "manifest_version": 3,
    "background": {
        "service_worker": "background.js"
    },
    "permissions": [
        "storage",
        "unlimitedStorage"
    ],
    "web_accessible_resources": [{
        "resources": ["*.zim"],
        "matches": ["<all_urls>"]
    }]
}
```

### Background Script

```typescript
// background.ts
import { ZIMReaderBrowser } from './zimlib';

let zimCache = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'loadZIM') {
        loadZIMIntoCache(message.fileId, message.arrayBuffer)
            .then(() => sendResponse({success: true}))
            .catch(err => sendResponse({error: err.message}));
        return true; // Keep message channel open
    }
});

async function loadZIMIntoCache(fileId: string, arrayBuffer: ArrayBuffer) {
    const zimReader = new ZIMReaderBrowser(arrayBuffer);
    await zimReader.open();
    zimCache.set(fileId, zimReader);
}
```

## Kiwix-Scale Integration

### Microservice Architecture

```yaml
# docker-compose.yml
version: '3.8'
services:
  zim-api:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - ./zim-files:/data
    environment:
      - ZIM_FILE_PATH=/data/wikipedia_en_all.zim
  
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - zim-api
```

### API Endpoints

```go
// REST API for kiwix-scale
func setupRoutes() *mux.Router {
    r := mux.NewRouter()
    
    // Article content
    r.HandleFunc("/api/article/{namespace}/{url:.+}", getArticleHandler).Methods("GET")
    
    // Search
    r.HandleFunc("/api/search", searchHandler).Methods("GET")
    
    // Metadata
    r.HandleFunc("/api/metadata", metadataHandler).Methods("GET")
    
    return r
}
```

## Testing

### Unit Tests (Python Example)

```python
import unittest
from zimlib import ZIMReader, ZIMWriter, Namespace

class TestZIMLib(unittest.TestCase):
    def test_write_read_article(self):
        # Create test ZIM
        with ZIMWriter('test.zim') as writer:
            writer.add_article(Namespace.MAIN_ARTICLE, 'test', 'Test', 'Hello World')
            writer.finalize()
        
        # Read test ZIM
        with ZIMReader('test.zim') as reader:
            entry = reader.get_entry_by_path('A/test')
            self.assertIsNotNone(entry)
            content = reader.get_article_content(entry)
            self.assertEqual(content, b'Hello World')
```

## REST APIs with Swagger Documentation

Each library includes a REST API implementation with **Swagger UI** for interactive documentation and testing.

### API Implementations

| Language | Location | Framework | Run Command |
|----------|----------|-----------|-------------|
| Python | `api/python/` | FastAPI | `uvicorn zim_api:app --port 8000` |
| TypeScript | `api/typescript/` | Express | `npm start` |
| PHP | `api/php/` | Native + Swagger UI | `php -S localhost:8080 zim_api.php` |
| Go | `api/go/` | net/http + Swagger UI | `go run zim_api.go` |

### API Endpoints

All APIs provide consistent endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Welcome page with links |
| `/docs` or `/swagger` | GET | Swagger UI interactive documentation |
| `/openapi.json` | GET | OpenAPI specification |
| `/status` | GET | API status and loaded ZIM info |
| `/zim/upload` | POST | Upload ZIM file |
| `/zim/load` | POST | Load ZIM from server path |
| `/zim/info` | GET | Get ZIM file information |
| `/zim/header` | GET | Get ZIM header details |
| `/zim/mime-types` | GET | List MIME types |
| `/zim/articles` | GET | List articles (with filtering) |
| `/zim/redirects` | GET | List redirects |
| `/zim/article/{ns}/{path}` | GET | Get article content |
| `/zim/main-page` | GET | Get main page content |
| `/zim/search?q=query` | GET | Search articles |
| `/zim/create` | POST | Create new ZIM file |
| `/zim/download/{filename}` | GET | Download ZIM file |

### Quick Start - Python API

```bash
cd api/python
pip install -r requirements.txt
uvicorn zim_api:app --reload --port 8000
# Open http://localhost:8000/docs for Swagger UI
```

### Quick Start - TypeScript API

```bash
cd api/typescript
npm install
npm start
# Open http://localhost:3000/api-docs for Swagger UI
```

### Quick Start - PHP API

```bash
cd api/php
php -S localhost:8080 zim_api.php
# Open http://localhost:8080/docs for Swagger UI
```

### Quick Start - Go API

```bash
cd api/go
go run zim_api.go
# Open http://localhost:8080/swagger for Swagger UI
```

### API Usage Example

```bash
# Upload a ZIM file
curl -X POST -F "file=@wikipedia.zim" http://localhost:8000/zim/upload

# Get ZIM info
curl http://localhost:8000/zim/info

# Search articles
curl "http://localhost:8000/zim/search?q=python&limit=10"

# Get article content
curl http://localhost:8000/zim/article/A/Main_Page

# Create new ZIM file
curl -X POST http://localhost:8000/zim/create \
  -H "Content-Type: application/json" \
  -d '{"filename":"new.zim","articles":[{"url":"Main_Page","title":"Home","content":"<h1>Hello</h1>"}]}'
```

### Swagger UI Features

- **Interactive Testing**: Test all endpoints directly in the browser
- **Request Builder**: Build requests with proper parameters
- **Response Visualization**: View formatted JSON responses
- **Schema Documentation**: See all request/response models
- **Try It Out**: Execute real API calls

## License

**Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.**

This software is proprietary. No part of this Software may be reproduced, distributed, or transmitted in any form without prior written permission. See [LICENSE](LICENSE) for details.

This is a clean-room implementation with no licensing contamination from existing ZIM implementations.

## Contributing

When contributing to these libraries:
1. Only reference the ZIM file format specification from openZIM
2. Do not examine existing ZIM implementation source code
3. Maintain clean-room development practices
4. Add comprehensive tests for all functionality

## Support

For issues specific to Chrome extension "zimmer" or kiwix-scale integration, please create separate issues with appropriate labels.

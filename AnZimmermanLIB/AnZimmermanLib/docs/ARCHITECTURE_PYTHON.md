Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
All rights reserved.
Unauthorized use without prior written consent is strictly prohibited.

# Python ZIM Library Architecture

## Overview

The Python ZIM library (`zimlib.py`) provides a complete, clean-room implementation of the ZIM file format reader and writer. It is designed to be pure Python with minimal dependencies, making it highly portable and easy to integrate.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        zimlib.py                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │   ZIMReader     │    │   ZIMWriter     │    │   Utilities     │ │
│  │                 │    │                 │    │                 │ │
│  │ - open()        │    │ - create()      │    │ - CompressionType│
│  │ - close()       │    │ - add_article() │    │ - Namespace     │ │
│  │ - get_entry_by_ │    │ - add_redirect()│    │                 │ │
│  │   path()        │    │ - add_mime_type()│   │                 │ │
│  │ - get_article_  │    │ - finalize()    │    │                 │ │
│  │   content()     │    │ - close()       │    │                 │ │
│  │ - get_main_page()│   │                 │    │                 │ │
│  │ - list_articles()│   │                 │    │                 │ │
│  └────────┬────────┘    └────────┬────────┘    └─────────────────┘ │
│           │                      │                                  │
│           ▼                      ▼                                  │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                     Data Structures                              ││
│  │                                                                  ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          ││
│  │  │  ZIMHeader   │  │DirectoryEntry│  │RedirectEntry │          ││
│  │  │              │  │              │  │              │          ││
│  │  │ @dataclass   │  │ @dataclass   │  │ @dataclass   │          ││
│  │  │              │  │              │  │              │          ││
│  │  │ magic_number │  │ mimetype_idx │  │ mimetype_idx │          ││
│  │  │ major_version│  │ namespace    │  │ namespace    │          ││
│  │  │ minor_version│  │ revision     │  │ revision     │          ││
│  │  │ entry_count  │  │ cluster_num  │  │ redirect_idx │          ││
│  │  │ article_count│  │ blob_number  │  │ url          │          ││
│  │  │ cluster_count│  │ url          │  │ title        │          ││
│  │  │ redirect_cnt │  │ title        │  │              │          ││
│  │  │ mime_type_pos│  │              │  │              │          ││
│  │  │ title_idx_pos│  │              │  │              │          ││
│  │  │ cluster_ptr  │  │              │  │              │          ││
│  │  │ main_page_idx│  │              │  │              │          ││
│  │  │ checksum_pos │  │              │  │              │          ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘          ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                     Compression Layer                            ││
│  │                                                                  ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          ││
│  │  │    zlib      │  │    lzma      │  │  uncompressed│          ││
│  │  │              │  │              │  │              │          ││
│  │  │ compress()   │  │ compress()   │  │  passthrough │          ││
│  │  │ decompress() │  │ decompress() │  │              │          ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘          ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. ZIMHeader

The `ZIMHeader` dataclass represents the 80-byte header at the beginning of every ZIM file.

```python
@dataclass
class ZIMHeader:
    magic_number: int      # 4 bytes - Always 0x4D495A5A ("ZZIM")
    major_version: int     # 2 bytes - Format major version
    minor_version: int     # 2 bytes - Format minor version
    entry_count: int       # 4 bytes - Total directory entries
    article_count: int     # 4 bytes - Number of articles
    cluster_count: int     # 4 bytes - Number of clusters
    redirect_count: int    # 4 bytes - Number of redirects
    mime_type_list_pos: int # 8 bytes - Position of MIME type list
    title_index_pos: int   # 8 bytes - Position of title index
    cluster_ptr_pos: int   # 8 bytes - Position of cluster pointer list
    cluster_count_pos: int # 8 bytes - Position of cluster count
    main_page_index: int   # 4 bytes - Index of main page entry
    layout_page_index: int # 4 bytes - Index of layout page entry
    checksum_pos: int      # 8 bytes - Position of MD5 checksum
```

**Binary Layout:**
```
Offset  Size  Field
0       4     Magic Number (0x4D495A5A)
4       2     Major Version
6       2     Minor Version
8       4     Entry Count
12      4     Article Count
16      4     Cluster Count
20      4     Redirect Count
24      8     MIME Type List Position
32      8     Title Index Position
40      8     Cluster Pointer Position
48      8     Cluster Count Position
56      4     Main Page Index
60      4     Layout Page Index
64      8     Checksum Position
72      8     Reserved/Padding
```

### 2. DirectoryEntry

Represents an article entry in the ZIM file.

```python
@dataclass
class DirectoryEntry:
    mimetype_index: int    # Index into MIME type list
    namespace: int         # Single byte namespace identifier
    revision: int          # Article revision number
    cluster_number: int    # Cluster containing the content
    blob_number: int       # Blob index within cluster
    url: str               # URL-encoded path
    title: str             # Human-readable title
```

**Binary Layout:**
```
Offset  Size     Field
0       4        MIME Type Index
4       1        Namespace
5       4        Revision
9       4        Cluster Number
13      4        Blob Number
17      variable URL (null-terminated)
        variable Title (null-terminated)
```

### 3. RedirectEntry

Represents a redirect entry pointing to another article.

```python
@dataclass
class RedirectEntry:
    mimetype_index: int    # Always 0xFFFF for redirects
    namespace: int         # Namespace of redirect
    revision: int          # Revision number
    redirect_index: int    # Index of target entry
    url: str               # Source URL
    title: str             # Redirect title
```

### 4. CompressionType Enum

```python
class CompressionType(IntEnum):
    DEFAULT = 0    # No compression
    NONE = 1       # Explicit no compression
    ZLIB = 2       # zlib/deflate compression
    BZIP2 = 3      # bzip2 compression
    LZMA = 4       # LZMA compression
    ZSTD = 5       # Zstandard compression
```

### 5. Namespace Enum

```python
class Namespace(IntEnum):
    MAIN_ARTICLE = ord('A')  # Main content articles
    IMAGE = ord('I')         # Images
    METADATA = ord('M')      # Metadata entries
    RAW_DATA = ord('-')      # Raw data blobs
    STYLE = ord('S')         # CSS stylesheets
    SCRIPT = ord('J')        # JavaScript files
    FONT = ord('T')          # Font files
    TRANSLATION = ord('U')   # Translation data
    VIDEO = ord('V')         # Video content
    AUDIO = ord('W')         # Audio content
```

## ZIMReader Architecture

### Initialization Flow

```
┌──────────────────┐
│   ZIMReader()    │
│   constructor    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│     open()       │
└────────┬─────────┘
         │
         ├─────────────────────────────────────┐
         │                                     │
         ▼                                     ▼
┌──────────────────┐                 ┌──────────────────┐
│  _read_header()  │                 │  Validate Magic  │
└────────┬─────────┘                 │     Number       │
         │                           └──────────────────┘
         ▼
┌──────────────────┐
│_read_mime_types()│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ _read_directory()│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│_read_cluster_    │
│   pointers()     │
└──────────────────┘
```

### Content Retrieval Flow

```
┌─────────────────────────────────────┐
│     get_article_content(entry)      │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  Lookup cluster offset from         │
│  cluster_offsets[entry.cluster_num] │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  Seek to cluster position           │
│  Read compression byte              │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  Read blob offset table             │
│  Calculate blob start/end positions │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  Read compressed blob data          │
└────────────────┬────────────────────┘
                 │
         ┌───────┴───────┐
         │               │
         ▼               ▼
┌─────────────┐   ┌─────────────┐
│ Decompress  │   │ Return raw  │
│ (zlib/lzma) │   │ (if none)   │
└──────┬──────┘   └──────┬──────┘
       │                 │
       └────────┬────────┘
                │
                ▼
┌─────────────────────────────────────┐
│         Return content bytes        │
└─────────────────────────────────────┘
```

## ZIMWriter Architecture

### Writing Flow

```
┌──────────────────┐
│   ZIMWriter()    │
│   constructor    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│    create()      │
│ Write placeholder│
│     header       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│  add_article()   │────▶│ add_mime_type()  │
│                  │     └──────────────────┘
│ - Create cluster │
│ - Store entry    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  add_redirect()  │
│                  │
│ - Store redirect │
│   entry          │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   finalize()     │
└────────┬─────────┘
         │
         ├──────────────────────────────────────┐
         │                                      │
         ▼                                      ▼
┌──────────────────┐              ┌──────────────────────┐
│ Calculate final  │              │ Write MIME type list │
│   positions      │              └──────────────────────┘
└────────┬─────────┘
         │
         ├──────────────────────────────────────┐
         │                                      │
         ▼                                      ▼
┌──────────────────┐              ┌──────────────────────┐
│ Write directory  │              │ Write index pointers │
│    entries       │              └──────────────────────┘
└────────┬─────────┘
         │
         ├──────────────────────────────────────┐
         │                                      │
         ▼                                      ▼
┌──────────────────┐              ┌──────────────────────┐
│ Write cluster    │              │   Write clusters     │
│   pointers       │              └──────────────────────┘
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Update header    │
│ with final values│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Write checksum   │
│   placeholder    │
└──────────────────┘
```

## Memory Management

### Reading Strategy

The Python implementation uses a file handle-based approach:

1. **Lazy Loading**: Directory entries are parsed on open, but article content is loaded on demand
2. **File Handle**: Single file handle maintained throughout reader lifecycle
3. **Seeking**: Direct file seeking for random access to clusters
4. **No Full Load**: Large ZIM files are never fully loaded into memory

### Writing Strategy

1. **In-Memory Buffering**: Entries and clusters stored in memory during construction
2. **Single Pass Write**: All data written in single finalize() call
3. **Position Calculation**: Final positions calculated before writing

## Thread Safety

The current implementation is **NOT thread-safe**. For concurrent access:

```python
import threading

lock = threading.Lock()

def get_article_safe(zim_reader, path):
    with lock:
        entry = zim_reader.get_entry_by_path(path)
        if entry:
            return zim_reader.get_article_content(entry)
    return None
```

## Error Handling

| Error Type | Condition | Handling |
|------------|-----------|----------|
| `ValueError` | Invalid magic number | Raised on open() |
| `ValueError` | File not opened | Raised on read operations |
| `ValueError` | Invalid blob number | Raised on content retrieval |
| `NotImplementedError` | Unsupported compression | Raised for BZIP2/ZSTD |

## Performance Characteristics

| Operation | Time Complexity | Space Complexity |
|-----------|-----------------|------------------|
| Open file | O(n) where n = entries | O(n) for directory |
| Get entry by path | O(n) linear search | O(1) |
| Get article content | O(1) seek + decompress | O(m) where m = content size |
| List articles | O(n) | O(n) for list |
| Write article | O(1) amortized | O(m) for content |
| Finalize | O(n + c) where c = clusters | O(total data size) |

## Dependencies

```
Standard Library Only:
├── struct          # Binary data packing/unpacking
├── zlib            # ZLIB compression
├── lzma            # LZMA compression
├── typing          # Type hints
├── dataclasses     # Data class decorators
└── enum            # Enumeration support
```

## Extension Points

### Adding New Compression

```python
# In get_article_content():
if compression_byte == CompressionType.ZSTD:
    import zstandard
    decompressor = zstandard.ZstdDecompressor()
    return decompressor.decompress(compressed_data)
```

### Custom Entry Types

```python
@dataclass
class CustomEntry(DirectoryEntry):
    custom_field: str
    
    @classmethod
    def from_bytes(cls, data: bytes) -> 'CustomEntry':
        base = DirectoryEntry.from_bytes(data)
        # Parse custom field
        return cls(**vars(base), custom_field=custom_value)
```

## File Format Compliance

This implementation complies with ZIM file format version 4 as specified by openZIM:
- Header structure: ✓ Compliant
- Directory entries: ✓ Compliant
- Cluster format: ✓ Compliant
- Namespace handling: ✓ Compliant
- MIME type list: ✓ Compliant
- Checksum: ⚠ Placeholder only (not computed)

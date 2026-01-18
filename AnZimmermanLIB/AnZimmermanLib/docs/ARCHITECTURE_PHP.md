Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
All rights reserved.
Unauthorized use without prior written consent is strictly prohibited.

# PHP ZIM Library Architecture

## Overview

The PHP ZIM library (`zimlib.php`) provides a complete implementation of ZIM file format reader and writer using PHP's native file handling and binary operations. It's designed for server-side applications, API backends, and content management systems.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              zimlib.php                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         Constants Classes                               │ │
│  │                                                                         │ │
│  │  ┌─────────────────────────┐    ┌─────────────────────────┐            │ │
│  │  │  ZIMCompressionType     │    │     ZIMNamespace        │            │ │
│  │  │                         │    │                         │            │ │
│  │  │ const DEFAULT = 0       │    │ const MAIN_ARTICLE = 65 │            │ │
│  │  │ const NONE = 1          │    │ const IMAGE = 73        │            │ │
│  │  │ const ZLIB = 2          │    │ const METADATA = 77     │            │ │
│  │  │ const BZIP2 = 3         │    │ const RAW_DATA = 45     │            │ │
│  │  │ const LZMA = 4          │    │ const STYLE = 83        │            │ │
│  │  │ const ZSTD = 5          │    │ const SCRIPT = 74       │            │ │
│  │  └─────────────────────────┘    └─────────────────────────┘            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         Data Classes                                    │ │
│  │                                                                         │ │
│  │  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────┐ │ │
│  │  │     ZIMHeader       │  │  ZIMDirectoryEntry  │  │ ZIMRedirectEntry│ │ │
│  │  │                     │  │                     │  │                 │ │ │
│  │  │ $magicNumber        │  │ $mimetypeIndex      │  │ $mimetypeIndex  │ │ │
│  │  │ $majorVersion       │  │ $namespace          │  │ $namespace      │ │ │
│  │  │ $minorVersion       │  │ $revision           │  │ $revision       │ │ │
│  │  │ $entryCount         │  │ $clusterNumber      │  │ $redirectIndex  │ │ │
│  │  │ $articleCount       │  │ $blobNumber         │  │ $url            │ │ │
│  │  │ $clusterCount       │  │ $url                │  │ $title          │ │ │
│  │  │ $redirectCount      │  │ $title              │  │                 │ │ │
│  │  │ $mimeTypeListPos    │  │                     │  │ fromBinary()    │ │ │
│  │  │ $titleIndexPos      │  │ fromBinary()        │  │ toBinary()      │ │ │
│  │  │ $clusterPtrPos      │  │ toBinary()          │  │                 │ │ │
│  │  │ $mainPageIndex      │  │                     │  │                 │ │ │
│  │  │ $checksumPos        │  │                     │  │                 │ │ │
│  │  │                     │  │                     │  │                 │ │ │
│  │  │ fromBinary()        │  │                     │  │                 │ │ │
│  │  │ toBinary()          │  │                     │  │                 │ │ │
│  │  └─────────────────────┘  └─────────────────────┘  └─────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─────────────────────────┐    ┌─────────────────────────┐                │
│  │    ZIMBinaryReader      │    │    ZIMBinaryWriter      │                │
│  │                         │    │                         │                │
│  │ private $data           │    │ private $data           │                │
│  │ private $position       │    │ private $position       │                │
│  │ private $length         │    │                         │                │
│  │                         │    │ ensureCapacity()        │                │
│  │ readUInt32LE()          │    │ writeUInt32LE()         │                │
│  │ readUInt16LE()          │    │ writeUInt16LE()         │                │
│  │ readUInt8()             │    │ writeUInt8()            │                │
│  │ readUInt64LE()          │    │ writeUInt64LE()         │                │
│  │ readNullTerminated      │    │ writeNullTerminated     │                │
│  │   String()              │    │   String()              │                │
│  │ seek()                  │    │ seek()                  │                │
│  │ readBytes()             │    │ writeBytes()            │                │
│  │ isEOF()                 │    │ getBuffer()             │                │
│  └─────────────────────────┘    └─────────────────────────┘                │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         Main Classes                                     ││
│  │                                                                          ││
│  │  ┌───────────────────────────────┐  ┌───────────────────────────────┐   ││
│  │  │          ZIMReader            │  │          ZIMWriter            │   ││
│  │  │                               │  │                               │   ││
│  │  │ private $filePath             │  │ private $filePath             │   ││
│  │  │ private $fileHandle           │  │ private $mimeTypes            │   ││
│  │  │ private $header               │  │ private $directoryEntries     │   ││
│  │  │ private $mimeTypes            │  │ private $clusters             │   ││
│  │  │ private $directoryEntries     │  │ private $mainPageIndex        │   ││
│  │  │ private $clusterOffsets       │  │                               │   ││
│  │  │                               │  │ create()                      │   ││
│  │  │ open()                        │  │ addMimeType()                 │   ││
│  │  │ close()                       │  │ addArticle()                  │   ││
│  │  │ readHeader()                  │  │ addRedirect()                 │   ││
│  │  │ readMimeTypes()               │  │ createCluster()               │   ││
│  │  │ readDirectory()               │  │ finalize()                    │   ││
│  │  │ readClusterPointers()         │  │ close()                       │   ││
│  │  │ getEntryByPath()              │  │                               │   ││
│  │  │ getArticleContent()           │  │                               │   ││
│  │  │ getMainPage()                 │  │                               │   ││
│  │  │ listArticles()                │  │                               │   ││
│  │  │ getMimeTypes()                │  │                               │   ││
│  │  │ getHeader()                   │  │                               │   ││
│  │  └───────────────────────────────┘  └───────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                      Utility Functions                                   ││
│  │                                                                          ││
│  │  function readZIMFile($filePath) { return new ZIMReader($filePath); }   ││
│  │  function createZIMFile($filePath) { return new ZIMWriter($filePath); } ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. ZIMHeader Class

```php
class ZIMHeader {
    public $magicNumber;      // uint32 - 0x4D495A5A
    public $majorVersion;     // uint16 - Format version
    public $minorVersion;     // uint16 - Format version
    public $entryCount;       // uint32 - Total entries
    public $articleCount;     // uint32 - Article count
    public $clusterCount;     // uint32 - Cluster count
    public $redirectCount;    // uint32 - Redirect count
    public $mimeTypeListPos;  // uint64 - MIME list position
    public $titleIndexPos;    // uint64 - Title index position
    public $clusterPtrPos;    // uint64 - Cluster pointer position
    public $clusterCountPos;  // uint64 - Cluster count position
    public $mainPageIndex;    // uint32 - Main page index
    public $layoutPageIndex;  // uint32 - Layout page index
    public $checksumPos;      // uint64 - Checksum position

    public function __construct($data = null);
    public function fromBinary($data);
    public function toBinary();
}
```

### Binary Pack/Unpack Format Strings

```php
// Header unpacking
$unpack = unpack(
    'Imagic/'.      // I = unsigned int (32-bit)
    'Hmajor/'.      // H = unsigned short (16-bit)
    'Hminor/'.      // 
    'Ientry/'.      // 
    'Iarticle/'.    // 
    'Icluster/'.    // 
    'Iredirect/'.   // 
    'Qmime/'.       // Q = unsigned long long (64-bit)
    'Qtitle/'.      // 
    'QclusterPtr/'. // 
    'QclusterCount/'.// 
    'Imain/'.       // 
    'Ilayout/'.     // 
    'Qchecksum',    // 
    $data
);
```

### 2. ZIMDirectoryEntry Class

```php
class ZIMDirectoryEntry {
    public $mimetypeIndex;    // uint32 - MIME type index
    public $namespace;        // byte - Namespace identifier
    public $revision;         // uint32 - Entry revision
    public $clusterNumber;    // uint32 - Cluster number
    public $blobNumber;       // uint32 - Blob index
    public $url;              // string - URL path
    public $title;            // string - Human-readable title

    public function __construct($data = null);
    public function fromBinary($data);
    public function toBinary();
}
```

### 3. ZIMRedirectEntry Class

```php
class ZIMRedirectEntry {
    public $mimetypeIndex;    // uint32 - Always 0xFFFF
    public $namespace;        // byte - Namespace
    public $revision;         // uint32 - Revision
    public $redirectIndex;    // uint32 - Target entry index
    public $url;              // string - Source URL
    public $title;            // string - Redirect title

    public function __construct($data = null);
    public function fromBinary($data);
    public function toBinary();
}
```

## ZIMReader Architecture

### Class Definition

```php
class ZIMReader {
    private $filePath;
    private $fileHandle;
    private $header;
    private $mimeTypes = array();
    private $directoryEntries = array();
    private $clusterOffsets = array();

    public function __construct($filePath);
    
    public function open();
    public function close();
    
    private function readHeader();
    private function readMimeTypes();
    private function readDirectory();
    private function readClusterPointers();
    
    public function getEntryByPath($path);
    public function getArticleContent($entry);
    public function getMainPage();
    public function listArticles();
    public function getMimeTypes();
    public function getHeader();
}
```

### File Handle Management

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHP File Handle Lifecycle                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                                               │
│  │ fopen()      │ ◄─── Open file in binary read mode ('rb')     │
│  │              │                                               │
│  │ $fileHandle  │                                               │
│  └──────┬───────┘                                               │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────────────────────────┐                  │
│  │              File Operations              │                  │
│  │                                           │                  │
│  │  fseek($handle, $pos)  - Move position   │                  │
│  │  fread($handle, $len)  - Read bytes      │                  │
│  │  ftell($handle)        - Get position    │                  │
│  │                                           │                  │
│  └──────────────────────────────────────────┘                  │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐                                               │
│  │ fclose()     │ ◄─── Close file handle                        │
│  │              │                                               │
│  │ $handle=null │                                               │
│  └──────────────┘                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Reading Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        ZIMReader->open()                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              fopen($this->filePath, 'rb')                        │
│              Check for false return (file not found)             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      readHeader()                                │
│                                                                  │
│  fseek($handle, 0)                                               │
│  $headerData = fread($handle, 80)                                │
│  $this->header = new ZIMHeader($headerData)                      │
│                                                                  │
│  if ($header->magicNumber !== 0x4D495A5A)                        │
│      throw new Exception("Invalid ZIM file format")              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     readMimeTypes()                              │
│                                                                  │
│  fseek($handle, $header->mimeTypeListPos)                        │
│                                                                  │
│  while (true) {                                                  │
│      $chunk = fread($handle, 1024)                               │
│      $data .= $chunk                                             │
│      if (strpos($data, "\x00\x00") !== false) break             │
│  }                                                               │
│                                                                  │
│  $mimeTypes = explode("\x00", $data)                             │
│  $mimeTypes = array_filter($mimeTypes)                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      readDirectory()                             │
│                                                                  │
│  fseek($handle, 80)  // After header                             │
│                                                                  │
│  // Read index pointer list                                      │
│  for ($i = 0; $i < $entryCount; $i++) {                          │
│      $ptrData = fread($handle, 8)                                │
│      $indexPointers[] = unpack('Q', $ptrData)[1]                 │
│  }                                                               │
│                                                                  │
│  // Read each entry                                              │
│  foreach ($indexPointers as $ptr) {                              │
│      fseek($handle, $ptr)                                        │
│      $mimetype = unpack('I', fread($handle, 4))[1]               │
│                                                                  │
│      if ($mimetype === 0xFFFF) {                                 │
│          $entry = new ZIMRedirectEntry($entryData)               │
│      } else {                                                    │
│          $entry = new ZIMDirectoryEntry($entryData)              │
│      }                                                           │
│      $directoryEntries[] = $entry                                │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   readClusterPointers()                          │
│                                                                  │
│  fseek($handle, $header->clusterPtrPos)                          │
│                                                                  │
│  for ($i = 0; $i < $clusterCount; $i++) {                        │
│      $ptrData = fread($handle, 8)                                │
│      $clusterOffsets[] = unpack('Q', $ptrData)[1]                │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Content Retrieval

```php
public function getArticleContent($entry) {
    // Validate entry type
    if (!($entry instanceof ZIMDirectoryEntry)) {
        throw new Exception("Entry must be a directory entry");
    }

    // Get cluster offset
    $clusterOffset = $this->clusterOffsets[$entry->clusterNumber];
    fseek($this->fileHandle, $clusterOffset);
    
    // Read compression type
    $compressionByte = ord(fread($this->fileHandle, 1));
    
    // Read blob offsets until we find zero
    $blobOffsets = array();
    while (true) {
        $offsetData = fread($this->fileHandle, 4);
        $offset = unpack('I', $offsetData)[1];
        $blobOffsets[] = $offset;
        if ($offset === 0) break;
    }
    
    // Calculate blob position and size
    $blobStart = $blobOffsets[$entry->blobNumber];
    $blobEnd = $blobOffsets[$entry->blobNumber + 1];
    $blobSize = $blobEnd - $blobStart;
    
    // Read and decompress blob data
    $currentPos = ftell($this->fileHandle);
    fseek($this->fileHandle, $currentPos + $blobStart);
    $blobData = fread($this->fileHandle, $blobSize);
    
    // Decompress based on compression type
    switch ($compressionByte) {
        case ZIMCompressionType::ZLIB:
            return gzuncompress($blobData);
        case ZIMCompressionType::DEFAULT:
        case ZIMCompressionType::NONE:
            return $blobData;
        default:
            throw new Exception("Unsupported compression: $compressionByte");
    }
}
```

## ZIMWriter Architecture

### Class Definition

```php
class ZIMWriter {
    private $filePath;
    private $mimeTypes = array();
    private $directoryEntries = array();
    private $clusters = array();
    private $mainPageIndex = 0;

    public function __construct($filePath);
    
    public function create();
    public function addMimeType($mimeType);
    public function addArticle($namespace, $url, $title, $content, $mimeType);
    public function addRedirect($namespace, $url, $title, $redirectIndex);
    private function createCluster($blobs, $compression);
    public function finalize();
    public function close();
}
```

### Writing Flow

```
┌────────────────────┐
│     create()       │
│                    │
│ Open file 'wb'     │
│ Write 80-byte      │
│ placeholder header │
│ Close file         │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐     ┌────────────────────┐
│   addArticle()     │────▶│   addMimeType()    │
│                    │     │                    │
│ Get/create MIME idx│     │ Check if exists    │
│ createCluster()    │     │ Add if new         │
│ Create entry obj   │     │ Return index       │
│ Add to entries[]   │     └────────────────────┘
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│   addRedirect()    │
│                    │
│ Create redirect    │
│ entry with 0xFFFF  │
│ mimetype marker    │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│    finalize()      │
└─────────┬──────────┘
          │
          ├─── Calculate all positions
          │
          ├─── Build MIME type string with \x00\x00 terminator
          │
          ├─── Serialize all directory entries
          │
          ├─── Build index pointer list (8 bytes each)
          │
          ├─── Build cluster pointer list (8 bytes each)
          │
          ├─── Create final header with real values
          │
          ├─── Write everything to file in order:
          │    1. Header (80 bytes)
          │    2. MIME type list
          │    3. Directory entries
          │    4. Index pointer list
          │    5. Cluster pointer list
          │    6. Clusters
          │    7. Checksum placeholder (16 bytes)
          │
          └─── Close file
```

## Binary Operations in PHP

### Pack/Unpack Reference

```php
// Pack format characters
'C' - unsigned char (1 byte)
'S' - unsigned short (2 bytes, machine byte order)
'I' - unsigned int (4 bytes, machine byte order)
'Q' - unsigned long long (8 bytes, machine byte order)
'a' - NUL-padded string
'A' - SPACE-padded string

// Little-endian variants (PHP 5.6.3+)
'v' - unsigned short (2 bytes, little endian)
'V' - unsigned long (4 bytes, little endian)
'P' - unsigned long long (8 bytes, little endian)

// Examples
$packed = pack('V', 0x4D495A5A);  // Pack magic number
$unpacked = unpack('V', $data);   // Unpack to array
```

### String Handling

```php
// Reading null-terminated strings
function readNullTerminatedString($data, $start) {
    $nullPos = strpos($data, "\x00", $start);
    if ($nullPos === false) {
        return substr($data, $start);
    }
    return substr($data, $start, $nullPos - $start);
}

// Writing null-terminated strings
function writeNullTerminatedString($str) {
    return $str . "\x00";
}
```

## Memory Management

### PHP Memory Considerations

```php
// Check available memory
$memoryLimit = ini_get('memory_limit');
$currentUsage = memory_get_usage(true);

// For large ZIM files, consider streaming
ini_set('memory_limit', '512M');  // Increase if needed

// Use generators for large entry lists
function iterateEntries($entries) {
    foreach ($entries as $entry) {
        yield $entry;
    }
}
```

### File Pointer vs Full Load

```
┌─────────────────────────────────────────────────────────────────┐
│                   Memory Strategy Comparison                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  File Pointer Approach (Current Implementation)                  │
│  ├── Uses fopen/fseek/fread                                      │
│  ├── Low memory footprint                                        │
│  ├── Slower random access (seeks)                                │
│  └── Better for large files                                      │
│                                                                  │
│  Full Load Approach (Alternative)                                │
│  ├── Uses file_get_contents                                      │
│  ├── High memory footprint                                       │
│  ├── Fast random access (array index)                            │
│  └── Better for small files                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Error Handling

```php
class ZIMException extends Exception {}
class ZIMFormatException extends ZIMException {}
class ZIMCompressionException extends ZIMException {}
class ZIMNotFoundException extends ZIMException {}

// Usage in ZIMReader
public function open() {
    $this->fileHandle = fopen($this->filePath, 'rb');
    if (!$this->fileHandle) {
        throw new ZIMNotFoundException(
            "Cannot open ZIM file: " . $this->filePath
        );
    }
    
    // Validate format
    $this->readHeader();
    if ($this->header->magicNumber !== 0x4D495A5A) {
        throw new ZIMFormatException("Invalid ZIM file format");
    }
}
```

## Compression Support

| Type | PHP Function | Support Level |
|------|--------------|---------------|
| None | N/A | ✓ Native |
| ZLIB | `gzcompress()` / `gzuncompress()` | ✓ Native |
| BZIP2 | `bzcompress()` / `bzdecompress()` | ✓ With ext-bz2 |
| LZMA | N/A | ⚠ Requires ext-lzma |
| ZSTD | N/A | ⚠ Requires ext-zstd |

### Adding ZSTD Support

```php
// If zstd extension is available
if (function_exists('zstd_uncompress')) {
    $decompressed = zstd_uncompress($compressed);
}
```

## Performance Optimization

### Index Caching

```php
class CachedZIMReader extends ZIMReader {
    private $entryCache = array();
    private $contentCache = array();
    private $maxCacheSize = 100;
    
    public function getEntryByPath($path) {
        if (isset($this->entryCache[$path])) {
            return $this->entryCache[$path];
        }
        
        $entry = parent::getEntryByPath($path);
        
        if (count($this->entryCache) >= $this->maxCacheSize) {
            array_shift($this->entryCache);  // Remove oldest
        }
        $this->entryCache[$path] = $entry;
        
        return $entry;
    }
}
```

### Lazy Loading

```php
class LazyZIMReader extends ZIMReader {
    private $directoryLoaded = false;
    
    public function getEntryByPath($path) {
        if (!$this->directoryLoaded) {
            $this->loadDirectory();
            $this->directoryLoaded = true;
        }
        return parent::getEntryByPath($path);
    }
}
```

## API Integration Example

### Laravel Controller

```php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ZIMController extends Controller {
    private $zimReader;
    
    public function __construct() {
        $this->zimReader = new \ZIMReader(storage_path('zim/wikipedia.zim'));
        $this->zimReader->open();
    }
    
    public function getArticle(Request $request, $path) {
        $entry = $this->zimReader->getEntryByPath('A/' . $path);
        
        if (!$entry || !($entry instanceof \ZIMDirectoryEntry)) {
            return response()->json(['error' => 'Article not found'], 404);
        }
        
        $content = $this->zimReader->getArticleContent($entry);
        
        return response($content)
            ->header('Content-Type', 'text/html; charset=utf-8');
    }
    
    public function __destruct() {
        $this->zimReader->close();
    }
}
```

### Slim Framework Route

```php
$app->get('/zim/{path:.*}', function ($request, $response, $args) {
    $zimReader = new ZIMReader('/var/zim/wikipedia.zim');
    $zimReader->open();
    
    $entry = $zimReader->getEntryByPath('A/' . $args['path']);
    
    if ($entry && $entry instanceof ZIMDirectoryEntry) {
        $content = $zimReader->getArticleContent($entry);
        $response->getBody()->write($content);
        return $response->withHeader('Content-Type', 'text/html');
    }
    
    $zimReader->close();
    return $response->withStatus(404);
});
```

## PHP Version Compatibility

| Feature | PHP 7.0+ | PHP 8.0+ |
|---------|----------|----------|
| Core functionality | ✓ | ✓ |
| 64-bit integers | ✓ | ✓ |
| Typed properties | ❌ | ✓ |
| Named arguments | ❌ | ✓ |
| Match expression | ❌ | ✓ |

### PHP 8.0+ Enhancements

```php
// Using typed properties (PHP 8.0+)
class ZIMHeader {
    public int $magicNumber;
    public int $majorVersion;
    public int $minorVersion;
    // ...
}

// Using match expression for compression
$decompressed = match($compressionByte) {
    ZIMCompressionType::ZLIB => gzuncompress($data),
    ZIMCompressionType::BZIP2 => bzdecompress($data),
    ZIMCompressionType::DEFAULT, 
    ZIMCompressionType::NONE => $data,
    default => throw new ZIMCompressionException($compressionByte),
};
```

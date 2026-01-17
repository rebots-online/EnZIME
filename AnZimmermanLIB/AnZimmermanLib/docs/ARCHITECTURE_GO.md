# Go ZIM Library Architecture

## Overview

The Go ZIM library (`zimlib.go`) provides a high-performance, idiomatic Go implementation of the ZIM file format reader and writer. It leverages Go's strong typing, efficient memory management, and excellent concurrency support for building scalable ZIM-based services.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              zimlib.go                                       │
│                           package zimlib                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         Type Definitions                                │ │
│  │                                                                         │ │
│  │  ┌─────────────────────────┐    ┌─────────────────────────┐            │ │
│  │  │   CompressionType       │    │      Namespace          │            │ │
│  │  │      (type byte)        │    │      (type byte)        │            │ │
│  │  │                         │    │                         │            │ │
│  │  │ CompressionDefault = 0  │    │ NamespaceMainArticle='A'│            │ │
│  │  │ CompressionNone = 1     │    │ NamespaceImage = 'I'    │            │ │
│  │  │ CompressionZlib = 2     │    │ NamespaceMetadata = 'M' │            │ │
│  │  │ CompressionBzip2 = 3    │    │ NamespaceRawData = '-'  │            │ │
│  │  │ CompressionLZMA = 4     │    │ NamespaceStyle = 'S'    │            │ │
│  │  │ CompressionZSTD = 5     │    │ NamespaceScript = 'J'   │            │ │
│  │  └─────────────────────────┘    └─────────────────────────┘            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         Struct Definitions                              │ │
│  │                                                                         │ │
│  │  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────┐ │ │
│  │  │       Header        │  │   DirectoryEntry    │  │  RedirectEntry  │ │ │
│  │  │                     │  │                     │  │                 │ │ │
│  │  │ MagicNumber uint32  │  │ MimetypeIndex uint32│  │ MimetypeIndex   │ │ │
│  │  │ MajorVersion uint16 │  │ Namespace Namespace │  │ Namespace       │ │ │
│  │  │ MinorVersion uint16 │  │ Revision uint32     │  │ Revision        │ │ │
│  │  │ EntryCount uint32   │  │ ClusterNumber uint32│  │ RedirectIndex   │ │ │
│  │  │ ArticleCount uint32 │  │ BlobNumber uint32   │  │ URL string      │ │ │
│  │  │ ClusterCount uint32 │  │ URL string          │  │ Title string    │ │ │
│  │  │ RedirectCount uint32│  │ Title string        │  │                 │ │ │
│  │  │ MimeTypeListPos u64 │  │                     │  │                 │ │ │
│  │  │ TitleIndexPos uint64│  │                     │  │                 │ │ │
│  │  │ ClusterPtrPos uint64│  │                     │  │                 │ │ │
│  │  │ MainPageIndex uint32│  │                     │  │                 │ │ │
│  │  │ ChecksumPos uint64  │  │                     │  │                 │ │ │
│  │  └─────────────────────┘  └─────────────────────┘  └─────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─────────────────────────┐    ┌─────────────────────────┐                │
│  │     BinaryReader        │    │     BinaryWriter        │                │
│  │                         │    │                         │                │
│  │ data []byte             │    │ data []byte             │                │
│  │ position int            │    │ position int            │                │
│  │                         │    │                         │                │
│  │ ReadUInt32LE() uint32   │    │ WriteUInt32LE(uint32)   │                │
│  │ ReadUInt16LE() uint16   │    │ WriteUInt16LE(uint16)   │                │
│  │ ReadUInt8() byte        │    │ WriteUInt8(byte)        │                │
│  │ ReadUInt64LE() uint64   │    │ WriteUInt64LE(uint64)   │                │
│  │ ReadNullTerminated      │    │ WriteNullTerminated     │                │
│  │   String() string       │    │   String(string)        │                │
│  │ Seek(int)               │    │ Seek(int)               │                │
│  │ ReadBytes(int) []byte   │    │ WriteBytes([]byte)      │                │
│  │ IsEOF() bool            │    │ GetBuffer() []byte      │                │
│  └─────────────────────────┘    └─────────────────────────┘                │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                           Main Types                                     ││
│  │                                                                          ││
│  │  ┌───────────────────────────────┐  ┌───────────────────────────────┐   ││
│  │  │            Reader             │  │            Writer             │   ││
│  │  │                               │  │                               │   ││
│  │  │ filePath string               │  │ filePath string               │   ││
│  │  │ file *os.File                 │  │ mimeTypes []string            │   ││
│  │  │ data []byte                   │  │ directoryEntries []interface{}│   ││
│  │  │ header *Header                │  │ clusters [][]byte             │   ││
│  │  │ mimeTypes []string            │  │ mainPageIndex int             │   ││
│  │  │ directoryEntries []interface{}│  │                               │   ││
│  │  │ clusterOffsets []uint64       │  │ Create() error                │   ││
│  │  │                               │  │ AddMimeType(string) int       │   ││
│  │  │ Open() error                  │  │ AddArticle(...) error         │   ││
│  │  │ Close() error                 │  │ AddRedirect(...) error        │   ││
│  │  │ GetEntryByPath(string)        │  │ Finalize() error              │   ││
│  │  │   interface{}                 │  │ Close() error                 │   ││
│  │  │ GetArticleContent(*Directory  │  │                               │   ││
│  │  │   Entry) ([]byte, error)      │  │                               │   ││
│  │  │ GetMainPage() interface{}     │  │                               │   ││
│  │  │ ListArticles() []*Directory   │  │                               │   ││
│  │  │   Entry                       │  │                               │   ││
│  │  │ GetMimeTypes() []string       │  │                               │   ││
│  │  │ GetHeader() *Header           │  │                               │   ││
│  │  └───────────────────────────────┘  └───────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                      Factory Functions                                   ││
│  │                                                                          ││
│  │  func NewReader(filePath string) *Reader                                 ││
│  │  func NewWriter(filePath string) *Writer                                 ││
│  │  func ReadZIMFile(filePath string) *Reader                               ││
│  │  func CreateZIMFile(filePath string) *Writer                             ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Type Definitions

#### Compression Types

```go
type CompressionType byte

const (
    CompressionDefault CompressionType = 0  // No compression
    CompressionNone    CompressionType = 1  // Explicit no compression
    CompressionZlib    CompressionType = 2  // zlib/deflate
    CompressionBzip2   CompressionType = 3  // bzip2
    CompressionLZMA    CompressionType = 4  // LZMA
    CompressionZSTD    CompressionType = 5  // Zstandard
)
```

#### Namespace Types

```go
type Namespace byte

const (
    NamespaceMainArticle  Namespace = 'A'  // Main content
    NamespaceImage        Namespace = 'I'  // Images
    NamespaceMetadata     Namespace = 'M'  // Metadata
    NamespaceRawData      Namespace = '-'  // Raw data
    NamespaceStyle        Namespace = 'S'  // CSS
    NamespaceScript       Namespace = 'J'  // JavaScript
    NamespaceFont         Namespace = 'T'  // Fonts
    NamespaceTranslation  Namespace = 'U'  // Translations
    NamespaceVideo        Namespace = 'V'  // Video
    NamespaceAudio        Namespace = 'W'  // Audio
)
```

### 2. Header Struct

```go
type Header struct {
    MagicNumber       uint32  // 0x4D495A5A ("ZZIM")
    MajorVersion      uint16  // Format major version
    MinorVersion      uint16  // Format minor version
    EntryCount        uint32  // Total directory entries
    ArticleCount      uint32  // Number of articles
    ClusterCount      uint32  // Number of clusters
    RedirectCount     uint32  // Number of redirects
    MimeTypeListPos   uint64  // Position of MIME type list
    TitleIndexPos     uint64  // Position of title index
    ClusterPtrPos     uint64  // Position of cluster pointers
    ClusterCountPos   uint64  // Position of cluster count
    MainPageIndex     uint32  // Index of main page entry
    LayoutPageIndex   uint32  // Index of layout page entry
    ChecksumPos       uint64  // Position of MD5 checksum
}
```

### 3. DirectoryEntry Struct

```go
type DirectoryEntry struct {
    MimetypeIndex  uint32     // Index into MIME type list
    Namespace      Namespace  // Namespace identifier
    Revision       uint32     // Entry revision
    ClusterNumber  uint32     // Cluster containing content
    BlobNumber     uint32     // Blob index within cluster
    URL            string     // URL-encoded path
    Title          string     // Human-readable title
}
```

### 4. RedirectEntry Struct

```go
type RedirectEntry struct {
    MimetypeIndex  uint32     // Always 0xFFFF for redirects
    Namespace      Namespace  // Namespace identifier
    Revision       uint32     // Entry revision
    RedirectIndex  uint32     // Index of target entry
    URL            string     // Source URL
    Title          string     // Redirect title
}
```

## Binary Reader/Writer

### BinaryReader

```go
type BinaryReader struct {
    data     []byte
    position int
}

func NewBinaryReader(data []byte) *BinaryReader {
    return &BinaryReader{
        data:     data,
        position: 0,
    }
}

func (r *BinaryReader) ReadUInt32LE() uint32 {
    value := binary.LittleEndian.Uint32(r.data[r.position : r.position+4])
    r.position += 4
    return value
}

func (r *BinaryReader) ReadUInt64LE() uint64 {
    value := binary.LittleEndian.Uint64(r.data[r.position : r.position+8])
    r.position += 8
    return value
}

func (r *BinaryReader) ReadNullTerminatedString() string {
    start := r.position
    for r.position < len(r.data) && r.data[r.position] != 0 {
        r.position++
    }
    str := string(r.data[start:r.position])
    r.position++ // Skip null terminator
    return str
}
```

### BinaryWriter

```go
type BinaryWriter struct {
    data     []byte
    position int
}

func NewBinaryWriter(initialSize int) *BinaryWriter {
    return &BinaryWriter{
        data:     make([]byte, initialSize),
        position: 0,
    }
}

func (w *BinaryWriter) ensureCapacity(additionalBytes int) {
    if w.position+additionalBytes > len(w.data) {
        newSize := max(len(w.data)*2, w.position+additionalBytes)
        newData := make([]byte, newSize)
        copy(newData, w.data)
        w.data = newData
    }
}

func (w *BinaryWriter) WriteUInt32LE(value uint32) {
    w.ensureCapacity(4)
    binary.LittleEndian.PutUint32(w.data[w.position:w.position+4], value)
    w.position += 4
}
```

## Reader Architecture

### Struct Definition

```go
type Reader struct {
    filePath         string
    file             *os.File
    data             []byte
    header           *Header
    mimeTypes        []string
    directoryEntries []interface{}  // *DirectoryEntry or *RedirectEntry
    clusterOffsets   []uint64
}
```

### Initialization Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    NewReader(filePath)                           │
│                                                                  │
│  return &Reader{filePath: filePath}                              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Open() error                              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     os.Open(r.filePath)                          │
│                                                                  │
│  file, err := os.Open(r.filePath)                                │
│  if err != nil { return fmt.Errorf("cannot open: %w", err) }    │
│  r.file = file                                                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Read entire file into memory                  │
│                                                                  │
│  fileInfo, _ := file.Stat()                                      │
│  r.data = make([]byte, fileInfo.Size())                          │
│  file.Read(r.data)                                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      readHeader() error                          │
│                                                                  │
│  reader := NewBinaryReader(r.data)                               │
│  r.header = &Header{                                             │
│      MagicNumber:     reader.ReadUInt32LE(),                     │
│      MajorVersion:    reader.ReadUInt16LE(),                     │
│      ...                                                         │
│  }                                                               │
│                                                                  │
│  if r.header.MagicNumber != 0x4D495A5A {                         │
│      return errors.New("invalid ZIM file format")                │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    readMimeTypes() error                         │
│                                                                  │
│  startPos := int(r.header.MimeTypeListPos)                       │
│  reader := NewBinaryReader(r.data[startPos:])                    │
│                                                                  │
│  // Read until double null terminator                            │
│  mimeTypesString := string(mimeTypesData)                        │
│  r.mimeTypes = strings.Split(mimeTypesString, "\x00")            │
│  // Filter empty strings                                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    readDirectory() error                         │
│                                                                  │
│  // Read index pointers starting at offset 80                    │
│  indexPointers := make([]uint64, r.header.EntryCount)            │
│  for i := 0; i < int(r.header.EntryCount); i++ {                 │
│      indexPointers[i] = reader.ReadUInt64LE()                    │
│  }                                                               │
│                                                                  │
│  // Read each entry                                              │
│  for _, ptr := range indexPointers {                             │
│      entryReader := NewBinaryReader(r.data[ptr:])                │
│      mimetype := entryReader.ReadUInt32LE()                      │
│                                                                  │
│      if mimetype == 0xFFFF {                                     │
│          entry := r.readRedirectEntry(entryReader)               │
│      } else {                                                    │
│          entry := r.readDirectoryEntry(entryReader)              │
│      }                                                           │
│      r.directoryEntries = append(r.directoryEntries, entry)      │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  readClusterPointers() error                     │
│                                                                  │
│  startPos := int(r.header.ClusterPtrPos)                         │
│  reader := NewBinaryReader(r.data[startPos:])                    │
│                                                                  │
│  r.clusterOffsets = make([]uint64, r.header.ClusterCount)        │
│  for i := 0; i < int(r.header.ClusterCount); i++ {               │
│      r.clusterOffsets[i] = reader.ReadUInt64LE()                 │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Content Retrieval

```go
func (r *Reader) GetArticleContent(entry *DirectoryEntry) ([]byte, error) {
    if r.data == nil || r.header == nil {
        return nil, errors.New("file not opened or header not parsed")
    }

    // Validate cluster number
    if int(entry.ClusterNumber) >= len(r.clusterOffsets) {
        return nil, errors.New("invalid cluster number")
    }

    // Get cluster offset and create reader
    clusterOffset := int(r.clusterOffsets[entry.ClusterNumber])
    clusterReader := NewBinaryReader(r.data[clusterOffset:])

    // Read compression type
    compressionByte := clusterReader.ReadUInt8()

    // Read blob offsets
    var blobOffsets []uint32
    for {
        offset := clusterReader.ReadUInt32LE()
        blobOffsets = append(blobOffsets, offset)
        if offset == 0 {
            break
        }
    }

    // Calculate blob position
    blobStart := blobOffsets[entry.BlobNumber]
    blobEnd := blobOffsets[entry.BlobNumber+1]
    blobSize := blobEnd - blobStart

    // Read blob data
    currentPos := clusterReader.GetPosition()
    clusterReader.Seek(currentPos + int(blobStart))
    blobData := clusterReader.ReadBytes(int(blobSize))

    // Decompress if needed
    return r.decompress(CompressionType(compressionByte), blobData)
}

func (r *Reader) decompress(compression CompressionType, data []byte) ([]byte, error) {
    switch compression {
    case CompressionDefault, CompressionNone:
        return data, nil
    case CompressionZlib:
        reader := flate.NewReader(bytes.NewReader(data))
        defer reader.Close()
        var decompressed bytes.Buffer
        _, err := io.Copy(&decompressed, reader)
        return decompressed.Bytes(), err
    case CompressionLZMA:
        return nil, errors.New("LZMA compression not implemented")
    default:
        return nil, fmt.Errorf("unsupported compression: %d", compression)
    }
}
```

## Writer Architecture

### Struct Definition

```go
type Writer struct {
    filePath       string
    mimeTypes      []string
    directoryEntries []interface{}
    clusters       [][]byte
    mainPageIndex  int
}
```

### Writing Flow

```
┌────────────────────┐
│   NewWriter()      │
│                    │
│ return &Writer{    │
│   filePath: path,  │
│ }                  │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│    Create()        │
│                    │
│ file, _ := os.     │
│   Create(path)     │
│ Write 80-byte      │
│ placeholder header │
│ file.Close()       │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐     ┌────────────────────┐
│   AddArticle()     │────▶│   AddMimeType()    │
│                    │     │                    │
│ Get MIME index     │     │ Check existing     │
│ createCluster()    │     │ Append if new      │
│ Append entry       │     │ Return index       │
└─────────┬──────────┘     └────────────────────┘
          │
          ▼
┌────────────────────┐
│   AddRedirect()    │
│                    │
│ Create redirect    │
│ with 0xFFFF marker │
│ Append to entries  │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│    Finalize()      │
└─────────┬──────────┘
          │
          ├─── Calculate positions
          ├─── Build MIME type string
          ├─── Serialize entries
          ├─── Build pointer lists
          ├─── Write to file:
          │    ├── Header
          │    ├── MIME types
          │    ├── Directory entries
          │    ├── Index pointers
          │    ├── Cluster pointers
          │    ├── Clusters
          │    └── Checksum placeholder
          └─── Close file
```

### Cluster Creation

```go
func (w *Writer) createCluster(blobs [][]byte, compression CompressionType) ([]byte, error) {
    // Calculate offsets
    offsets := []uint32{0}
    var currentOffset uint32
    for _, blob := range blobs {
        currentOffset += uint32(len(blob))
        offsets = append(offsets, currentOffset)
    }

    writer := NewBinaryWriter(1024)
    writer.WriteUInt8(byte(compression))

    // Write offsets
    for _, offset := range offsets {
        writer.WriteUInt32LE(offset)
    }

    // Write blob data
    for _, blob := range blobs {
        writer.WriteBytes(blob)
    }

    return writer.GetBuffer(), nil
}
```

## Error Handling

### Go Idiomatic Errors

```go
// Custom error types
var (
    ErrInvalidFormat    = errors.New("invalid ZIM file format")
    ErrFileNotOpened    = errors.New("file not opened")
    ErrInvalidCluster   = errors.New("invalid cluster number")
    ErrInvalidBlob      = errors.New("invalid blob number")
    ErrUnsupportedComp  = errors.New("unsupported compression type")
)

// Wrapped errors with context
func (r *Reader) Open() error {
    file, err := os.Open(r.filePath)
    if err != nil {
        return fmt.Errorf("cannot open ZIM file %s: %w", r.filePath, err)
    }
    // ...
}

// Error checking pattern
func example() {
    reader := NewReader("file.zim")
    if err := reader.Open(); err != nil {
        if errors.Is(err, ErrInvalidFormat) {
            // Handle invalid format
        }
        log.Fatal(err)
    }
    defer reader.Close()
}
```

## Memory Management

### Go Memory Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    Go Memory Layout                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Reader struct (on heap)                                         │
│  ├── filePath: string (pointer + length)                         │
│  ├── file: *os.File (pointer)                                    │
│  ├── data: []byte (slice header: ptr, len, cap)                  │
│  │   └── backing array: []byte (entire file in memory)           │
│  ├── header: *Header (pointer to struct)                         │
│  ├── mimeTypes: []string (slice of strings)                      │
│  ├── directoryEntries: []interface{} (slice of interfaces)       │
│  └── clusterOffsets: []uint64 (slice of uint64)                  │
│                                                                  │
│  Memory is managed by Go's garbage collector                     │
│  - Automatic deallocation when no references                     │
│  - No manual memory management needed                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Memory Optimization

```go
// Pre-allocate slices when size is known
r.clusterOffsets = make([]uint64, 0, r.header.ClusterCount)
r.directoryEntries = make([]interface{}, 0, r.header.EntryCount)

// Reuse byte slices with sync.Pool
var bufferPool = sync.Pool{
    New: func() interface{} {
        return make([]byte, 4096)
    },
}

func getBuffer() []byte {
    return bufferPool.Get().([]byte)
}

func putBuffer(buf []byte) {
    bufferPool.Put(buf)
}
```

## Concurrency Patterns

### Thread-Safe Reader

```go
type SafeReader struct {
    reader *Reader
    mu     sync.RWMutex
}

func NewSafeReader(filePath string) (*SafeReader, error) {
    reader := NewReader(filePath)
    if err := reader.Open(); err != nil {
        return nil, err
    }
    return &SafeReader{reader: reader}, nil
}

func (sr *SafeReader) GetEntryByPath(path string) interface{} {
    sr.mu.RLock()
    defer sr.mu.RUnlock()
    return sr.reader.GetEntryByPath(path)
}

func (sr *SafeReader) GetArticleContent(entry *DirectoryEntry) ([]byte, error) {
    sr.mu.RLock()
    defer sr.mu.RUnlock()
    return sr.reader.GetArticleContent(entry)
}
```

### Parallel Processing

```go
func (r *Reader) ProcessArticlesParallel(processor func(*DirectoryEntry) error) error {
    articles := r.ListArticles()
    errChan := make(chan error, len(articles))
    
    var wg sync.WaitGroup
    sem := make(chan struct{}, runtime.NumCPU()) // Limit concurrency
    
    for _, article := range articles {
        wg.Add(1)
        go func(entry *DirectoryEntry) {
            defer wg.Done()
            sem <- struct{}{}        // Acquire semaphore
            defer func() { <-sem }() // Release semaphore
            
            if err := processor(entry); err != nil {
                errChan <- err
            }
        }(article)
    }
    
    wg.Wait()
    close(errChan)
    
    // Return first error if any
    for err := range errChan {
        return err
    }
    return nil
}
```

## HTTP Server Integration

### Basic Server

```go
package main

import (
    "log"
    "net/http"
    "github.com/yourproject/zimlib"
)

func main() {
    reader := zimlib.NewReader("wikipedia.zim")
    if err := reader.Open(); err != nil {
        log.Fatal(err)
    }
    defer reader.Close()

    http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        path := r.URL.Path[1:] // Remove leading slash
        entry := reader.GetEntryByPath("A/" + path)
        
        if dirEntry, ok := entry.(*zimlib.DirectoryEntry); ok {
            content, err := reader.GetArticleContent(dirEntry)
            if err != nil {
                http.Error(w, err.Error(), http.StatusInternalServerError)
                return
            }
            w.Header().Set("Content-Type", "text/html")
            w.Write(content)
        } else {
            http.NotFound(w, r)
        }
    })

    log.Println("Server starting on :8080")
    log.Fatal(http.ListenAndServe(":8080", nil))
}
```

### With Gorilla Mux

```go
import "github.com/gorilla/mux"

func setupRoutes(reader *zimlib.Reader) *mux.Router {
    r := mux.NewRouter()
    
    r.HandleFunc("/article/{namespace}/{url:.*}", 
        articleHandler(reader)).Methods("GET")
    r.HandleFunc("/search", searchHandler(reader)).Methods("GET")
    r.HandleFunc("/metadata", metadataHandler(reader)).Methods("GET")
    
    return r
}

func articleHandler(reader *zimlib.Reader) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        vars := mux.Vars(r)
        path := vars["namespace"] + "/" + vars["url"]
        
        entry := reader.GetEntryByPath(path)
        // ... handle entry
    }
}
```

## Testing

### Unit Test Example

```go
package zimlib

import (
    "os"
    "testing"
)

func TestWriteAndRead(t *testing.T) {
    tempFile := "test.zim"
    defer os.Remove(tempFile)
    
    // Write
    writer := NewWriter(tempFile)
    if err := writer.Create(); err != nil {
        t.Fatalf("Create failed: %v", err)
    }
    
    content := []byte("<html><body>Hello</body></html>")
    if err := writer.AddArticle(
        NamespaceMainArticle, 
        "test", 
        "Test Page", 
        content, 
        "text/html",
    ); err != nil {
        t.Fatalf("AddArticle failed: %v", err)
    }
    
    if err := writer.Finalize(); err != nil {
        t.Fatalf("Finalize failed: %v", err)
    }
    
    // Read
    reader := NewReader(tempFile)
    if err := reader.Open(); err != nil {
        t.Fatalf("Open failed: %v", err)
    }
    defer reader.Close()
    
    entry := reader.GetEntryByPath("A/test")
    if entry == nil {
        t.Fatal("Entry not found")
    }
    
    dirEntry, ok := entry.(*DirectoryEntry)
    if !ok {
        t.Fatal("Expected DirectoryEntry")
    }
    
    readContent, err := reader.GetArticleContent(dirEntry)
    if err != nil {
        t.Fatalf("GetArticleContent failed: %v", err)
    }
    
    if string(readContent) != string(content) {
        t.Errorf("Content mismatch: got %s, want %s", readContent, content)
    }
}
```

### Benchmark Example

```go
func BenchmarkGetArticleContent(b *testing.B) {
    reader := NewReader("testdata/sample.zim")
    if err := reader.Open(); err != nil {
        b.Fatal(err)
    }
    defer reader.Close()
    
    entry := reader.GetEntryByPath("A/Main_Page")
    dirEntry := entry.(*DirectoryEntry)
    
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _, _ = reader.GetArticleContent(dirEntry)
    }
}
```

## Dependencies

```go
// go.mod
module github.com/yourproject/zimlib

go 1.21

require (
    // Standard library only - no external dependencies
)
```

## Build Tags

```go
// +build !cgo

// Pure Go version for cross-compilation
// Slower but more portable

// +build cgo

// CGO version with native LZMA support
// Faster but requires C compiler
```

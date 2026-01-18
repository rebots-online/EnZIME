// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

// Clean-room ZIM (Zeno IMproved) file format reader/writer library for Go
//
// Based on ZIM file format specification from openZIM
// Supports reading and writing ZIM archives for offline content storage

package zimlib

import (
	"bytes"
	"compress/flate"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

// Compression types used in ZIM files
type CompressionType byte

const (
	CompressionDefault CompressionType = 0
	CompressionNone    CompressionType = 1
	CompressionZlib    CompressionType = 2
	CompressionBzip2   CompressionType = 3
	CompressionLZMA    CompressionType = 4
	CompressionZSTD    CompressionType = 5
)

// ZIM namespace identifiers
type Namespace byte

const (
	NamespaceMainArticle Namespace = 'A'
	NamespaceImage      Namespace = 'I'
	NamespaceMetadata   Namespace = 'M'
	NamespaceRawData    Namespace = '-'
	NamespaceStyle      Namespace = 'S'
	NamespaceScript     Namespace = 'J'
	NamespaceFont       Namespace = 'T'
	NamespaceTranslation Namespace = 'U'
	NamespaceVideo      Namespace = 'V'
	NamespaceAudio      Namespace = 'W'
)

// ZIM file header structure
type Header struct {
	MagicNumber       uint32
	MajorVersion      uint16
	MinorVersion      uint16
	EntryCount        uint32
	ArticleCount      uint32
	ClusterCount      uint32
	RedirectCount     uint32
	MimeTypeListPos   uint64
	TitleIndexPos     uint64
	ClusterPtrPos     uint64
	ClusterCountPos   uint64
	MainPageIndex     uint32
	LayoutPageIndex   uint32
	ChecksumPos       uint64
}

// Directory entry for a ZIM file
type DirectoryEntry struct {
	MimetypeIndex  uint32
	Namespace      Namespace
	Revision      uint32
	ClusterNumber uint32
	BlobNumber    uint32
	URL           string
	Title         string
}

// Redirect entry for a ZIM file
type RedirectEntry struct {
	MimetypeIndex  uint32
	Namespace      Namespace
	Revision      uint32
	RedirectIndex uint32
	URL           string
	Title         string
}

// Binary reader utility for ZIM files
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

func (r *BinaryReader) ReadUInt16LE() uint16 {
	value := binary.LittleEndian.Uint16(r.data[r.position : r.position+2])
	r.position += 2
	return value
}

func (r *BinaryReader) ReadUInt8() byte {
	value := r.data[r.position]
	r.position += 1
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

func (r *BinaryReader) Seek(position int) {
	r.position = position
}

func (r *BinaryReader) GetPosition() int {
	return r.position
}

func (r *BinaryReader) ReadBytes(length int) []byte {
	data := make([]byte, length)
	copy(data, r.data[r.position:r.position+length])
	r.position += length
	return data
}

func (r *BinaryReader) IsEOF() bool {
	return r.position >= len(r.data)
}

// Binary writer utility for ZIM files
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

func (w *BinaryWriter) WriteUInt16LE(value uint16) {
	w.ensureCapacity(2)
	binary.LittleEndian.PutUint16(w.data[w.position:w.position+2], value)
	w.position += 2
}

func (w *BinaryWriter) WriteUInt8(value byte) {
	w.ensureCapacity(1)
	w.data[w.position] = value
	w.position += 1
}

func (w *BinaryWriter) WriteUInt64LE(value uint64) {
	w.ensureCapacity(8)
	binary.LittleEndian.PutUint64(w.data[w.position:w.position+8], value)
	w.position += 8
}

func (w *BinaryWriter) WriteNullTerminatedString(str string) {
	strBytes := []byte(str + "\x00")
	w.ensureCapacity(len(strBytes))
	copy(w.data[w.position:], strBytes)
	w.position += len(strBytes)
}

func (w *BinaryWriter) WriteBytes(data []byte) {
	w.ensureCapacity(len(data))
	copy(w.data[w.position:], data)
	w.position += len(data)
}

func (w *BinaryWriter) Seek(position int) {
	w.position = position
}

func (w *BinaryWriter) GetPosition() int {
	return w.position
}

func (w *BinaryWriter) GetBuffer() []byte {
	return w.data[:w.position]
}

// ZIM file reader
type Reader struct {
	filePath         string
	file             *os.File
	data             []byte
	header           *Header
	mimeTypes        []string
	directoryEntries []interface{} // Either *DirectoryEntry or *RedirectEntry
	clusterOffsets   []uint64
}

func NewReader(filePath string) *Reader {
	return &Reader{
		filePath: filePath,
	}
}

func (r *Reader) Open() error {
	file, err := os.Open(r.filePath)
	if err != nil {
		return fmt.Errorf("cannot open ZIM file: %w", err)
	}
	r.file = file

	// Read entire file into memory for simplicity
	fileInfo, err := file.Stat()
	if err != nil {
		return fmt.Errorf("cannot get file info: %w", err)
	}

	r.data = make([]byte, fileInfo.Size())
	_, err = file.Read(r.data)
	if err != nil {
		return fmt.Errorf("cannot read file data: %w", err)
	}

	err = r.readHeader()
	if err != nil {
		return err
	}

	err = r.readMimeTypes()
	if err != nil {
		return err
	}

	err = r.readDirectory()
	if err != nil {
		return err
	}

	err = r.readClusterPointers()
	if err != nil {
		return err
	}

	return nil
}

func (r *Reader) Close() error {
	if r.file != nil {
		err := r.file.Close()
		r.file = nil
		return err
	}
	return nil
}

func (r *Reader) readHeader() error {
	if len(r.data) < 80 {
		return errors.New("file too small for header")
	}

	reader := NewBinaryReader(r.data)
	r.header = &Header{
		MagicNumber:     reader.ReadUInt32LE(),
		MajorVersion:    reader.ReadUInt16LE(),
		MinorVersion:    reader.ReadUInt16LE(),
		EntryCount:      reader.ReadUInt32LE(),
		ArticleCount:    reader.ReadUInt32LE(),
		ClusterCount:    reader.ReadUInt32LE(),
		RedirectCount:   reader.ReadUInt32LE(),
		MimeTypeListPos: reader.ReadUInt64LE(),
		TitleIndexPos:   reader.ReadUInt64LE(),
		ClusterPtrPos:   reader.ReadUInt64LE(),
		ClusterCountPos: reader.ReadUInt64LE(),
		MainPageIndex:   reader.ReadUInt32LE(),
		LayoutPageIndex: reader.ReadUInt32LE(),
		ChecksumPos:     reader.ReadUInt64LE(),
	}

	// Verify magic number
	if r.header.MagicNumber != 0x4D495A5A { // "ZZIM" in little endian
		return errors.New("invalid ZIM file format")
	}

	return nil
}

func (r *Reader) readMimeTypes() error {
	if r.header == nil {
		return errors.New("header not parsed")
	}

	startPos := int(r.header.MimeTypeListPos)
	if startPos >= len(r.data) {
		return errors.New("mime type list position out of bounds")
	}

	reader := NewBinaryReader(r.data[startPos:])
	var mimeTypesData []byte

	// Read until double null terminator
	for {
		chunk := reader.ReadBytes(1024)
		if len(chunk) == 0 {
			break
		}

		mimeTypesData = append(mimeTypesData, chunk...)

		// Check for double null terminator
		if bytes.Contains(mimeTypesData, []byte{0, 0}) {
			break
		}
	}

	// Split by null terminator and filter empty strings
	mimeTypesString := string(mimeTypesData)
	r.mimeTypes = strings.Split(mimeTypesString, "\x00")
	
	// Filter empty strings
	var filtered []string
	for _, mt := range r.mimeTypes {
		if len(mt) > 0 {
			filtered = append(filtered, mt)
		}
	}
	r.mimeTypes = filtered

	return nil
}

func (r *Reader) readDirectory() error {
	if r.header == nil {
		return errors.New("header not parsed")
	}

	// Read index pointer list (starts after header at offset 80)
	indexPtrStart := 80
	reader := NewBinaryReader(r.data[indexPtrStart:])

	indexPointers := make([]uint64, r.header.EntryCount)
	for i := 0; i < int(r.header.EntryCount); i++ {
		indexPointers[i] = reader.ReadUInt64LE()
	}

	// Read directory entries
	for _, ptr := range indexPointers {
		entryReader := NewBinaryReader(r.data[ptr:])

		// Read mimetype to determine entry type
		mimetype := entryReader.ReadUInt32LE()
		entryReader.Seek(0) // Reset position

		if mimetype == 0xFFFF { // Redirect entry
			entry, err := r.readRedirectEntry(entryReader)
			if err != nil {
				return err
			}
			r.directoryEntries = append(r.directoryEntries, entry)
		} else { // Article entry
			entry, err := r.readDirectoryEntry(entryReader)
			if err != nil {
				return err
			}
			r.directoryEntries = append(r.directoryEntries, entry)
		}
	}

	return nil
}

func (r *Reader) readDirectoryEntry(reader *BinaryReader) (*DirectoryEntry, error) {
	entry := &DirectoryEntry{
		MimetypeIndex:  reader.ReadUInt32LE(),
		Namespace:      Namespace(reader.ReadUInt8()),
		Revision:       reader.ReadUInt32LE(),
		ClusterNumber:  reader.ReadUInt32LE(),
		BlobNumber:     reader.ReadUInt32LE(),
		URL:            reader.ReadNullTerminatedString(),
		Title:          reader.ReadNullTerminatedString(),
	}
	return entry, nil
}

func (r *Reader) readRedirectEntry(reader *BinaryReader) (*RedirectEntry, error) {
	entry := &RedirectEntry{
		MimetypeIndex:  reader.ReadUInt32LE(),
		Namespace:      Namespace(reader.ReadUInt8()),
		Revision:       reader.ReadUInt32LE(),
		RedirectIndex:  reader.ReadUInt32LE(),
		URL:            reader.ReadNullTerminatedString(),
		Title:          reader.ReadNullTerminatedString(),
	}
	return entry, nil
}

func (r *Reader) readClusterPointers() error {
	if r.header == nil {
		return errors.New("header not parsed")
	}

	startPos := int(r.header.ClusterPtrPos)
	if startPos >= len(r.data) {
		return errors.New("cluster pointer position out of bounds")
	}

	reader := NewBinaryReader(r.data[startPos:])

	r.clusterOffsets = make([]uint64, r.header.ClusterCount)
	for i := 0; i < int(r.header.ClusterCount); i++ {
		r.clusterOffsets[i] = reader.ReadUInt64LE()
	}

	return nil
}

func (r *Reader) GetEntryByPath(path string) interface{} {
	if len(path) == 0 {
		return nil
	}

	namespace := Namespace(path[0])
	url := ""
	if len(path) > 2 {
		url = path[2:]
	}

	for _, entry := range r.directoryEntries {
		switch e := entry.(type) {
		case *DirectoryEntry:
			if e.Namespace == namespace && e.URL == url {
				return e
			}
		case *RedirectEntry:
			if e.Namespace == namespace && e.URL == url {
				return e
			}
		}
	}

	return nil
}

func (r *Reader) GetArticleContent(entry *DirectoryEntry) ([]byte, error) {
	if r.data == nil || r.header == nil {
		return nil, errors.New("file not opened or header not parsed")
	}

	// Get cluster offset
	if int(entry.ClusterNumber) >= len(r.clusterOffsets) {
		return nil, errors.New("invalid cluster number")
	}

	clusterOffset := int(r.clusterOffsets[entry.ClusterNumber])
	if clusterOffset >= len(r.data) {
		return nil, errors.New("cluster offset out of bounds")
	}

	clusterReader := NewBinaryReader(r.data[clusterOffset:])

	// Read cluster header (compression type)
	compressionByte := clusterReader.ReadUInt8()

	// Read blob offsets
	var blobOffsets []uint32
	for {
		offset := clusterReader.ReadUInt32LE()
		blobOffsets = append(blobOffsets, offset)
		if offset == 0 { // Last offset
			break
		}
	}

	// Calculate blob size and position
	if int(entry.BlobNumber) >= len(blobOffsets)-1 {
		return nil, errors.New("invalid blob number")
	}

	blobStart := blobOffsets[entry.BlobNumber]
	blobEnd := blobOffsets[entry.BlobNumber+1]
	blobSize := blobEnd - blobStart

	// Read blob data
	currentPos := clusterReader.GetPosition()
	clusterReader.Seek(currentPos + int(blobStart))

	blobData := clusterReader.ReadBytes(int(blobSize))

	// Decompress if needed
	if CompressionType(compressionByte) == CompressionZlib {
		reader := flate.NewReader(bytes.NewReader(blobData))
		defer reader.Close()

		var decompressed bytes.Buffer
		_, err := io.Copy(&decompressed, reader)
		if err != nil {
			return nil, fmt.Errorf("decompression failed: %w", err)
		}

		blobData = decompressed.Bytes()
	} else if CompressionType(compressionByte) == CompressionLZMA {
		return nil, errors.New("LZMA compression not implemented in this clean-room version")
	}

	return blobData, nil
}

func (r *Reader) GetMainPage() interface{} {
	if r.header == nil {
		return nil
	}

	if int(r.header.MainPageIndex) < len(r.directoryEntries) {
		return r.directoryEntries[r.header.MainPageIndex]
	}

	return nil
}

func (r *Reader) ListArticles() []*DirectoryEntry {
	var articles []*DirectoryEntry
	for _, entry := range r.directoryEntries {
		if e, ok := entry.(*DirectoryEntry); ok {
			articles = append(articles, e)
		}
	}
	return articles
}

func (r *Reader) GetMimeTypes() []string {
	return r.mimeTypes
}

func (r *Reader) GetHeader() *Header {
	return r.header
}

// ZIM file writer
type Writer struct {
	filePath       string
	mimeTypes      []string
	directoryEntries []interface{} // Either *DirectoryEntry or *RedirectEntry
	clusters       [][]byte
	mainPageIndex  int
}

func NewWriter(filePath string) *Writer {
	return &Writer{
		filePath: filePath,
	}
}

func (w *Writer) Create() error {
	file, err := os.Create(w.filePath)
	if err != nil {
		return fmt.Errorf("cannot create ZIM file: %w", err)
	}
	defer file.Close()

	// Write placeholder header
	header := &Header{
		MagicNumber:     0x4D495A5A,
		MajorVersion:    4,
		MinorVersion:    0,
	}
	return w.writeHeader(file, header)
}

func (w *Writer) writeHeader(file *os.File, header *Header) error {
	headerData := make([]byte, 80)
	binary.LittleEndian.PutUint32(headerData[0:4], header.MagicNumber)
	binary.LittleEndian.PutUint16(headerData[4:6], header.MajorVersion)
	binary.LittleEndian.PutUint16(headerData[6:8], header.MinorVersion)
	binary.LittleEndian.PutUint32(headerData[8:12], header.EntryCount)
	binary.LittleEndian.PutUint32(headerData[12:16], header.ArticleCount)
	binary.LittleEndian.PutUint32(headerData[16:20], header.ClusterCount)
	binary.LittleEndian.PutUint32(headerData[20:24], header.RedirectCount)
	binary.LittleEndian.PutUint64(headerData[24:32], header.MimeTypeListPos)
	binary.LittleEndian.PutUint64(headerData[32:40], header.TitleIndexPos)
	binary.LittleEndian.PutUint64(headerData[40:48], header.ClusterPtrPos)
	binary.LittleEndian.PutUint64(headerData[48:56], header.ClusterCountPos)
	binary.LittleEndian.PutUint32(headerData[56:60], header.MainPageIndex)
	binary.LittleEndian.PutUint32(headerData[60:64], header.LayoutPageIndex)
	binary.LittleEndian.PutUint64(headerData[64:72], header.ChecksumPos)

	_, err := file.Write(headerData)
	return err
}

func (w *Writer) AddMimeType(mimeType string) int {
	for i, existing := range w.mimeTypes {
		if existing == mimeType {
			return i
		}
	}
	w.mimeTypes = append(w.mimeTypes, mimeType)
	return len(w.mimeTypes) - 1
}

func (w *Writer) AddArticle(namespace Namespace, url, title string, content []byte, mimeType string) error {
	mimetypeIndex := w.AddMimeType(mimeType)

	// Create cluster with content (for simplicity, one blob per cluster)
	clusterData, err := w.createCluster([][]byte{content}, CompressionDefault)
	if err != nil {
		return err
	}
	clusterNumber := len(w.clusters)
	w.clusters = append(w.clusters, clusterData)

	entry := &DirectoryEntry{
		MimetypeIndex:  uint32(mimetypeIndex),
		Namespace:      namespace,
		Revision:       0,
		ClusterNumber:  uint32(clusterNumber),
		BlobNumber:     0,
		URL:            url,
		Title:          title,
	}

	w.directoryEntries = append(w.directoryEntries, entry)
	return nil
}

func (w *Writer) AddRedirect(namespace Namespace, url, title string, redirectIndex uint32) error {
	entry := &RedirectEntry{
		MimetypeIndex:  0xFFFF, // Redirect marker
		Namespace:      namespace,
		Revision:       0,
		RedirectIndex:  redirectIndex,
		URL:            url,
		Title:          title,
	}

	w.directoryEntries = append(w.directoryEntries, entry)
	return nil
}

func (w *Writer) createCluster(blobs [][]byte, compression CompressionType) ([]byte, error) {
	// Calculate blob offsets
	offsets := []uint32{0}
	var currentOffset uint32
	for _, blob := range blobs {
		currentOffset += uint32(len(blob))
		offsets = append(offsets, currentOffset)
	}

	writer := NewBinaryWriter(1024)
	writer.WriteUInt8(byte(compression))

	// Add offsets
	for _, offset := range offsets {
		writer.WriteUInt32LE(offset)
	}

	// Add blob data
	for _, blob := range blobs {
		if compression == CompressionZlib {
			var compressedBuf bytes.Buffer
			zlibWriter := zlib.NewWriter(&compressedBuf)
			zlibWriter.Write(blob)
			zlibWriter.Close()
			blob = compressedBuf.Bytes()
		}
		writer.WriteBytes(blob)
	}

	return writer.GetBuffer(), nil
}

func (w *Writer) Finalize() error {
	// Calculate positions
	currentPos := 80 // After header

	// Write MIME type list
	mimeTypePos := currentPos
	mimeTypeData := strings.Join(w.mimeTypes, "\x00") + "\x00\x00"
	currentPos += len(mimeTypeData)

	// Write directory entries
	directoryPos := currentPos
	var indexPointers []uint64

	for _, entry := range w.directoryEntries {
		indexPointers = append(indexPointers, uint64(currentPos))
		entryData, err := w.serializeEntry(entry)
		if err != nil {
			return err
		}
		currentPos += len(entryData)
	}

	// Write index pointer list
	indexPtrPos := currentPos
	currentPos += len(indexPointers) * 8

	// Write cluster pointer list
	clusterPtrPos := currentPos
	var clusterOffsets []uint64

	for _, cluster := range w.clusters {
		clusterOffsets = append(clusterOffsets, uint64(currentPos))
		currentPos += len(cluster)
	}

	// Update header with real values
	articleCount := 0
	redirectCount := 0

	for _, entry := range w.directoryEntries {
		switch entry.(type) {
		case *DirectoryEntry:
			articleCount++
		case *RedirectEntry:
			redirectCount++
		}
	}

	header := &Header{
		MagicNumber:     0x4D495A5A,
		MajorVersion:    4,
		MinorVersion:    0,
		EntryCount:      uint32(len(w.directoryEntries)),
		ArticleCount:    uint32(articleCount),
		ClusterCount:    uint32(len(w.clusters)),
		RedirectCount:   uint32(redirectCount),
		MimeTypeListPos: uint64(mimeTypePos),
		TitleIndexPos:   0, // Not implemented
		ClusterPtrPos:   uint64(clusterPtrPos),
		ClusterCountPos: 0, // Not implemented
		MainPageIndex:   uint32(w.mainPageIndex),
		LayoutPageIndex: 0, // Not implemented
		ChecksumPos:     uint64(currentPos), // Checksum at end
	}

	// Write all data to file
	file, err := os.Create(w.filePath)
	if err != nil {
		return fmt.Errorf("cannot create ZIM file: %w", err)
	}
	defer file.Close()

	err = w.writeHeader(file, header)
	if err != nil {
		return err
	}

	_, err = file.WriteString(mimeTypeData)
	if err != nil {
		return err
	}

	// Write directory entries
	for _, entry := range w.directoryEntries {
		entryData, err := w.serializeEntry(entry)
		if err != nil {
			return err
		}
		_, err = file.Write(entryData)
		if err != nil {
			return err
		}
	}

	// Write index pointer list
	for _, ptr := range indexPointers {
		err = binary.Write(file, binary.LittleEndian, ptr)
		if err != nil {
			return err
		}
	}

	// Write cluster pointer list
	for _, offset := range clusterOffsets {
		err = binary.Write(file, binary.LittleEndian, offset)
		if err != nil {
			return err
		}
	}

	// Write clusters
	for _, cluster := range w.clusters {
		_, err = file.Write(cluster)
		if err != nil {
			return err
		}
	}

	// Write placeholder checksum
	checksum := make([]byte, 16)
	_, err = file.Write(checksum)
	return err
}

func (w *Writer) serializeEntry(entry interface{}) ([]byte, error) {
	writer := NewBinaryWriter(1024)

	switch e := entry.(type) {
	case *RedirectEntry:
		// Redirect entry
		writer.WriteUInt32LE(e.MimetypeIndex)
		writer.WriteUInt8(byte(e.Namespace))
		writer.WriteUInt32LE(e.Revision)
		writer.WriteUInt32LE(e.RedirectIndex)
		writer.WriteNullTerminatedString(e.URL)
		writer.WriteNullTerminatedString(e.Title)
	case *DirectoryEntry:
		// Directory entry
		writer.WriteUInt32LE(e.MimetypeIndex)
		writer.WriteUInt8(byte(e.Namespace))
		writer.WriteUInt32LE(e.Revision)
		writer.WriteUInt32LE(e.ClusterNumber)
		writer.WriteUInt32LE(e.BlobNumber)
		writer.WriteNullTerminatedString(e.URL)
		writer.WriteNullTerminatedString(e.Title)
	default:
		return nil, errors.New("unknown entry type")
	}

	return writer.GetBuffer(), nil
}

func (w *Writer) Close() error {
	// Nothing to do for file-based writer
	return nil
}

// Utility functions
func ReadZIMFile(filePath string) *Reader {
	return NewReader(filePath)
}

func CreateZIMFile(filePath string) *Writer {
	return NewWriter(filePath)
}

// Helper function for max
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

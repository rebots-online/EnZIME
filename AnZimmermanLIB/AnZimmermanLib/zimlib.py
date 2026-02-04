# Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
# All rights reserved.
# Unauthorized use without prior written consent is strictly prohibited.

"""
Clean-room ZIM (Zeno IMproved) file format reader/writer library.

Based on ZIM file format specification from openZIM.
Supports reading and writing ZIM archives for offline content storage.
"""

import struct
import zlib
import lzma
from typing import Optional, Dict, List, Tuple, Union, BinaryIO
from dataclasses import dataclass
from enum import IntEnum
import os


class CompressionType(IntEnum):
    """Compression types used in ZIM files."""
    DEFAULT = 0
    NONE = 1
    ZLIB = 2
    BZIP2 = 3
    LZMA = 4
    ZSTD = 5


class Namespace(IntEnum):
    """ZIM namespace identifiers."""
    MAIN_ARTICLE = ord('A')
    IMAGE = ord('I')
    METADATA = ord('M')
    RAW_DATA = ord('-')
    STYLE = ord('S')
    SCRIPT = ord('J')
    FONT = ord('T')
    TRANSLATION = ord('U')
    VIDEO = ord('V')
    AUDIO = ord('W')


@dataclass
class ZIMHeader:
    """ZIM file header structure."""
    magic_number: int  # 4 bytes
    major_version: int  # 2 bytes
    minor_version: int  # 2 bytes
    entry_count: int  # 4 bytes
    article_count: int  # 4 bytes
    cluster_count: int  # 4 bytes
    redirect_count: int  # 4 bytes
    mime_type_list_pos: int  # 8 bytes
    title_index_pos: int  # 8 bytes
    cluster_ptr_pos: int  # 8 bytes
    cluster_count_pos: int  # 8 bytes
    main_page_index: int  # 4 bytes
    layout_page_index: int  # 4 bytes
    checksum_pos: int  # 8 bytes
    
    @classmethod
    def from_bytes(cls, data: bytes) -> 'ZIMHeader':
        """Parse header from binary data."""
        values = struct.unpack('<IHHIIIIIIIIIIIQQQ', data[:80])
        return cls(*values)
    
    def to_bytes(self) -> bytes:
        """Serialize header to binary data."""
        return struct.pack('<IHHIIIIIIIIIIIQQQ', *(
            self.magic_number, self.major_version, self.minor_version,
            self.entry_count, self.article_count, self.cluster_count,
            self.redirect_count, self.mime_type_list_pos, self.title_index_pos,
            self.cluster_ptr_pos, self.cluster_count_pos, self.main_page_index,
            self.layout_page_index, self.checksum_pos
        ))


@dataclass
class DirectoryEntry:
    """Directory entry for a ZIM file."""
    mimetype_index: int
    namespace: int
    revision: int
    cluster_number: int
    blob_number: int
    url: str
    title: str
    
    @classmethod
    def from_bytes(cls, data: bytes) -> 'DirectoryEntry':
        """Parse directory entry from binary data."""
        pos = 0
        mimetype_index = struct.unpack('<I', data[pos:pos+4])[0]
        pos += 4
        
        namespace = data[pos]
        pos += 1
        revision = struct.unpack('<I', data[pos:pos+4])[0]
        pos += 4
        
        cluster_number = struct.unpack('<I', data[pos:pos+4])[0]
        pos += 4
        blob_number = struct.unpack('<I', data[pos:pos+4])[0]
        pos += 4
        
        # Read URL (null-terminated)
        url_end = data.find(b'\x00', pos)
        url = data[pos:url_end].decode('utf-8')
        pos = url_end + 1
        
        # Read title (null-terminated)
        title_end = data.find(b'\x00', pos)
        title = data[pos:title_end].decode('utf-8') if title_end != -1 else data[pos:].decode('utf-8')
        
        return cls(mimetype_index, namespace, revision, cluster_number, blob_number, url, title)
    
    def to_bytes(self) -> bytes:
        """Serialize directory entry to binary data."""
        url_bytes = self.url.encode('utf-8') + b'\x00'
        title_bytes = self.title.encode('utf-8') + b'\x00'
        
        return (struct.pack('<IBIII', self.mimetype_index, self.namespace, 
                           self.revision, self.cluster_number, self.blob_number) +
                url_bytes + title_bytes)


@dataclass
class RedirectEntry:
    """Redirect entry for a ZIM file."""
    mimetype_index: int
    namespace: int
    revision: int
    redirect_index: int
    url: str
    title: str
    
    @classmethod
    def from_bytes(cls, data: bytes) -> 'RedirectEntry':
        """Parse redirect entry from binary data."""
        pos = 0
        mimetype_index = struct.unpack('<I', data[pos:pos+4])[0]
        pos += 4
        
        namespace = data[pos]
        pos += 1
        revision = struct.unpack('<I', data[pos:pos+4])[0]
        pos += 4
        
        redirect_index = struct.unpack('<I', data[pos:pos+4])[0]
        pos += 4
        
        # Read URL (null-terminated)
        url_end = data.find(b'\x00', pos)
        url = data[pos:url_end].decode('utf-8')
        pos = url_end + 1
        
        # Read title (null-terminated)
        title_end = data.find(b'\x00', pos)
        title = data[pos:title_end].decode('utf-8') if title_end != -1 else data[pos:].decode('utf-8')
        
        return cls(mimetype_index, namespace, revision, redirect_index, url, title)


class ZIMReader:
    """Clean-room ZIM file reader."""
    
    def __init__(self, file_path: str):
        """Initialize ZIM reader with file path."""
        self.file_path = file_path
        self.file: Optional[BinaryIO] = None
        self.header: Optional[ZIMHeader] = None
        self.mime_types: List[str] = []
        self.directory_entries: List[Union[DirectoryEntry, RedirectEntry]] = []
        self.cluster_offsets: List[int] = []
        
    def open(self) -> None:
        """Open and parse ZIM file."""
        self.file = open(self.file_path, 'rb')
        self._read_header()
        self._read_mime_types()
        self._read_directory()
        self._read_cluster_pointers()
    
    def close(self) -> None:
        """Close ZIM file."""
        if self.file:
            self.file.close()
            self.file = None
    
    def __enter__(self):
        self.open()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
    
    def _read_header(self) -> None:
        """Read and parse ZIM header."""
        if not self.file:
            raise ValueError("File not opened")
        
        header_data = self.file.read(80)
        self.header = ZIMHeader.from_bytes(header_data)
        
        # Verify magic number
        if self.header.magic_number != 0x4D495A5A:  # "ZZIM" in little endian
            raise ValueError("Invalid ZIM file format")
    
    def _read_mime_types(self) -> None:
        """Read MIME type list."""
        if not self.header or not self.file:
            raise ValueError("Header not parsed or file not opened")
        
        self.file.seek(self.header.mime_type_list_pos)
        
        mime_types_data = bytearray()
        while True:
            chunk = self.file.read(1024)
            if not chunk:
                break
            mime_types_data.extend(chunk)
            # Look for double null terminator
            if b'\x00\x00' in mime_types_data:
                break
        
        # Split by null terminator and remove empty strings
        self.mime_types = [mt.decode('utf-8') for mt in mime_types_data.split(b'\x00') if mt]
    
    def _read_directory(self) -> None:
        """Read directory entries."""
        if not self.header or not self.file:
            raise ValueError("Header not parsed or file not opened")
        
        # Read index pointer list
        self.file.seek(0)  # Start after header
        self.file.seek(80)  # Skip header
        
        index_pointers = []
        for _ in range(self.header.entry_count):
            ptr = struct.unpack('<Q', self.file.read(8))[0]
            index_pointers.append(ptr)
        
        # Read directory entries
        for ptr in index_pointers:
            self.file.seek(ptr)
            
            # Read entry type (first byte determines if it's redirect or article)
            first_bytes = self.file.read(5)
            mimetype = struct.unpack('<I', first_bytes[:4])[0]
            
            if mimetype == 0xFFFF:  # Redirect entry
                remaining = self.file.read(1000)  # Read enough for full entry
                entry_data = first_bytes + remaining
                entry = RedirectEntry.from_bytes(entry_data)
            else:  # Article entry
                remaining = self.file.read(1000)  # Read enough for full entry
                entry_data = first_bytes + remaining
                entry = DirectoryEntry.from_bytes(entry_data)
            
            self.directory_entries.append(entry)
    
    def _read_cluster_pointers(self) -> None:
        """Read cluster pointer list."""
        if not self.header or not self.file:
            raise ValueError("Header not parsed or file not opened")
        
        self.file.seek(self.header.cluster_ptr_pos)
        
        for _ in range(self.header.cluster_count):
            ptr = struct.unpack('<Q', self.file.read(8))[0]
            self.cluster_offsets.append(ptr)
    
    def get_entry_by_path(self, path: str) -> Optional[Union[DirectoryEntry, RedirectEntry]]:
        """Get directory entry by URL path."""
        namespace, url = path[0], path[2:] if len(path) > 2 else ""
        
        for entry in self.directory_entries:
            if entry.namespace == namespace and entry.url == url:
                return entry
        
        return None
    
    def get_article_content(self, entry: DirectoryEntry) -> bytes:
        """Get content of an article entry."""
        if not self.file or not self.header:
            raise ValueError("File not opened or header not parsed")
        
        # Get cluster offset
        cluster_offset = self.cluster_offsets[entry.cluster_number]
        self.file.seek(cluster_offset)
        
        # Read cluster header (compression type)
        compression_byte = self.file.read(1)[0]
        
        # Read blob offsets
        blob_offsets = []
        while True:
            offset = struct.unpack('<I', self.file.read(4))[0]
            blob_offsets.append(offset)
            if offset == 0:  # Last offset
                break
        
        # Calculate blob size and position
        if entry.blob_number >= len(blob_offsets) - 1:
            raise ValueError("Invalid blob number")
        
        blob_start = blob_offsets[entry.blob_number]
        blob_end = blob_offsets[entry.blob_number + 1]
        blob_size = blob_end - blob_start
        
        # Read blob data
        current_pos = self.file.tell()
        self.file.seek(current_pos + blob_start)
        
        if compression_byte == CompressionType.DEFAULT or compression_byte == CompressionType.NONE:
            return self.file.read(blob_size)
        elif compression_byte == CompressionType.ZLIB:
            compressed_data = self.file.read(blob_size)
            return zlib.decompress(compressed_data)
        elif compression_byte == CompressionType.LZMA:
            compressed_data = self.file.read(blob_size)
            return lzma.decompress(compressed_data)
        else:
            raise NotImplementedError(f"Compression type {compression_byte} not supported")
    
    def get_main_page(self) -> Optional[Union[DirectoryEntry, RedirectEntry]]:
        """Get main page entry."""
        if not self.header:
            return None
        
        if self.header.main_page_index < len(self.directory_entries):
            return self.directory_entries[self.header.main_page_index]
        
        return None
    
    def list_articles(self) -> List[DirectoryEntry]:
        """List all article entries (excluding redirects)."""
        return [entry for entry in self.directory_entries 
                if isinstance(entry, DirectoryEntry)]


class ZIMWriter:
    """Clean-room ZIM file writer."""
    
    def __init__(self, file_path: str):
        """Initialize ZIM writer with file path."""
        self.file_path = file_path
        self.file: Optional[BinaryIO] = None
        self.mime_types: List[str] = []
        self.directory_entries: List[Union[DirectoryEntry, RedirectEntry]] = []
        self.clusters: List[bytes] = []
        self.main_page_index: int = 0
    
    def create(self) -> None:
        """Create new ZIM file."""
        self.file = open(self.file_path, 'wb')
        # Write placeholder header
        placeholder_header = ZIMHeader(
            magic_number=0x4D495A5A,
            major_version=4,
            minor_version=0,
            entry_count=0,
            article_count=0,
            cluster_count=0,
            redirect_count=0,
            mime_type_list_pos=0,
            title_index_pos=0,
            cluster_ptr_pos=0,
            cluster_count_pos=0,
            main_page_index=0,
            layout_page_index=0,
            checksum_pos=0
        )
        self.file.write(placeholder_header.to_bytes())
    
    def add_mime_type(self, mime_type: str) -> int:
        """Add MIME type and return its index."""
        if mime_type not in self.mime_types:
            self.mime_types.append(mime_type)
        return self.mime_types.index(mime_type)
    
    def add_article(self, namespace: int, url: str, title: str, content: bytes, 
                   mime_type: str = "text/html") -> None:
        """Add article to ZIM file."""
        mimetype_index = self.add_mime_type(mime_type)
        
        # Create cluster with content (for simplicity, one blob per cluster)
        cluster_data = self._create_cluster([content], CompressionType.DEFAULT)
        cluster_number = len(self.clusters)
        self.clusters.append(cluster_data)
        
        entry = DirectoryEntry(
            mimetype_index=mimetype_index,
            namespace=namespace,
            revision=0,
            cluster_number=cluster_number,
            blob_number=0,
            url=url,
            title=title
        )
        self.directory_entries.append(entry)
    
    def add_redirect(self, namespace: int, url: str, title: str, redirect_index: int) -> None:
        """Add redirect entry to ZIM file."""
        entry = RedirectEntry(
            mimetype_index=0xFFFF,  # Redirect marker
            namespace=namespace,
            revision=0,
            redirect_index=redirect_index,
            url=url,
            title=title
        )
        self.directory_entries.append(entry)
    
    def _create_cluster(self, blobs: List[bytes], compression: CompressionType) -> bytes:
        """Create cluster from list of blobs."""
        # Calculate blob offsets
        offsets = [0]
        current_offset = 0
        for blob in blobs:
            current_offset += len(blob)
            offsets.append(current_offset)
        
        # Create cluster data
        cluster_data = bytes([compression])
        
        # Add offsets
        for offset in offsets:
            cluster_data += struct.pack('<I', offset)
        
        # Add blob data
        for blob in blobs:
            if compression == CompressionType.ZLIB:
                blob = zlib.compress(blob)
            elif compression == CompressionType.LZMA:
                blob = lzma.compress(blob)
            cluster_data += blob
        
        return cluster_data
    
    def finalize(self) -> None:
        """Finalize ZIM file by writing all data and updating header."""
        if not self.file:
            raise ValueError("File not created")
        
        # Calculate positions
        current_pos = 80  # After header
        
        # Write MIME type list
        mime_type_pos = current_pos
        mime_type_data = b'\x00'.join(mt.encode('utf-8') for mt in self.mime_types) + b'\x00\x00'
        self.file.write(mime_type_data)
        current_pos += len(mime_type_data)
        
        # Write directory entries
        directory_pos = current_pos
        index_pointers = []
        
        for entry in self.directory_entries:
            index_pointers.append(current_pos)
            entry_data = entry.to_bytes()
            self.file.write(entry_data)
            current_pos += len(entry_data)
        
        # Write index pointer list
        index_ptr_pos = current_pos
        for ptr in index_pointers:
            self.file.write(struct.pack('<Q', ptr))
            current_pos += 8
        
        # Write cluster pointer list
        cluster_ptr_pos = current_pos
        cluster_offsets = []
        
        for cluster in self.clusters:
            cluster_offsets.append(current_pos)
            self.file.write(cluster)
            current_pos += len(cluster)
        
        # Update header with real values
        article_count = sum(1 for entry in self.directory_entries 
                          if isinstance(entry, DirectoryEntry))
        redirect_count = sum(1 for entry in self.directory_entries 
                           if isinstance(entry, RedirectEntry))
        
        header = ZIMHeader(
            magic_number=0x4D495A5A,
            major_version=4,
            minor_version=0,
            entry_count=len(self.directory_entries),
            article_count=article_count,
            cluster_count=len(self.clusters),
            redirect_count=redirect_count,
            mime_type_list_pos=mime_type_pos,
            title_index_pos=0,  # Not implemented
            cluster_ptr_pos=cluster_ptr_pos,
            cluster_count_pos=0,  # Not implemented
            main_page_index=self.main_page_index,
            layout_page_index=0,  # Not implemented
            checksum_pos=current_pos  # Checksum at end
        )
        
        # Write updated header
        self.file.seek(0)
        self.file.write(header.to_bytes())
        
        # Write placeholder checksum
        self.file.seek(current_pos)
        self.file.write(b'\x00' * 16)  # 16-byte checksum placeholder
    
    def close(self) -> None:
        """Close ZIM file."""
        if self.file:
            self.file.close()
            self.file = None
    
    def __enter__(self):
        self.create()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.finalize()
        self.close()


# Utility functions
def read_zim_file(file_path: str) -> ZIMReader:
    """Convenience function to read ZIM file."""
    return ZIMReader(file_path)


def create_zim_file(file_path: str) -> ZIMWriter:
    """Convenience function to create ZIM file."""
    return ZIMWriter(file_path)

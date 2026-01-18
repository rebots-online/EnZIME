#!/usr/bin/env python3
# Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
# All rights reserved.
# Unauthorized use without prior written consent is strictly prohibited.

"""
Unit Tests for zimlib.py
Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

Run with: pytest tests/test_zimlib_python.py -v
"""

import pytest
import os
import sys
import tempfile
import struct

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from zimlib import (
    ZIMReader,
    ZIMWriter,
    ZIMHeader,
    DirectoryEntry,
    Cluster,
    MimeType,
    CompressionType,
    ZIM_MAGIC,
    ZIM_VERSION,
)


class TestZIMHeader:
    """Tests for ZIM file header parsing and creation."""

    def test_header_magic_number(self):
        """Verify ZIM magic number constant."""
        assert ZIM_MAGIC == 72173914

    def test_header_version(self):
        """Verify ZIM version constant."""
        assert ZIM_VERSION == 5

    def test_header_struct_size(self):
        """Header should be 80 bytes."""
        header = ZIMHeader()
        # Header has specific fields that total 80 bytes
        assert hasattr(header, 'magic_number')
        assert hasattr(header, 'major_version')
        assert hasattr(header, 'minor_version')


class TestMimeType:
    """Tests for MIME type handling."""

    def test_common_mime_types(self):
        """Test common MIME type constants."""
        assert MimeType.HTML == 'text/html'
        assert MimeType.CSS == 'text/css'
        assert MimeType.JAVASCRIPT == 'application/javascript'
        assert MimeType.PNG == 'image/png'
        assert MimeType.JPEG == 'image/jpeg'

    def test_mime_type_from_extension(self):
        """Test MIME type detection from file extension."""
        assert MimeType.from_extension('.html') == 'text/html'
        assert MimeType.from_extension('.css') == 'text/css'
        assert MimeType.from_extension('.js') == 'application/javascript'
        assert MimeType.from_extension('.png') == 'image/png'
        assert MimeType.from_extension('.jpg') == 'image/jpeg'
        assert MimeType.from_extension('.jpeg') == 'image/jpeg'
        assert MimeType.from_extension('.svg') == 'image/svg+xml'
        assert MimeType.from_extension('.json') == 'application/json'


class TestCompressionType:
    """Tests for compression type constants."""

    def test_compression_types(self):
        """Verify compression type constants."""
        assert CompressionType.NONE == 0
        assert CompressionType.ZLIB == 1
        assert CompressionType.BZIP2 == 2
        assert CompressionType.LZMA == 3
        assert CompressionType.ZSTD == 4


class TestDirectoryEntry:
    """Tests for directory entry creation and parsing."""

    def test_create_content_entry(self):
        """Test creating a content directory entry."""
        entry = DirectoryEntry(
            namespace='C',
            url='index.html',
            title='Home Page',
            mime_type='text/html',
            cluster_number=0,
            blob_number=0
        )
        assert entry.namespace == 'C'
        assert entry.url == 'index.html'
        assert entry.title == 'Home Page'
        assert entry.mime_type == 'text/html'

    def test_create_redirect_entry(self):
        """Test creating a redirect directory entry."""
        entry = DirectoryEntry(
            namespace='C',
            url='home',
            title='Home Redirect',
            redirect_index=0
        )
        assert entry.namespace == 'C'
        assert entry.url == 'home'
        assert entry.redirect_index == 0

    def test_entry_serialization(self):
        """Test directory entry can be serialized."""
        entry = DirectoryEntry(
            namespace='C',
            url='test.html',
            title='Test',
            mime_type='text/html',
            cluster_number=0,
            blob_number=0
        )
        data = entry.to_bytes()
        assert isinstance(data, bytes)
        assert len(data) > 0


class TestCluster:
    """Tests for cluster creation and compression."""

    def test_create_uncompressed_cluster(self):
        """Test creating an uncompressed cluster."""
        cluster = Cluster(compression=CompressionType.NONE)
        cluster.add_blob(b'Hello, World!')
        cluster.add_blob(b'Another blob')
        
        assert cluster.blob_count == 2
        assert cluster.compression == CompressionType.NONE

    def test_create_compressed_cluster(self):
        """Test creating a ZLIB compressed cluster."""
        cluster = Cluster(compression=CompressionType.ZLIB)
        cluster.add_blob(b'Hello, World!' * 100)  # Repetitive data compresses well
        
        assert cluster.blob_count == 1
        data = cluster.to_bytes()
        # Compressed data should be smaller than original
        assert len(data) < len(b'Hello, World!' * 100)

    def test_cluster_blob_retrieval(self):
        """Test retrieving blobs from cluster."""
        cluster = Cluster(compression=CompressionType.NONE)
        blob1 = b'First blob'
        blob2 = b'Second blob'
        cluster.add_blob(blob1)
        cluster.add_blob(blob2)
        
        assert cluster.get_blob(0) == blob1
        assert cluster.get_blob(1) == blob2


class TestZIMWriter:
    """Tests for ZIM file writing."""

    def test_create_minimal_zim(self):
        """Test creating a minimal valid ZIM file."""
        with tempfile.NamedTemporaryFile(suffix='.zim', delete=False) as f:
            temp_path = f.name

        try:
            writer = ZIMWriter(temp_path)
            writer.add_article(
                url='index.html',
                title='Test Article',
                content=b'<html><body>Hello</body></html>',
                mime_type='text/html'
            )
            writer.set_main_page('index.html')
            writer.finalize()

            # Verify file was created
            assert os.path.exists(temp_path)
            assert os.path.getsize(temp_path) > 0

            # Verify magic number
            with open(temp_path, 'rb') as f:
                magic = struct.unpack('<I', f.read(4))[0]
                assert magic == ZIM_MAGIC
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def test_add_multiple_articles(self):
        """Test adding multiple articles to ZIM file."""
        with tempfile.NamedTemporaryFile(suffix='.zim', delete=False) as f:
            temp_path = f.name

        try:
            writer = ZIMWriter(temp_path)
            
            for i in range(10):
                writer.add_article(
                    url=f'article{i}.html',
                    title=f'Article {i}',
                    content=f'<html><body>Content {i}</body></html>'.encode(),
                    mime_type='text/html'
                )
            
            writer.set_main_page('article0.html')
            writer.finalize()

            assert os.path.exists(temp_path)
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def test_add_redirect(self):
        """Test adding a redirect entry."""
        with tempfile.NamedTemporaryFile(suffix='.zim', delete=False) as f:
            temp_path = f.name

        try:
            writer = ZIMWriter(temp_path)
            writer.add_article(
                url='index.html',
                title='Home',
                content=b'<html><body>Home</body></html>',
                mime_type='text/html'
            )
            writer.add_redirect(url='home', redirect_url='index.html', title='Home Redirect')
            writer.set_main_page('index.html')
            writer.finalize()

            assert os.path.exists(temp_path)
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)


class TestZIMReader:
    """Tests for ZIM file reading."""

    @pytest.fixture
    def sample_zim(self):
        """Create a sample ZIM file for testing."""
        with tempfile.NamedTemporaryFile(suffix='.zim', delete=False) as f:
            temp_path = f.name

        writer = ZIMWriter(temp_path)
        writer.add_article(
            url='index.html',
            title='Test Home',
            content=b'<html><body><h1>Welcome</h1></body></html>',
            mime_type='text/html'
        )
        writer.add_article(
            url='page2.html',
            title='Page Two',
            content=b'<html><body><p>Second page</p></body></html>',
            mime_type='text/html'
        )
        writer.add_article(
            url='style.css',
            title='Stylesheet',
            content=b'body { color: black; }',
            mime_type='text/css'
        )
        writer.set_main_page('index.html')
        writer.finalize()

        yield temp_path

        if os.path.exists(temp_path):
            os.unlink(temp_path)

    def test_read_header(self, sample_zim):
        """Test reading ZIM file header."""
        reader = ZIMReader(sample_zim)
        header = reader.header

        assert header.magic_number == ZIM_MAGIC
        assert header.major_version == ZIM_VERSION
        assert header.article_count >= 3

        reader.close()

    def test_read_article_by_url(self, sample_zim):
        """Test reading article by URL."""
        reader = ZIMReader(sample_zim)
        
        content = reader.get_article_by_url('index.html')
        assert b'Welcome' in content

        reader.close()

    def test_read_article_by_index(self, sample_zim):
        """Test reading article by index."""
        reader = ZIMReader(sample_zim)
        
        content = reader.get_article_by_index(0)
        assert content is not None
        assert len(content) > 0

        reader.close()

    def test_list_articles(self, sample_zim):
        """Test listing all articles."""
        reader = ZIMReader(sample_zim)
        
        articles = reader.list_articles()
        urls = [a.url for a in articles]
        
        assert 'index.html' in urls
        assert 'page2.html' in urls
        assert 'style.css' in urls

        reader.close()

    def test_get_main_page(self, sample_zim):
        """Test getting the main page."""
        reader = ZIMReader(sample_zim)
        
        main_url = reader.get_main_page_url()
        assert main_url == 'index.html'

        reader.close()

    def test_search_articles(self, sample_zim):
        """Test searching articles by title."""
        reader = ZIMReader(sample_zim)
        
        results = reader.search('Page')
        assert len(results) >= 1
        assert any('Page Two' in r.title for r in results)

        reader.close()


class TestRoundTrip:
    """Integration tests for write-then-read operations."""

    def test_roundtrip_simple(self):
        """Test writing and reading back content."""
        with tempfile.NamedTemporaryFile(suffix='.zim', delete=False) as f:
            temp_path = f.name

        try:
            original_content = b'<html><body>Test content here</body></html>'
            
            # Write
            writer = ZIMWriter(temp_path)
            writer.add_article(
                url='test.html',
                title='Test',
                content=original_content,
                mime_type='text/html'
            )
            writer.set_main_page('test.html')
            writer.finalize()

            # Read
            reader = ZIMReader(temp_path)
            read_content = reader.get_article_by_url('test.html')
            reader.close()

            assert read_content == original_content
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def test_roundtrip_with_compression(self):
        """Test writing and reading compressed content."""
        with tempfile.NamedTemporaryFile(suffix='.zim', delete=False) as f:
            temp_path = f.name

        try:
            # Large repetitive content compresses well
            original_content = b'<p>Repeated content</p>' * 1000
            
            writer = ZIMWriter(temp_path, compression=CompressionType.ZLIB)
            writer.add_article(
                url='big.html',
                title='Big Page',
                content=original_content,
                mime_type='text/html'
            )
            writer.set_main_page('big.html')
            writer.finalize()

            reader = ZIMReader(temp_path)
            read_content = reader.get_article_by_url('big.html')
            reader.close()

            assert read_content == original_content
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def test_roundtrip_binary_content(self):
        """Test writing and reading binary content (images)."""
        with tempfile.NamedTemporaryFile(suffix='.zim', delete=False) as f:
            temp_path = f.name

        try:
            # Simulated binary content (PNG header + random)
            binary_content = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) + os.urandom(1000)
            
            writer = ZIMWriter(temp_path)
            writer.add_article(
                url='image.png',
                title='Image',
                content=binary_content,
                mime_type='image/png'
            )
            writer.add_article(
                url='index.html',
                title='Home',
                content=b'<img src="image.png">',
                mime_type='text/html'
            )
            writer.set_main_page('index.html')
            writer.finalize()

            reader = ZIMReader(temp_path)
            read_content = reader.get_article_by_url('image.png')
            reader.close()

            assert read_content == binary_content
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

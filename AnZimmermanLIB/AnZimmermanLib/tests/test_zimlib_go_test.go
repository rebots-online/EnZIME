// Unit Tests for zimlib.go
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.
//
// Run with: go test -v ./tests/

package tests

import (
	"bytes"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	// Import the main package - adjust path as needed
	zimlib ".."
)

func TestZIMConstants(t *testing.T) {
	t.Run("ZIM_MAGIC should be correct", func(t *testing.T) {
		assert.Equal(t, uint32(72173914), zimlib.ZIM_MAGIC)
	})

	t.Run("ZIM_VERSION should be 5", func(t *testing.T) {
		assert.Equal(t, uint16(5), zimlib.ZIM_VERSION)
	})
}

func TestMimeType(t *testing.T) {
	t.Run("should have correct common MIME types", func(t *testing.T) {
		assert.Equal(t, "text/html", zimlib.MimeTypeHTML)
		assert.Equal(t, "text/css", zimlib.MimeTypeCSS)
		assert.Equal(t, "application/javascript", zimlib.MimeTypeJavaScript)
		assert.Equal(t, "image/png", zimlib.MimeTypePNG)
		assert.Equal(t, "image/jpeg", zimlib.MimeTypeJPEG)
	})

	t.Run("FromExtension should return correct types", func(t *testing.T) {
		assert.Equal(t, "text/html", zimlib.MimeTypeFromExtension(".html"))
		assert.Equal(t, "text/css", zimlib.MimeTypeFromExtension(".css"))
		assert.Equal(t, "application/javascript", zimlib.MimeTypeFromExtension(".js"))
		assert.Equal(t, "image/png", zimlib.MimeTypeFromExtension(".png"))
		assert.Equal(t, "image/jpeg", zimlib.MimeTypeFromExtension(".jpg"))
		assert.Equal(t, "image/svg+xml", zimlib.MimeTypeFromExtension(".svg"))
	})
}

func TestCompressionType(t *testing.T) {
	t.Run("should have correct compression type values", func(t *testing.T) {
		assert.Equal(t, uint8(0), zimlib.CompressionNone)
		assert.Equal(t, uint8(1), zimlib.CompressionZlib)
		assert.Equal(t, uint8(2), zimlib.CompressionBzip2)
		assert.Equal(t, uint8(3), zimlib.CompressionLzma)
		assert.Equal(t, uint8(4), zimlib.CompressionZstd)
	})
}

func TestDirectoryEntry(t *testing.T) {
	t.Run("should create content entry", func(t *testing.T) {
		entry := zimlib.NewDirectoryEntry(zimlib.DirectoryEntryOptions{
			Namespace:     'C',
			URL:           "index.html",
			Title:         "Home Page",
			MimeType:      "text/html",
			ClusterNumber: 0,
			BlobNumber:    0,
		})

		assert.Equal(t, byte('C'), entry.Namespace)
		assert.Equal(t, "index.html", entry.URL)
		assert.Equal(t, "Home Page", entry.Title)
		assert.Equal(t, "text/html", entry.MimeType)
	})

	t.Run("should create redirect entry", func(t *testing.T) {
		entry := zimlib.NewDirectoryEntry(zimlib.DirectoryEntryOptions{
			Namespace:     'C',
			URL:           "home",
			Title:         "Home Redirect",
			RedirectIndex: 0,
			IsRedirect:    true,
		})

		assert.Equal(t, byte('C'), entry.Namespace)
		assert.Equal(t, "home", entry.URL)
		assert.True(t, entry.IsRedirect)
	})

	t.Run("should serialize to bytes", func(t *testing.T) {
		entry := zimlib.NewDirectoryEntry(zimlib.DirectoryEntryOptions{
			Namespace:     'C',
			URL:           "test.html",
			Title:         "Test",
			MimeType:      "text/html",
			ClusterNumber: 0,
			BlobNumber:    0,
		})

		data := entry.ToBytes()
		assert.NotEmpty(t, data)
	})
}

func TestCluster(t *testing.T) {
	t.Run("should create uncompressed cluster", func(t *testing.T) {
		cluster := zimlib.NewCluster(zimlib.CompressionNone)
		cluster.AddBlob([]byte("Hello, World!"))
		cluster.AddBlob([]byte("Another blob"))

		assert.Equal(t, 2, cluster.BlobCount())
		assert.Equal(t, zimlib.CompressionNone, cluster.Compression)
	})

	t.Run("should create ZLIB compressed cluster", func(t *testing.T) {
		cluster := zimlib.NewCluster(zimlib.CompressionZlib)
		content := bytes.Repeat([]byte("Hello, World!"), 100)
		cluster.AddBlob(content)

		assert.Equal(t, 1, cluster.BlobCount())

		data := cluster.ToBytes()
		// Compressed should be smaller
		assert.Less(t, len(data), len(content))
	})

	t.Run("should retrieve blobs", func(t *testing.T) {
		cluster := zimlib.NewCluster(zimlib.CompressionNone)
		blob1 := []byte("First blob")
		blob2 := []byte("Second blob")

		cluster.AddBlob(blob1)
		cluster.AddBlob(blob2)

		assert.Equal(t, blob1, cluster.GetBlob(0))
		assert.Equal(t, blob2, cluster.GetBlob(1))
	})
}

func TestZIMWriter(t *testing.T) {
	t.Run("should create minimal ZIM file", func(t *testing.T) {
		tempDir, err := ioutil.TempDir("", "zim-test-")
		require.NoError(t, err)
		defer os.RemoveAll(tempDir)

		zimPath := filepath.Join(tempDir, "test.zim")

		writer, err := zimlib.NewZIMWriter(zimPath)
		require.NoError(t, err)

		err = writer.AddArticle(zimlib.ArticleOptions{
			URL:      "index.html",
			Title:    "Test Article",
			Content:  []byte("<html><body>Hello</body></html>"),
			MimeType: "text/html",
		})
		require.NoError(t, err)

		writer.SetMainPage("index.html")
		err = writer.Finalize()
		require.NoError(t, err)

		// Verify file exists
		info, err := os.Stat(zimPath)
		require.NoError(t, err)
		assert.Greater(t, info.Size(), int64(0))

		// Verify magic number
		f, err := os.Open(zimPath)
		require.NoError(t, err)
		defer f.Close()

		magicBuf := make([]byte, 4)
		_, err = f.Read(magicBuf)
		require.NoError(t, err)

		magic := uint32(magicBuf[0]) | uint32(magicBuf[1])<<8 | uint32(magicBuf[2])<<16 | uint32(magicBuf[3])<<24
		assert.Equal(t, zimlib.ZIM_MAGIC, magic)
	})

	t.Run("should add multiple articles", func(t *testing.T) {
		tempDir, err := ioutil.TempDir("", "zim-test-")
		require.NoError(t, err)
		defer os.RemoveAll(tempDir)

		zimPath := filepath.Join(tempDir, "multi.zim")

		writer, err := zimlib.NewZIMWriter(zimPath)
		require.NoError(t, err)

		for i := 0; i < 10; i++ {
			err = writer.AddArticle(zimlib.ArticleOptions{
				URL:      fmt.Sprintf("article%d.html", i),
				Title:    fmt.Sprintf("Article %d", i),
				Content:  []byte(fmt.Sprintf("<html><body>Content %d</body></html>", i)),
				MimeType: "text/html",
			})
			require.NoError(t, err)
		}

		writer.SetMainPage("article0.html")
		err = writer.Finalize()
		require.NoError(t, err)

		_, err = os.Stat(zimPath)
		require.NoError(t, err)
	})

	t.Run("should add redirect", func(t *testing.T) {
		tempDir, err := ioutil.TempDir("", "zim-test-")
		require.NoError(t, err)
		defer os.RemoveAll(tempDir)

		zimPath := filepath.Join(tempDir, "redirect.zim")

		writer, err := zimlib.NewZIMWriter(zimPath)
		require.NoError(t, err)

		err = writer.AddArticle(zimlib.ArticleOptions{
			URL:      "index.html",
			Title:    "Home",
			Content:  []byte("<html><body>Home</body></html>"),
			MimeType: "text/html",
		})
		require.NoError(t, err)

		err = writer.AddRedirect(zimlib.RedirectOptions{
			URL:         "home",
			RedirectURL: "index.html",
			Title:       "Home Redirect",
		})
		require.NoError(t, err)

		writer.SetMainPage("index.html")
		err = writer.Finalize()
		require.NoError(t, err)
	})
}

func TestZIMReader(t *testing.T) {
	// Create sample ZIM for testing
	tempDir, err := ioutil.TempDir("", "zim-test-")
	require.NoError(t, err)
	defer os.RemoveAll(tempDir)

	sampleZim := filepath.Join(tempDir, "sample.zim")

	writer, err := zimlib.NewZIMWriter(sampleZim)
	require.NoError(t, err)

	writer.AddArticle(zimlib.ArticleOptions{
		URL:      "index.html",
		Title:    "Test Home",
		Content:  []byte("<html><body><h1>Welcome</h1></body></html>"),
		MimeType: "text/html",
	})
	writer.AddArticle(zimlib.ArticleOptions{
		URL:      "page2.html",
		Title:    "Page Two",
		Content:  []byte("<html><body><p>Second page</p></body></html>"),
		MimeType: "text/html",
	})
	writer.AddArticle(zimlib.ArticleOptions{
		URL:      "style.css",
		Title:    "Stylesheet",
		Content:  []byte("body { color: black; }"),
		MimeType: "text/css",
	})
	writer.SetMainPage("index.html")
	writer.Finalize()

	t.Run("should read header", func(t *testing.T) {
		reader, err := zimlib.NewZIMReader(sampleZim)
		require.NoError(t, err)
		defer reader.Close()

		header := reader.Header()
		assert.Equal(t, zimlib.ZIM_MAGIC, header.MagicNumber)
		assert.Equal(t, zimlib.ZIM_VERSION, header.MajorVersion)
		assert.GreaterOrEqual(t, header.ArticleCount, uint32(3))
	})

	t.Run("should read article by URL", func(t *testing.T) {
		reader, err := zimlib.NewZIMReader(sampleZim)
		require.NoError(t, err)
		defer reader.Close()

		content, err := reader.GetArticleByURL("index.html")
		require.NoError(t, err)
		assert.Contains(t, string(content), "Welcome")
	})

	t.Run("should read article by index", func(t *testing.T) {
		reader, err := zimlib.NewZIMReader(sampleZim)
		require.NoError(t, err)
		defer reader.Close()

		content, err := reader.GetArticleByIndex(0)
		require.NoError(t, err)
		assert.NotEmpty(t, content)
	})

	t.Run("should list articles", func(t *testing.T) {
		reader, err := zimlib.NewZIMReader(sampleZim)
		require.NoError(t, err)
		defer reader.Close()

		articles := reader.ListArticles()
		urls := make([]string, len(articles))
		for i, a := range articles {
			urls[i] = a.URL
		}

		assert.Contains(t, urls, "index.html")
		assert.Contains(t, urls, "page2.html")
		assert.Contains(t, urls, "style.css")
	})

	t.Run("should get main page", func(t *testing.T) {
		reader, err := zimlib.NewZIMReader(sampleZim)
		require.NoError(t, err)
		defer reader.Close()

		mainURL := reader.GetMainPageURL()
		assert.Equal(t, "index.html", mainURL)
	})

	t.Run("should search articles", func(t *testing.T) {
		reader, err := zimlib.NewZIMReader(sampleZim)
		require.NoError(t, err)
		defer reader.Close()

		results := reader.Search("Page")
		assert.GreaterOrEqual(t, len(results), 1)

		found := false
		for _, r := range results {
			if r.Title == "Page Two" {
				found = true
				break
			}
		}
		assert.True(t, found)
	})
}

func TestRoundTrip(t *testing.T) {
	t.Run("should write and read simple content", func(t *testing.T) {
		tempDir, err := ioutil.TempDir("", "zim-test-")
		require.NoError(t, err)
		defer os.RemoveAll(tempDir)

		zimPath := filepath.Join(tempDir, "roundtrip.zim")
		originalContent := []byte("<html><body>Test content here</body></html>")

		// Write
		writer, err := zimlib.NewZIMWriter(zimPath)
		require.NoError(t, err)

		writer.AddArticle(zimlib.ArticleOptions{
			URL:      "test.html",
			Title:    "Test",
			Content:  originalContent,
			MimeType: "text/html",
		})
		writer.SetMainPage("test.html")
		writer.Finalize()

		// Read
		reader, err := zimlib.NewZIMReader(zimPath)
		require.NoError(t, err)
		defer reader.Close()

		readContent, err := reader.GetArticleByURL("test.html")
		require.NoError(t, err)

		assert.Equal(t, originalContent, readContent)
	})

	t.Run("should write and read compressed content", func(t *testing.T) {
		tempDir, err := ioutil.TempDir("", "zim-test-")
		require.NoError(t, err)
		defer os.RemoveAll(tempDir)

		zimPath := filepath.Join(tempDir, "compressed.zim")
		originalContent := bytes.Repeat([]byte("<p>Repeated content</p>"), 1000)

		// Write with compression
		writer, err := zimlib.NewZIMWriter(zimPath, zimlib.WriterOptions{
			Compression: zimlib.CompressionZlib,
		})
		require.NoError(t, err)

		writer.AddArticle(zimlib.ArticleOptions{
			URL:      "big.html",
			Title:    "Big Page",
			Content:  originalContent,
			MimeType: "text/html",
		})
		writer.SetMainPage("big.html")
		writer.Finalize()

		// Read
		reader, err := zimlib.NewZIMReader(zimPath)
		require.NoError(t, err)
		defer reader.Close()

		readContent, err := reader.GetArticleByURL("big.html")
		require.NoError(t, err)

		assert.Equal(t, originalContent, readContent)
	})

	t.Run("should write and read binary content", func(t *testing.T) {
		tempDir, err := ioutil.TempDir("", "zim-test-")
		require.NoError(t, err)
		defer os.RemoveAll(tempDir)

		zimPath := filepath.Join(tempDir, "binary.zim")

		// PNG header + random bytes
		binaryContent := make([]byte, 1008)
		copy(binaryContent, []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A})
		for i := 8; i < len(binaryContent); i++ {
			binaryContent[i] = byte(i % 256)
		}

		// Write
		writer, err := zimlib.NewZIMWriter(zimPath)
		require.NoError(t, err)

		writer.AddArticle(zimlib.ArticleOptions{
			URL:      "image.png",
			Title:    "Image",
			Content:  binaryContent,
			MimeType: "image/png",
		})
		writer.AddArticle(zimlib.ArticleOptions{
			URL:      "index.html",
			Title:    "Home",
			Content:  []byte("<img src=\"image.png\">"),
			MimeType: "text/html",
		})
		writer.SetMainPage("index.html")
		writer.Finalize()

		// Read
		reader, err := zimlib.NewZIMReader(zimPath)
		require.NoError(t, err)
		defer reader.Close()

		readContent, err := reader.GetArticleByURL("image.png")
		require.NoError(t, err)

		assert.Equal(t, binaryContent, readContent)
	})
}

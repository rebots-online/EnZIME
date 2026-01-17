// Example: Editing/Modifying ZIM files (Go)
//
// Since ZIM files are immutable, editing involves reading the original,
// applying modifications, and writing a new file.
//
// Run: go run 03_edit_zim.go

package main

import (
	"fmt"
	"os"
	"strings"
)

// In production, import zimlib package:
// import "github.com/yourproject/zimlib"

// ZIMEditor provides functionality for modifying ZIM files
type ZIMEditor struct {
	sourcePath    string
	modifications map[string][]byte
	newArticles   []NewArticle
	newRedirects  []NewRedirect
	excludedPaths map[string]bool
}

// NewArticle represents a new article to add
type NewArticle struct {
	Namespace byte
	URL       string
	Title     string
	Content   []byte
	MimeType  string
}

// NewRedirect represents a new redirect to add
type NewRedirect struct {
	Namespace byte
	URL       string
	Title     string
	TargetURL string
}

// NewZIMEditor creates a new editor for the given source file
func NewZIMEditor(sourcePath string) *ZIMEditor {
	return &ZIMEditor{
		sourcePath:    sourcePath,
		modifications: make(map[string][]byte),
		excludedPaths: make(map[string]bool),
	}
}

// ModifyArticle queues a content modification
func (e *ZIMEditor) ModifyArticle(path string, newContent []byte) {
	e.modifications[path] = newContent
	fmt.Printf("  📝 Queued modification: %s\n", path)
}

// DeleteArticle queues an article for deletion
func (e *ZIMEditor) DeleteArticle(path string) {
	e.excludedPaths[path] = true
	fmt.Printf("  🗑️  Queued deletion: %s\n", path)
}

// AddArticle queues a new article
func (e *ZIMEditor) AddArticle(namespace byte, url, title string, content []byte, mimeType string) {
	e.newArticles = append(e.newArticles, NewArticle{
		Namespace: namespace,
		URL:       url,
		Title:     title,
		Content:   content,
		MimeType:  mimeType,
	})
	fmt.Printf("  ➕ Queued new article: %c/%s\n", namespace, url)
}

// AddRedirect queues a new redirect
func (e *ZIMEditor) AddRedirect(namespace byte, url, title, targetURL string) {
	e.newRedirects = append(e.newRedirects, NewRedirect{
		Namespace: namespace,
		URL:       url,
		Title:     title,
		TargetURL: targetURL,
	})
	fmt.Printf("  ↪️  Queued redirect: %c/%s → %s\n", namespace, url, targetURL)
}

// FindAndReplace performs find/replace on an article
func (e *ZIMEditor) FindAndReplace(path, find, replace string) {
	// In production, read from actual ZIM file:
	/*
		reader := zimlib.NewReader(e.sourcePath)
		reader.Open()
		defer reader.Close()

		entry := reader.GetEntryByPath(path)
		if dirEntry, ok := entry.(*zimlib.DirectoryEntry); ok {
			content, _ := reader.GetArticleContent(dirEntry)
			text := string(content)
			count := strings.Count(text, find)
			newText := strings.ReplaceAll(text, find, replace)
			e.modifications[path] = []byte(newText)
			fmt.Printf("  🔄 Find/Replace in %s: %d occurrences\n", path, count)
		}
	*/
	fmt.Printf("  🔄 Find/Replace in %s: '%s' → '%s'\n", path, find, replace)
}

// Save applies all modifications and saves to a new file
func (e *ZIMEditor) Save(outputPath string) error {
	fmt.Printf("\n💾 Saving to: %s\n", outputPath)
	fmt.Println(strings.Repeat("-", 50))

	// In production:
	/*
		reader := zimlib.NewReader(e.sourcePath)
		reader.Open()
		defer reader.Close()

		writer := zimlib.NewWriter(outputPath)
		writer.Create()
		defer writer.Close()

		urlToIndex := make(map[string]int)
		currentIndex := 0
		mimeTypes := reader.GetMimeTypes()

		// Copy existing articles with modifications
		for _, article := range reader.ListArticles() {
			ns := string(article.Namespace)
			path := fmt.Sprintf("%s/%s", ns, article.URL)

			if e.excludedPaths[path] {
				fmt.Printf("  ⏭️  Skipped: %s\n", path)
				continue
			}

			var content []byte
			if modContent, ok := e.modifications[path]; ok {
				content = modContent
				fmt.Printf("  ✏️  Modified: %s\n", path)
			} else {
				content, _ = reader.GetArticleContent(article)
			}

			mimeType := "application/octet-stream"
			if int(article.MimetypeIndex) < len(mimeTypes) {
				mimeType = mimeTypes[article.MimetypeIndex]
			}

			writer.AddArticle(article.Namespace, article.URL, article.Title, content, mimeType)
			urlToIndex[path] = currentIndex
			currentIndex++
		}

		// Add new articles
		for _, article := range e.newArticles {
			path := fmt.Sprintf("%c/%s", article.Namespace, article.URL)
			writer.AddArticle(zimlib.Namespace(article.Namespace), article.URL,
				article.Title, article.Content, article.MimeType)
			urlToIndex[path] = currentIndex
			currentIndex++
			fmt.Printf("  ➕ Added: %s\n", path)
		}

		// Add new redirects
		for _, redirect := range e.newRedirects {
			targetPath := fmt.Sprintf("%c/%s", redirect.Namespace, redirect.TargetURL)
			if targetIndex, ok := urlToIndex[targetPath]; ok {
				writer.AddRedirect(zimlib.Namespace(redirect.Namespace),
					redirect.URL, redirect.Title, uint32(targetIndex))
				fmt.Printf("  ↪️  Added redirect: %s\n", redirect.URL)
			}
		}

		writer.Finalize()
	*/

	// Demo: create placeholder file
	f, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer f.Close()

	// Write placeholder ZIM header
	header := make([]byte, 80)
	header[0] = 0x5A
	header[1] = 0x5A
	header[2] = 0x49
	header[3] = 0x4D
	header[4] = 4
	f.Write(header)

	fmt.Printf("  (Demo mode - in production, full ZIM would be written)\n")
	fmt.Println(strings.Repeat("-", 50))
	fmt.Printf("✅ Saved: %s\n", outputPath)

	if info, err := os.Stat(outputPath); err == nil {
		fmt.Printf("   Size: %d bytes\n", info.Size())
	}

	return nil
}

func main() {
	fmt.Println(strings.Repeat("=", 60))
	fmt.Println("Go ZIM Editing Examples")
	fmt.Println(strings.Repeat("=", 60))

	sourceFile := "simple_wiki.zim"

	if _, err := os.Stat(sourceFile); os.IsNotExist(err) {
		fmt.Printf("\n⚠️  Source file not found: %s\n", sourceFile)
		fmt.Println("   Run 01_create_zim.go first.")

		// Create a demo source file for the example
		fmt.Println("\nCreating demo source file...")
		createDemoSource(sourceFile)
	}

	// Example 1: Modify content
	modifiedFile := exampleModifyContent(sourceFile)
	if modifiedFile != "" {
		compareFiles(sourceFile, modifiedFile)
	}

	// Example 2: Filter content
	exampleFilterContent(sourceFile)

	fmt.Println()
	fmt.Println(strings.Repeat("=", 60))
	fmt.Println("Editing examples completed!")
	fmt.Println(strings.Repeat("=", 60))
}

func exampleModifyContent(source string) string {
	output := "modified_wiki.zim"

	fmt.Println()
	fmt.Println(strings.Repeat("=", 60))
	fmt.Println("Example: Modifying Article Content")
	fmt.Println(strings.Repeat("=", 60))

	editor := NewZIMEditor(source)

	// Modify main page
	newMainContent := `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Modified Go Wiki</title>
</head>
<body>
    <h1>🎉 Modified Go Wiki</h1>
    <p>This page was modified using ZIMEditor!</p>
    <nav>
        <a href="Go">Go</a> |
        <a href="NewPage">New Page</a>
    </nav>
</body>
</html>`

	editor.ModifyArticle("A/Main_Page", []byte(newMainContent))

	// Add new article
	newPageContent := `<!DOCTYPE html>
<html>
<head><title>New Page</title></head>
<body>
    <h1>New Page</h1>
    <p>This page was added during editing.</p>
    <a href="Main_Page">← Home</a>
</body>
</html>`

	editor.AddArticle('A', "NewPage", "New Page", []byte(newPageContent), "text/html")

	// Add redirect
	editor.AddRedirect('A', "New", "New", "NewPage")

	// Find and replace
	editor.FindAndReplace("A/Go", "Go", "Go™")

	if err := editor.Save(output); err != nil {
		fmt.Printf("Error saving: %v\n", err)
		return ""
	}

	return output
}

func exampleFilterContent(source string) string {
	output := "filtered_wiki.zim"

	fmt.Println()
	fmt.Println(strings.Repeat("=", 60))
	fmt.Println("Example: Filter Content")
	fmt.Println(strings.Repeat("=", 60))

	editor := NewZIMEditor(source)

	// In production, read actual entries:
	/*
		reader := zimlib.NewReader(source)
		reader.Open()
		defer reader.Close()

		for _, article := range reader.ListArticles() {
			if article.Namespace != zimlib.NamespaceMainArticle {
				path := fmt.Sprintf("%c/%s", article.Namespace, article.URL)
				editor.DeleteArticle(path)
			}
		}
	*/

	// Demo: delete non-article namespaces
	editor.DeleteArticle("S/style.css")
	editor.DeleteArticle("M/Title")
	editor.DeleteArticle("-/data.json")

	if err := editor.Save(output); err != nil {
		fmt.Printf("Error saving: %v\n", err)
		return ""
	}

	return output
}

func compareFiles(original, modified string) {
	fmt.Println()
	fmt.Println(strings.Repeat("=", 60))
	fmt.Println("Comparison")
	fmt.Println(strings.Repeat("=", 60))

	origInfo, err1 := os.Stat(original)
	modInfo, err2 := os.Stat(modified)

	if err1 != nil || err2 != nil {
		fmt.Println("  Cannot compare files")
		return
	}

	fmt.Printf("\n  %-20s %-12s %-12s\n", "Metric", "Original", "Modified")
	fmt.Printf("  %-20s %-12s %-12s\n", strings.Repeat("-", 18), strings.Repeat("-", 10), strings.Repeat("-", 10))
	fmt.Printf("  %-20s %-12d %-12d\n", "File Size (bytes)", origInfo.Size(), modInfo.Size())

	// In production, compare actual ZIM contents:
	/*
		origReader := zimlib.NewReader(original)
		modReader := zimlib.NewReader(modified)
		origReader.Open()
		modReader.Open()
		defer origReader.Close()
		defer modReader.Close()

		origHeader := origReader.GetHeader()
		modHeader := modReader.GetHeader()

		fmt.Printf("  %-20s %-12d %-12d\n", "Entries", origHeader.EntryCount, modHeader.EntryCount)
		fmt.Printf("  %-20s %-12d %-12d\n", "Articles", origHeader.ArticleCount, modHeader.ArticleCount)
		fmt.Printf("  %-20s %-12d %-12d\n", "Clusters", origHeader.ClusterCount, modHeader.ClusterCount)
	*/
}

func createDemoSource(filename string) {
	f, err := os.Create(filename)
	if err != nil {
		fmt.Printf("Error creating demo file: %v\n", err)
		return
	}
	defer f.Close()

	// Write ZIM magic number and placeholder header
	header := make([]byte, 80)
	header[0] = 0x5A
	header[1] = 0x5A
	header[2] = 0x49
	header[3] = 0x4D
	header[4] = 4

	f.Write(header)
	f.WriteString("<html><body><h1>Demo</h1></body></html>")

	fmt.Printf("  Created demo file: %s\n", filename)
}

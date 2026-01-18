// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

// Example: Reading a ZIM file (Go)
//
// This example demonstrates how to read and extract content from ZIM archives.
//
// Run: go run 02_read_zim.go [path/to/file.zim]

package main

import (
	"fmt"
	"os"
	"strings"
)

// In production, import zimlib package:
// import "github.com/yourproject/zimlib"

func main() {
	fmt.Println(strings.Repeat("=", 60))
	fmt.Println("Go ZIM File Reading Examples")
	fmt.Println(strings.Repeat("=", 60))

	// Get file path from args or use default
	zimPath := "simple_wiki.zim"
	if len(os.Args) > 1 {
		zimPath = os.Args[1]
	}

	if _, err := os.Stat(zimPath); os.IsNotExist(err) {
		fmt.Printf("File not found: %s\n", zimPath)
		fmt.Println("Please run 01_create_zim.go first, or provide a ZIM file path.")
		fmt.Println("\nUsage: go run 02_read_zim.go [path/to/file.zim]")
		return
	}

	fmt.Printf("\nReading: %s\n", zimPath)

	// In production:
	/*
		reader := zimlib.NewReader(zimPath)
		if err := reader.Open(); err != nil {
			log.Fatal(err)
		}
		defer reader.Close()

		displayHeader(reader)
		displayMimeTypes(reader)
		displayMainPage(reader)
		listEntries(reader, 10)
		readArticleByPath(reader, "A/Main_Page")
		searchArticles(reader, "go")
		analyzeNamespaces(reader)
	*/

	// Demonstration of API usage
	demonstrateReaderAPI(zimPath)

	fmt.Println()
	fmt.Println(strings.Repeat("=", 60))
	fmt.Println("Reading examples completed!")
	fmt.Println(strings.Repeat("=", 60))
}

func demonstrateReaderAPI(zimPath string) {
	fmt.Println("\n📋 HEADER INFORMATION")
	fmt.Println(strings.Repeat("-", 40))
	fmt.Println("  In production, use zimlib.Reader to access:")
	fmt.Println("  - reader.GetHeader().MagicNumber")
	fmt.Println("  - reader.GetHeader().MajorVersion")
	fmt.Println("  - reader.GetHeader().EntryCount")
	fmt.Println("  - reader.GetHeader().ArticleCount")
	fmt.Println("  - reader.GetHeader().ClusterCount")

	fmt.Println("\n📄 MIME TYPES")
	fmt.Println(strings.Repeat("-", 40))
	fmt.Println("  reader.GetMimeTypes() returns []string")
	fmt.Println("  Example MIME types:")
	fmt.Println("    [0] text/html")
	fmt.Println("    [1] text/css")
	fmt.Println("    [2] application/javascript")

	fmt.Println("\n🏠 MAIN PAGE")
	fmt.Println(strings.Repeat("-", 40))
	fmt.Println("  mainPage := reader.GetMainPage()")
	fmt.Println("  if dirEntry, ok := mainPage.(*zimlib.DirectoryEntry); ok {")
	fmt.Println("      content, _ := reader.GetArticleContent(dirEntry)")
	fmt.Println("      fmt.Println(string(content))")
	fmt.Println("  }")

	fmt.Println("\n📚 LISTING ARTICLES")
	fmt.Println(strings.Repeat("-", 40))
	fmt.Println("  articles := reader.ListArticles()")
	fmt.Println("  for _, article := range articles {")
	fmt.Println("      fmt.Printf(\"[%c] %s\\n\", article.Namespace, article.URL)")
	fmt.Println("  }")

	fmt.Println("\n🔍 READING BY PATH")
	fmt.Println(strings.Repeat("-", 40))
	fmt.Println("  entry := reader.GetEntryByPath(\"A/Main_Page\")")
	fmt.Println("  if dirEntry, ok := entry.(*zimlib.DirectoryEntry); ok {")
	fmt.Println("      content, err := reader.GetArticleContent(dirEntry)")
	fmt.Println("      if err == nil {")
	fmt.Println("          fmt.Println(string(content))")
	fmt.Println("      }")
	fmt.Println("  }")

	fmt.Println("\n🔎 SEARCHING ARTICLES")
	fmt.Println(strings.Repeat("-", 40))
	fmt.Println("  articles := reader.ListArticles()")
	fmt.Println("  for _, article := range articles {")
	fmt.Println("      if strings.Contains(strings.ToLower(article.URL), keyword) {")
	fmt.Println("          results = append(results, article)")
	fmt.Println("      }")
	fmt.Println("  }")

	fmt.Println("\n📊 NAMESPACE ANALYSIS")
	fmt.Println(strings.Repeat("-", 40))
	fmt.Println("  namespaceCounts := make(map[byte]int)")
	fmt.Println("  for _, article := range reader.ListArticles() {")
	fmt.Println("      namespaceCounts[byte(article.Namespace)]++")
	fmt.Println("  }")
}

// Production code example functions:

/*
func displayHeader(reader *zimlib.Reader) {
	header := reader.GetHeader()

	fmt.Println("\n📋 HEADER INFORMATION")
	fmt.Println(strings.Repeat("-", 40))
	fmt.Printf("  Magic Number: 0x%08X\n", header.MagicNumber)
	fmt.Printf("  Version: %d.%d\n", header.MajorVersion, header.MinorVersion)
	fmt.Printf("  Entry Count: %d\n", header.EntryCount)
	fmt.Printf("  Article Count: %d\n", header.ArticleCount)
	fmt.Printf("  Cluster Count: %d\n", header.ClusterCount)
	fmt.Printf("  Redirect Count: %d\n", header.RedirectCount)
	fmt.Printf("  Main Page Index: %d\n", header.MainPageIndex)
}

func displayMimeTypes(reader *zimlib.Reader) {
	mimeTypes := reader.GetMimeTypes()

	fmt.Println("\n📄 MIME TYPES")
	fmt.Println(strings.Repeat("-", 40))
	for i, mime := range mimeTypes {
		fmt.Printf("  [%d] %s\n", i, mime)
	}
}

func displayMainPage(reader *zimlib.Reader) {
	fmt.Println("\n🏠 MAIN PAGE")
	fmt.Println(strings.Repeat("-", 40))

	mainPage := reader.GetMainPage()
	if mainPage == nil {
		fmt.Println("  No main page defined")
		return
	}

	switch entry := mainPage.(type) {
	case *zimlib.DirectoryEntry:
		fmt.Printf("  URL: %s\n", entry.URL)
		fmt.Printf("  Title: %s\n", entry.Title)
		fmt.Printf("  Namespace: %c\n", entry.Namespace)

		content, err := reader.GetArticleContent(entry)
		if err == nil {
			fmt.Printf("  Content size: %d bytes\n", len(content))
		}
	case *zimlib.RedirectEntry:
		fmt.Printf("  URL: %s (redirect)\n", entry.URL)
		fmt.Printf("  Target index: %d\n", entry.RedirectIndex)
	}
}

func listEntries(reader *zimlib.Reader, limit int) {
	articles := reader.ListArticles()

	fmt.Println("\n📚 ARTICLES")
	fmt.Println(strings.Repeat("-", 40))
	fmt.Printf("  Total articles: %d\n", len(articles))

	for i, article := range articles {
		if i >= limit {
			fmt.Printf("\n  ... and %d more articles\n", len(articles)-limit)
			break
		}

		fmt.Printf("\n  [%d] [%c] %s\n", i, article.Namespace, article.URL)
		fmt.Printf("       Title: %s\n", article.Title)
		fmt.Printf("       Cluster: %d, Blob: %d\n", article.ClusterNumber, article.BlobNumber)
	}
}

func readArticleByPath(reader *zimlib.Reader, path string) []byte {
	fmt.Printf("\n🔍 Reading: %s\n", path)
	fmt.Println(strings.Repeat("-", 40))

	entry := reader.GetEntryByPath(path)
	if entry == nil {
		fmt.Printf("  ❌ Not found: %s\n", path)
		return nil
	}

	switch e := entry.(type) {
	case *zimlib.DirectoryEntry:
		fmt.Println("  ✓ Found entry:")
		fmt.Printf("    Namespace: %c\n", e.Namespace)
		fmt.Printf("    URL: %s\n", e.URL)
		fmt.Printf("    Title: %s\n", e.Title)
		fmt.Println("    Type: Article")
		fmt.Printf("    Cluster: %d\n", e.ClusterNumber)
		fmt.Printf("    Blob: %d\n", e.BlobNumber)

		content, err := reader.GetArticleContent(e)
		if err != nil {
			fmt.Printf("    ❌ Error: %v\n", err)
			return nil
		}

		fmt.Printf("    Content size: %d bytes\n", len(content))

		// Preview
		preview := string(content)
		if len(preview) > 300 {
			preview = preview[:300]
		}
		fmt.Println("\n    Preview:")
		fmt.Println("    " + strings.Repeat("-", 36))
		lines := strings.Split(preview, "\n")
		for i, line := range lines {
			if i >= 10 {
				break
			}
			if len(line) > 60 {
				line = line[:60]
			}
			fmt.Printf("    | %s\n", line)
		}
		if len(content) > 300 {
			fmt.Println("    | ...")
		}

		return content

	case *zimlib.RedirectEntry:
		fmt.Println("  ✓ Found entry:")
		fmt.Printf("    Type: Redirect to index %d\n", e.RedirectIndex)
		return nil
	}

	return nil
}

func searchArticles(reader *zimlib.Reader, keyword string) []*zimlib.DirectoryEntry {
	fmt.Printf("\n🔎 Searching for: \"%s\"\n", keyword)
	fmt.Println(strings.Repeat("-", 40))

	articles := reader.ListArticles()
	keywordLower := strings.ToLower(keyword)
	var results []*zimlib.DirectoryEntry

	for _, article := range articles {
		if strings.Contains(strings.ToLower(article.URL), keywordLower) ||
			strings.Contains(strings.ToLower(article.Title), keywordLower) {
			results = append(results, article)
		}
	}

	fmt.Printf("  Found %d matches:\n", len(results))

	for i, article := range results {
		if i >= 5 {
			fmt.Printf("  ... and %d more\n", len(results)-5)
			break
		}
		fmt.Printf("  - [%c] %s (%s)\n", article.Namespace, article.URL, article.Title)
	}

	return results
}

func analyzeNamespaces(reader *zimlib.Reader) {
	fmt.Println("\n📊 NAMESPACE ANALYSIS")
	fmt.Println(strings.Repeat("-", 40))

	articles := reader.ListArticles()
	namespaceCounts := make(map[byte]int)

	for _, article := range articles {
		namespaceCounts[byte(article.Namespace)]++
	}

	nsNames := map[byte]string{
		'A': "Main Articles",
		'I': "Images",
		'M': "Metadata",
		'-': "Raw Data",
		'S': "Stylesheets",
		'J': "Scripts",
		'T': "Fonts",
	}

	fmt.Printf("  %-20s %-10s\n", "Namespace", "Count")
	fmt.Printf("  %-20s %-10s\n", strings.Repeat("-", 18), strings.Repeat("-", 8))

	for ns, count := range namespaceCounts {
		name := nsNames[ns]
		if name == "" {
			name = "Unknown"
		}
		fmt.Printf("  %-20s %-10d\n", fmt.Sprintf("%c (%s)", ns, name), count)
	}
}
*/

// Example: Creating a ZIM file from scratch (Go)
//
// This example demonstrates how to create a new ZIM archive containing
// multiple articles, stylesheets, and redirects.
//
// Run: go run 01_create_zim.go

package main

import (
	"fmt"
	"os"
	"strings"
)

// Import the zimlib package (adjust path as needed)
// import "github.com/yourproject/zimlib"

// For this example, we'll define the necessary types inline
// In production, import from the zimlib package

type CompressionType byte

const (
	CompressionDefault CompressionType = 0
	CompressionNone    CompressionType = 1
	CompressionZlib    CompressionType = 2
)

type Namespace byte

const (
	NamespaceMainArticle Namespace = 'A'
	NamespaceImage       Namespace = 'I'
	NamespaceMetadata    Namespace = 'M'
	NamespaceRawData     Namespace = '-'
	NamespaceStyle       Namespace = 'S'
	NamespaceScript      Namespace = 'J'
)

func main() {
	fmt.Println(strings.Repeat("=", 60))
	fmt.Println("Go ZIM File Creation Examples")
	fmt.Println(strings.Repeat("=", 60))

	simpleFile := createSimpleWiki()
	metadataFile := createMetadataWiki()

	fmt.Println()
	fmt.Println(strings.Repeat("=", 60))
	fmt.Println("Examples completed!")
	fmt.Printf("Created: %s, %s\n", simpleFile, metadataFile)
	fmt.Println(strings.Repeat("=", 60))
}

func createSimpleWiki() string {
	outputFile := "simple_wiki.zim"

	fmt.Printf("\nCreating ZIM file: %s\n", outputFile)
	fmt.Println(strings.Repeat("-", 50))

	// Note: In production, use zimlib.NewWriter(outputFile)
	// For this example, we demonstrate the API structure

	// Main Page content
	mainPageContent := `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Welcome to Go Wiki</title>
    <link rel="stylesheet" href="../S/style.css">
</head>
<body>
    <header>
        <h1>Welcome to Go Wiki</h1>
    </header>
    <nav>
        <ul>
            <li><a href="Go">Go Language</a></li>
            <li><a href="Concurrency">Concurrency</a></li>
            <li><a href="Packages">Packages</a></li>
        </ul>
    </nav>
    <main>
        <p>This ZIM archive was created using the Go ZIM library.</p>
        <p>Explore the articles using the navigation above.</p>
    </main>
</body>
</html>`

	fmt.Println("✓ Prepared: Main_Page")

	// Go Language article
	goContent := `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Go Programming Language</title>
    <link rel="stylesheet" href="../S/style.css">
</head>
<body>
    <header>
        <h1>Go</h1>
    </header>
    <main>
        <p>Go is a statically typed, compiled programming language designed at Google.</p>
        
        <h2>Features</h2>
        <ul>
            <li>Fast compilation</li>
            <li>Garbage collection</li>
            <li>Built-in concurrency</li>
            <li>Simple syntax</li>
        </ul>
        
        <h2>Example Code</h2>
        <pre><code>package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}</code></pre>
        
        <p><a href="Main_Page">← Back to Home</a></p>
    </main>
</body>
</html>`

	fmt.Println("✓ Prepared: Go")

	// Concurrency article
	concurrencyContent := `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Concurrency in Go</title>
    <link rel="stylesheet" href="../S/style.css">
</head>
<body>
    <header>
        <h1>Concurrency</h1>
    </header>
    <main>
        <p>Go provides built-in support for concurrent programming.</p>
        
        <h2>Key Concepts</h2>
        <ul>
            <li>Goroutines - lightweight threads</li>
            <li>Channels - communication between goroutines</li>
            <li>Select - multiplex channel operations</li>
            <li>Sync package - synchronization primitives</li>
        </ul>
        
        <h2>Example: Goroutines</h2>
        <pre><code>package main

import (
    "fmt"
    "time"
)

func say(s string) {
    for i := 0; i < 3; i++ {
        time.Sleep(100 * time.Millisecond)
        fmt.Println(s)
    }
}

func main() {
    go say("world")
    say("hello")
}</code></pre>
        
        <p><a href="Main_Page">← Back to Home</a></p>
    </main>
</body>
</html>`

	fmt.Println("✓ Prepared: Concurrency")

	// Packages article
	packagesContent := `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Go Packages</title>
    <link rel="stylesheet" href="../S/style.css">
</head>
<body>
    <header>
        <h1>Packages</h1>
    </header>
    <main>
        <p>Go code is organized into packages for modularity and reuse.</p>
        
        <h2>Standard Library Highlights</h2>
        <ul>
            <li>fmt - formatted I/O</li>
            <li>net/http - HTTP client and server</li>
            <li>encoding/json - JSON encoding/decoding</li>
            <li>os - operating system functions</li>
        </ul>
        
        <p><a href="Main_Page">← Back to Home</a></p>
    </main>
</body>
</html>`

	fmt.Println("✓ Prepared: Packages")

	// CSS stylesheet
	cssContent := `/* Go Wiki Stylesheet */
body {
    font-family: 'Roboto', 'Segoe UI', sans-serif;
    line-height: 1.6;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    color: #333;
    background-color: #f0f4f8;
}

header {
    background: linear-gradient(135deg, #00ADD8 0%, #007d9c 100%);
    color: white;
    padding: 20px;
    margin: -20px -20px 20px -20px;
}

header h1 { margin: 0; }

nav ul {
    list-style: none;
    padding: 0;
    display: flex;
    gap: 15px;
    background: #005d7a;
    margin: -20px -20px 20px -20px;
    padding: 10px 20px;
}

nav a {
    color: white;
    text-decoration: none;
}

main {
    background: white;
    padding: 20px;
    border-radius: 5px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

pre {
    background: #2d2d2d;
    color: #f8f8f2;
    padding: 15px;
    border-radius: 5px;
    overflow-x: auto;
}

a { color: #00ADD8; }
h2 { color: #007d9c; border-bottom: 2px solid #00ADD8; padding-bottom: 5px; }
`

	fmt.Println("✓ Prepared: style.css")

	// In production, you would use the actual zimlib Writer:
	/*
		writer := zimlib.NewWriter(outputFile)
		if err := writer.Create(); err != nil {
			log.Fatal(err)
		}

		writer.AddArticle(zimlib.NamespaceMainArticle, "Main_Page", "Welcome to Go Wiki",
			[]byte(mainPageContent), "text/html")
		writer.AddArticle(zimlib.NamespaceMainArticle, "Go", "Go Programming Language",
			[]byte(goContent), "text/html")
		writer.AddArticle(zimlib.NamespaceMainArticle, "Concurrency", "Concurrency in Go",
			[]byte(concurrencyContent), "text/html")
		writer.AddArticle(zimlib.NamespaceMainArticle, "Packages", "Go Packages",
			[]byte(packagesContent), "text/html")
		writer.AddArticle(zimlib.NamespaceStyle, "style.css", "Main Stylesheet",
			[]byte(cssContent), "text/css")

		writer.AddRedirect(zimlib.NamespaceMainArticle, "Home", "Home", 0)
		writer.AddRedirect(zimlib.NamespaceMainArticle, "Golang", "Golang", 1)

		if err := writer.Finalize(); err != nil {
			log.Fatal(err)
		}
		writer.Close()
	*/

	// For demonstration, create a simple file
	createDemoFile(outputFile, mainPageContent, goContent, concurrencyContent, packagesContent, cssContent)

	fmt.Println(strings.Repeat("-", 50))
	fmt.Printf("✓ ZIM file created: %s\n", outputFile)

	if info, err := os.Stat(outputFile); err == nil {
		fmt.Printf("  File size: %d bytes\n", info.Size())
	}

	return outputFile
}

func createMetadataWiki() string {
	outputFile := "metadata_wiki.zim"

	fmt.Printf("\nCreating metadata ZIM: %s\n", outputFile)
	fmt.Println(strings.Repeat("-", 50))

	// Metadata entries
	metadata := map[string]string{
		"Title":       "Go Wiki with Metadata",
		"Description": "A demonstration of ZIM metadata",
		"Creator":     "Go ZIM Library",
		"Publisher":   "Example Publisher",
		"Date":        "2024-01-01",
		"Language":    "eng",
	}

	for key, value := range metadata {
		fmt.Printf("✓ Prepared metadata: %s = %s\n", key, value)
	}

	mainContent := `<!DOCTYPE html>
<html>
<head><title>Metadata Example</title></head>
<body>
<h1>ZIM with Metadata</h1>
<p>This ZIM file includes metadata entries.</p>
</body>
</html>`

	fmt.Println("✓ Prepared: Main_Page")

	// In production, use zimlib.Writer
	createDemoMetadataFile(outputFile, metadata, mainContent)

	fmt.Println(strings.Repeat("-", 50))
	fmt.Printf("✓ Metadata ZIM created: %s\n", outputFile)

	return outputFile
}

// Demo file creation (simplified - in production use zimlib)
func createDemoFile(filename string, contents ...string) {
	f, err := os.Create(filename)
	if err != nil {
		fmt.Printf("Error creating file: %v\n", err)
		return
	}
	defer f.Close()

	// Write ZIM magic number and placeholder header
	header := make([]byte, 80)
	// Magic number: 0x4D495A5A ("ZZIM" in little endian)
	header[0] = 0x5A
	header[1] = 0x5A
	header[2] = 0x49
	header[3] = 0x4D
	// Version 4.0
	header[4] = 4
	header[5] = 0
	header[6] = 0
	header[7] = 0

	f.Write(header)

	// Write content (simplified)
	for _, content := range contents {
		f.WriteString(content)
	}
}

func createDemoMetadataFile(filename string, metadata map[string]string, mainContent string) {
	f, err := os.Create(filename)
	if err != nil {
		fmt.Printf("Error creating file: %v\n", err)
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

	for key, value := range metadata {
		f.WriteString(fmt.Sprintf("%s=%s\n", key, value))
	}
	f.WriteString(mainContent)
}

// ZIM Library REST API with Gin and Swagger UI
//
// This module provides a RESTful API for ZIM file operations with
// automatic Swagger/OpenAPI documentation and interactive testing.
//
// Run: go run zim_api.go
// Swagger UI: http://localhost:8080/swagger/index.html
// OpenAPI JSON: http://localhost:8080/swagger/doc.json
//
// Requirements:
//   go get -u github.com/gin-gonic/gin
//   go get -u github.com/swaggo/gin-swagger
//   go get -u github.com/swaggo/swag/cmd/swag
//   swag init  # Generate docs

package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// =============================================================================
// Swagger Documentation Comments (for swag init)
// =============================================================================

// @title ZIM Library API
// @version 1.0.0
// @description REST API for ZIM file operations with Swagger documentation.
// @description
// @description ## Features
// @description - 📖 Read ZIM files and extract content
// @description - ✏️ Write new ZIM files
// @description - 🔍 Search articles
// @description - 📊 Analyze ZIM structure
// @description
// @description ## Namespaces
// @description | Code | Description |
// @description |------|-------------|
// @description | A | Main articles |
// @description | I | Images |
// @description | M | Metadata |
// @description | - | Raw data |
// @description | S | CSS stylesheets |
// @description | J | JavaScript |

// @contact.name ZIM Library
// @contact.url https://github.com/yourproject/zimlib

// @license.name MIT
// @license.url https://opensource.org/licenses/MIT

// @host localhost:8080
// @BasePath /

// =============================================================================
// Models
// =============================================================================

// ZIMHeader represents ZIM file header information
type ZIMHeader struct {
	MagicNumber   string `json:"magicNumber" example:"0x4D495A5A"`
	MajorVersion  int    `json:"majorVersion" example:"4"`
	MinorVersion  int    `json:"minorVersion" example:"0"`
	EntryCount    int    `json:"entryCount" example:"150"`
	ArticleCount  int    `json:"articleCount" example:"100"`
	ClusterCount  int    `json:"clusterCount" example:"50"`
	RedirectCount int    `json:"redirectCount" example:"20"`
	MainPageIndex int    `json:"mainPageIndex" example:"0"`
}

// ArticleEntry represents an article entry
type ArticleEntry struct {
	Index         int    `json:"index" example:"0"`
	Namespace     string `json:"namespace" example:"A"`
	URL           string `json:"url" example:"Main_Page"`
	Title         string `json:"title" example:"Welcome"`
	MimetypeIndex int    `json:"mimetypeIndex" example:"0"`
	ClusterNumber int    `json:"clusterNumber" example:"0"`
	BlobNumber    int    `json:"blobNumber" example:"0"`
	EntryType     string `json:"entryType" example:"article"`
}

// RedirectEntry represents a redirect entry
type RedirectEntry struct {
	Index         int    `json:"index" example:"0"`
	Namespace     string `json:"namespace" example:"A"`
	URL           string `json:"url" example:"Home"`
	Title         string `json:"title" example:"Home"`
	RedirectIndex int    `json:"redirectIndex" example:"0"`
	EntryType     string `json:"entryType" example:"redirect"`
}

// ArticleContent represents article content response
type ArticleContent struct {
	URL           string `json:"url" example:"Main_Page"`
	Title         string `json:"title" example:"Welcome"`
	Namespace     string `json:"namespace" example:"A"`
	Content       string `json:"content"`
	ContentType   string `json:"contentType" example:"text/html"`
	ContentLength int    `json:"contentLength" example:"1024"`
	Encoding      string `json:"encoding" example:"utf-8"`
}

// ZIMInfo represents complete ZIM file information
type ZIMInfo struct {
	Filename   string            `json:"filename" example:"wiki.zim"`
	FileSize   int64             `json:"fileSize" example:"1048576"`
	Header     ZIMHeader         `json:"header"`
	MimeTypes  []string          `json:"mimeTypes"`
	Namespaces map[string]int    `json:"namespaces"`
}

// SearchResult represents search results
type SearchResult struct {
	Total   int            `json:"total" example:"5"`
	Results []ArticleEntry `json:"results"`
}

// CreateArticleRequest represents article creation request
type CreateArticleRequest struct {
	Namespace string `json:"namespace" example:"A"`
	URL       string `json:"url" example:"New_Article"`
	Title     string `json:"title" example:"New Article"`
	Content   string `json:"content" example:"<html><body>Hello</body></html>"`
	MimeType  string `json:"mimeType" example:"text/html"`
}

// CreateZIMRequest represents ZIM creation request
type CreateZIMRequest struct {
	Filename    string                 `json:"filename" example:"my_wiki.zim"`
	Articles    []CreateArticleRequest `json:"articles"`
	MainPageURL string                 `json:"mainPageUrl" example:"Main_Page"`
}

// APIStatus represents API status
type APIStatus struct {
	Status    string  `json:"status" example:"ok"`
	Version   string  `json:"version" example:"1.0.0"`
	LoadedZIM *string `json:"loadedZim"`
	Timestamp string  `json:"timestamp" example:"2024-01-01T12:00:00Z"`
}

// ErrorResponse represents error response
type ErrorResponse struct {
	Error  string `json:"error" example:"Error message"`
	Detail string `json:"detail,omitempty"`
}

// =============================================================================
// State
// =============================================================================

type zimState struct {
	// In production, use actual zimlib.Reader
	filename string
	filepath string
	loaded   bool
	// Mock data for demonstration
	mockHeader    ZIMHeader
	mockMimeTypes []string
	mockArticles  []ArticleEntry
	mockRedirects []RedirectEntry
}

var state = &zimState{
	mockHeader: ZIMHeader{
		MagicNumber:   "0x4D495A5A",
		MajorVersion:  4,
		MinorVersion:  0,
		EntryCount:    5,
		ArticleCount:  3,
		ClusterCount:  2,
		RedirectCount: 1,
		MainPageIndex: 0,
	},
	mockMimeTypes: []string{"text/html", "text/css", "application/javascript"},
	mockArticles: []ArticleEntry{
		{Index: 0, Namespace: "A", URL: "Main_Page", Title: "Welcome", MimetypeIndex: 0, ClusterNumber: 0, BlobNumber: 0, EntryType: "article"},
		{Index: 1, Namespace: "A", URL: "Article_1", Title: "First Article", MimetypeIndex: 0, ClusterNumber: 0, BlobNumber: 1, EntryType: "article"},
		{Index: 2, Namespace: "S", URL: "style.css", Title: "Stylesheet", MimetypeIndex: 1, ClusterNumber: 1, BlobNumber: 0, EntryType: "article"},
	},
	mockRedirects: []RedirectEntry{
		{Index: 3, Namespace: "A", URL: "Home", Title: "Home", RedirectIndex: 0, EntryType: "redirect"},
	},
}

var uploadDir = filepath.Join(os.TempDir(), "zim_uploads")

// =============================================================================
// OpenAPI Specification
// =============================================================================

func getOpenAPISpec() map[string]interface{} {
	return map[string]interface{}{
		"openapi": "3.0.0",
		"info": map[string]interface{}{
			"title":       "ZIM Library API",
			"version":     "1.0.0",
			"description": "REST API for ZIM file operations with Swagger documentation.\n\n## Features\n- 📖 Read ZIM files\n- ✏️ Write ZIM files\n- 🔍 Search articles\n- 📊 Analyze structure",
			"contact": map[string]string{
				"name": "ZIM Library",
				"url":  "https://github.com/yourproject/zimlib",
			},
			"license": map[string]string{
				"name": "MIT",
				"url":  "https://opensource.org/licenses/MIT",
			},
		},
		"servers": []map[string]string{
			{"url": "http://localhost:8080", "description": "Development server"},
		},
		"tags": []map[string]string{
			{"name": "status", "description": "API status and health checks"},
			{"name": "read", "description": "Read ZIM file contents"},
			{"name": "write", "description": "Create and modify ZIM files"},
			{"name": "search", "description": "Search ZIM file contents"},
			{"name": "export", "description": "Export ZIM content"},
		},
		"paths": map[string]interface{}{
			"/status": map[string]interface{}{
				"get": map[string]interface{}{
					"tags":        []string{"status"},
					"summary":     "API Status",
					"description": "Check API status and currently loaded ZIM file",
					"responses": map[string]interface{}{
						"200": map[string]interface{}{
							"description": "API status",
						},
					},
				},
			},
			"/zim/upload": map[string]interface{}{
				"post": map[string]interface{}{
					"tags":        []string{"read"},
					"summary":     "Upload ZIM File",
					"description": "Upload a ZIM file for processing",
					"requestBody": map[string]interface{}{
						"content": map[string]interface{}{
							"multipart/form-data": map[string]interface{}{
								"schema": map[string]interface{}{
									"type": "object",
									"properties": map[string]interface{}{
										"file": map[string]interface{}{
											"type":   "string",
											"format": "binary",
										},
									},
								},
							},
						},
					},
				},
			},
			"/zim/info": map[string]interface{}{
				"get": map[string]interface{}{
					"tags":        []string{"read"},
					"summary":     "Get ZIM Info",
					"description": "Get detailed information about loaded ZIM file",
				},
			},
			"/zim/articles": map[string]interface{}{
				"get": map[string]interface{}{
					"tags":        []string{"read"},
					"summary":     "List Articles",
					"description": "List all articles with optional filtering",
					"parameters": []map[string]interface{}{
						{"name": "namespace", "in": "query", "schema": map[string]string{"type": "string"}},
						{"name": "limit", "in": "query", "schema": map[string]interface{}{"type": "integer", "default": 100}},
						{"name": "offset", "in": "query", "schema": map[string]interface{}{"type": "integer", "default": 0}},
					},
				},
			},
			"/zim/article/{namespace}/{path}": map[string]interface{}{
				"get": map[string]interface{}{
					"tags":        []string{"read"},
					"summary":     "Get Article Content",
					"description": "Retrieve content of a specific article",
					"parameters": []map[string]interface{}{
						{"name": "namespace", "in": "path", "required": true, "schema": map[string]string{"type": "string"}},
						{"name": "path", "in": "path", "required": true, "schema": map[string]string{"type": "string"}},
					},
				},
			},
			"/zim/search": map[string]interface{}{
				"get": map[string]interface{}{
					"tags":        []string{"search"},
					"summary":     "Search Articles",
					"description": "Search articles by title or URL",
					"parameters": []map[string]interface{}{
						{"name": "q", "in": "query", "required": true, "schema": map[string]string{"type": "string"}},
						{"name": "namespace", "in": "query", "schema": map[string]string{"type": "string"}},
						{"name": "limit", "in": "query", "schema": map[string]interface{}{"type": "integer", "default": 20}},
					},
				},
			},
			"/zim/create": map[string]interface{}{
				"post": map[string]interface{}{
					"tags":        []string{"write"},
					"summary":     "Create ZIM File",
					"description": "Create a new ZIM file",
				},
			},
		},
	}
}

// =============================================================================
// Handlers
// =============================================================================

func jsonResponse(w http.ResponseWriter, data interface{}, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func errorJSON(w http.ResponseWriter, message string, detail string, status int) {
	resp := ErrorResponse{Error: message}
	if detail != "" {
		resp.Detail = detail
	}
	jsonResponse(w, resp, status)
}

func handleWelcome(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	fmt.Fprint(w, `<!DOCTYPE html>
<html>
<head>
    <title>ZIM Library API</title>
    <style>
        body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        h1 { color: #2c3e50; }
        .links { margin: 20px 0; }
        .links a { display: inline-block; margin: 10px; padding: 15px 25px;
                   background: #3498db; color: white; text-decoration: none; border-radius: 5px; }
        .links a:hover { background: #2980b9; }
    </style>
</head>
<body>
    <h1>🗂️ ZIM Library REST API (Go)</h1>
    <p>Welcome to the ZIM file format REST API with Swagger documentation.</p>
    <div class="links">
        <a href="/swagger">📚 Swagger UI</a>
        <a href="/openapi.json">📄 OpenAPI JSON</a>
    </div>
    <h2>Quick Start</h2>
    <ol>
        <li>Upload a ZIM file: <code>POST /zim/upload</code></li>
        <li>Get file info: <code>GET /zim/info</code></li>
        <li>List articles: <code>GET /zim/articles</code></li>
        <li>Read article: <code>GET /zim/article/{namespace}/{path}</code></li>
    </ol>
</body>
</html>`)
}

func handleSwagger(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	fmt.Fprint(w, `<!DOCTYPE html>
<html>
<head>
    <title>ZIM API - Swagger UI</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        SwaggerUIBundle({
            url: '/openapi.json',
            dom_id: '#swagger-ui',
            presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
            layout: 'StandaloneLayout'
        });
    </script>
</body>
</html>`)
}

func handleOpenAPI(w http.ResponseWriter, r *http.Request) {
	jsonResponse(w, getOpenAPISpec(), http.StatusOK)
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	var loadedZim *string
	if state.loaded {
		loadedZim = &state.filename
	}
	jsonResponse(w, APIStatus{
		Status:    "ok",
		Version:   "1.0.0",
		LoadedZIM: loadedZim,
		Timestamp: time.Now().Format(time.RFC3339),
	}, http.StatusOK)
}

func handleUpload(w http.ResponseWriter, r *http.Request) {
	r.ParseMultipartForm(100 << 20) // 100MB max

	file, header, err := r.FormFile("file")
	if err != nil {
		errorJSON(w, "No file uploaded", err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	if !strings.HasSuffix(header.Filename, ".zim") {
		errorJSON(w, "File must have .zim extension", "", http.StatusBadRequest)
		return
	}

	os.MkdirAll(uploadDir, 0755)
	targetPath := filepath.Join(uploadDir, header.Filename)

	dst, err := os.Create(targetPath)
	if err != nil {
		errorJSON(w, "Failed to save file", err.Error(), http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	io.Copy(dst, file)

	// In production, use actual zimlib.Reader
	state.loaded = true
	state.filename = header.Filename
	state.filepath = targetPath

	handleInfo(w, r)
}

func handleLoad(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path string `json:"path"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	if req.Path == "" {
		errorJSON(w, "Path is required", "", http.StatusBadRequest)
		return
	}

	if _, err := os.Stat(req.Path); os.IsNotExist(err) {
		errorJSON(w, "File not found", req.Path, http.StatusNotFound)
		return
	}

	state.loaded = true
	state.filename = filepath.Base(req.Path)
	state.filepath = req.Path

	handleInfo(w, r)
}

func handleInfo(w http.ResponseWriter, r *http.Request) {
	if !state.loaded {
		errorJSON(w, "No ZIM file loaded", "", http.StatusBadRequest)
		return
	}

	var fileSize int64
	if info, err := os.Stat(state.filepath); err == nil {
		fileSize = info.Size()
	}

	namespaces := make(map[string]int)
	for _, a := range state.mockArticles {
		namespaces[a.Namespace]++
	}

	jsonResponse(w, ZIMInfo{
		Filename:   state.filename,
		FileSize:   fileSize,
		Header:     state.mockHeader,
		MimeTypes:  state.mockMimeTypes,
		Namespaces: namespaces,
	}, http.StatusOK)
}

func handleHeader(w http.ResponseWriter, r *http.Request) {
	if !state.loaded {
		errorJSON(w, "No ZIM file loaded", "", http.StatusBadRequest)
		return
	}
	jsonResponse(w, state.mockHeader, http.StatusOK)
}

func handleMimeTypes(w http.ResponseWriter, r *http.Request) {
	if !state.loaded {
		errorJSON(w, "No ZIM file loaded", "", http.StatusBadRequest)
		return
	}
	jsonResponse(w, state.mockMimeTypes, http.StatusOK)
}

func handleArticles(w http.ResponseWriter, r *http.Request) {
	if !state.loaded {
		errorJSON(w, "No ZIM file loaded", "", http.StatusBadRequest)
		return
	}

	namespace := r.URL.Query().Get("namespace")
	// limit and offset could be parsed here

	results := []ArticleEntry{}
	for _, a := range state.mockArticles {
		if namespace == "" || a.Namespace == namespace {
			results = append(results, a)
		}
	}

	jsonResponse(w, results, http.StatusOK)
}

func handleRedirects(w http.ResponseWriter, r *http.Request) {
	if !state.loaded {
		errorJSON(w, "No ZIM file loaded", "", http.StatusBadRequest)
		return
	}
	jsonResponse(w, state.mockRedirects, http.StatusOK)
}

func handleArticle(w http.ResponseWriter, r *http.Request) {
	if !state.loaded {
		errorJSON(w, "No ZIM file loaded", "", http.StatusBadRequest)
		return
	}

	// Parse namespace and path from URL
	path := strings.TrimPrefix(r.URL.Path, "/zim/article/")
	parts := strings.SplitN(path, "/", 2)
	if len(parts) < 2 {
		errorJSON(w, "Invalid path", "", http.StatusBadRequest)
		return
	}

	namespace := parts[0]
	articleURL := parts[1]

	// Find article
	var found *ArticleEntry
	for _, a := range state.mockArticles {
		if a.Namespace == namespace && a.URL == articleURL {
			found = &a
			break
		}
	}

	if found == nil {
		errorJSON(w, "Article not found", path, http.StatusNotFound)
		return
	}

	// Mock content
	content := fmt.Sprintf("<html><body><h1>%s</h1><p>Content for %s</p></body></html>", found.Title, found.URL)
	mimeType := "text/html"
	if found.MimetypeIndex < len(state.mockMimeTypes) {
		mimeType = state.mockMimeTypes[found.MimetypeIndex]
	}

	// Check for raw parameter
	if r.URL.Query().Get("raw") == "true" {
		w.Header().Set("Content-Type", mimeType)
		fmt.Fprint(w, content)
		return
	}

	var encoding string
	var contentStr string
	if strings.Contains(mimeType, "text") {
		contentStr = content
		encoding = "utf-8"
	} else {
		contentStr = base64.StdEncoding.EncodeToString([]byte(content))
		encoding = "base64"
	}

	jsonResponse(w, ArticleContent{
		URL:           found.URL,
		Title:         found.Title,
		Namespace:     found.Namespace,
		Content:       contentStr,
		ContentType:   mimeType,
		ContentLength: len(content),
		Encoding:      encoding,
	}, http.StatusOK)
}

func handleMainPage(w http.ResponseWriter, r *http.Request) {
	if !state.loaded {
		errorJSON(w, "No ZIM file loaded", "", http.StatusBadRequest)
		return
	}

	mainPage := state.mockArticles[0]
	content := fmt.Sprintf("<html><body><h1>%s</h1><p>Main page content</p></body></html>", mainPage.Title)

	jsonResponse(w, ArticleContent{
		URL:           mainPage.URL,
		Title:         mainPage.Title,
		Namespace:     mainPage.Namespace,
		Content:       content,
		ContentType:   "text/html",
		ContentLength: len(content),
		Encoding:      "utf-8",
	}, http.StatusOK)
}

func handleSearch(w http.ResponseWriter, r *http.Request) {
	if !state.loaded {
		errorJSON(w, "No ZIM file loaded", "", http.StatusBadRequest)
		return
	}

	query := strings.ToLower(r.URL.Query().Get("q"))
	if query == "" {
		errorJSON(w, "Query parameter q is required", "", http.StatusBadRequest)
		return
	}

	namespace := r.URL.Query().Get("namespace")

	results := []ArticleEntry{}
	for _, a := range state.mockArticles {
		if namespace != "" && a.Namespace != namespace {
			continue
		}
		if strings.Contains(strings.ToLower(a.URL), query) ||
			strings.Contains(strings.ToLower(a.Title), query) {
			results = append(results, a)
		}
	}

	jsonResponse(w, SearchResult{
		Total:   len(results),
		Results: results,
	}, http.StatusOK)
}

func handleCreate(w http.ResponseWriter, r *http.Request) {
	var req CreateZIMRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errorJSON(w, "Invalid request body", err.Error(), http.StatusBadRequest)
		return
	}

	if req.Filename == "" || len(req.Articles) == 0 {
		errorJSON(w, "filename and articles are required", "", http.StatusBadRequest)
		return
	}

	outputPath := filepath.Join(uploadDir, req.Filename)
	os.MkdirAll(uploadDir, 0755)

	// In production, use actual zimlib.Writer
	// For demo, create placeholder file
	f, err := os.Create(outputPath)
	if err != nil {
		errorJSON(w, "Failed to create file", err.Error(), http.StatusInternalServerError)
		return
	}
	f.Write([]byte{0x5A, 0x5A, 0x49, 0x4D}) // Magic number
	f.Close()

	jsonResponse(w, map[string]interface{}{
		"success":       true,
		"filename":      req.Filename,
		"path":          outputPath,
		"fileSize":      4,
		"articlesCount": len(req.Articles),
	}, http.StatusOK)
}

func handleDownload(w http.ResponseWriter, r *http.Request) {
	filename := strings.TrimPrefix(r.URL.Path, "/zim/download/")
	filePath := filepath.Join(uploadDir, filename)

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		errorJSON(w, "File not found", "", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	w.Header().Set("Content-Type", "application/octet-stream")
	http.ServeFile(w, r, filePath)
}

// =============================================================================
// Router
// =============================================================================

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

func main() {
	// Create upload directory
	os.MkdirAll(uploadDir, 0755)

	// Set up routes
	http.HandleFunc("/", corsMiddleware(handleWelcome))
	http.HandleFunc("/swagger", corsMiddleware(handleSwagger))
	http.HandleFunc("/openapi.json", corsMiddleware(handleOpenAPI))
	http.HandleFunc("/status", corsMiddleware(handleStatus))
	http.HandleFunc("/zim/upload", corsMiddleware(handleUpload))
	http.HandleFunc("/zim/load", corsMiddleware(handleLoad))
	http.HandleFunc("/zim/info", corsMiddleware(handleInfo))
	http.HandleFunc("/zim/header", corsMiddleware(handleHeader))
	http.HandleFunc("/zim/mime-types", corsMiddleware(handleMimeTypes))
	http.HandleFunc("/zim/articles", corsMiddleware(handleArticles))
	http.HandleFunc("/zim/redirects", corsMiddleware(handleRedirects))
	http.HandleFunc("/zim/main-page", corsMiddleware(handleMainPage))
	http.HandleFunc("/zim/search", corsMiddleware(handleSearch))
	http.HandleFunc("/zim/create", corsMiddleware(handleCreate))
	http.HandleFunc("/zim/article/", corsMiddleware(handleArticle))
	http.HandleFunc("/zim/download/", corsMiddleware(handleDownload))

	fmt.Println(`
🗂️  ZIM Library API Server (Go)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Server:     http://localhost:8080
  Swagger UI: http://localhost:8080/swagger
  OpenAPI:    http://localhost:8080/openapi.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	`)

	http.ListenAndServe(":8080", nil)
}

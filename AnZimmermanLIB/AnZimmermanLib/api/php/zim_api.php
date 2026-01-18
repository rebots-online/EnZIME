<?php

/*
 * Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
 * All rights reserved.
 * Unauthorized use without prior written consent is strictly prohibited.
 */

/**
 * ZIM Library REST API with Slim Framework and Swagger UI
 * 
 * This module provides a RESTful API for ZIM file operations with
 * automatic OpenAPI documentation and interactive testing.
 * 
 * Run: php -S localhost:8080 zim_api.php
 * Swagger UI: http://localhost:8080/docs
 * OpenAPI JSON: http://localhost:8080/openapi.json
 * 
 * Requirements:
 *   composer require slim/slim slim/psr7 swagger-api/swagger-ui
 */

// For standalone use without Composer, we'll use a simple router
// In production, use Slim Framework with proper Swagger integration

require_once __DIR__ . '/../../zimlib.php';

// =============================================================================
// Configuration
// =============================================================================

define('API_VERSION', '1.0.0');
define('UPLOAD_DIR', sys_get_temp_dir() . '/zim_uploads/');

if (!is_dir(UPLOAD_DIR)) {
    mkdir(UPLOAD_DIR, 0755, true);
}

// Global state
$GLOBALS['zim_state'] = [
    'reader' => null,
    'filename' => null,
    'filepath' => null
];

// =============================================================================
// OpenAPI Specification
// =============================================================================

function getOpenAPISpec() {
    return [
        'openapi' => '3.0.0',
        'info' => [
            'title' => 'ZIM Library API',
            'version' => API_VERSION,
            'description' => '
## ZIM File Format REST API (PHP)

This API provides RESTful access to ZIM (Zeno IMproved) file operations.

### Features
- 📖 **Read** ZIM files and extract content
- ✏️ **Write** new ZIM files with articles
- 🔍 **Search** articles by title/URL
- 📊 **Analyze** ZIM file structure and metadata

### Namespaces
| Code | Description |
|------|-------------|
| A | Main articles |
| I | Images |
| M | Metadata |
| - | Raw data |
| S | CSS stylesheets |
| J | JavaScript |

### Interactive Testing
Use the Swagger UI to test endpoints interactively.
            ',
            'contact' => [
                'name' => 'ZIM Library',
                'url' => 'https://github.com/yourproject/zimlib'
            ],
            'license' => [
                'name' => 'Proprietary',
                'url' => 'https://opensource.org/licenses/Proprietary'
            ]
        ],
        'servers' => [
            ['url' => 'http://localhost:8080', 'description' => 'Development server']
        ],
        'tags' => [
            ['name' => 'status', 'description' => 'API status and health checks'],
            ['name' => 'read', 'description' => 'Read ZIM file contents'],
            ['name' => 'write', 'description' => 'Create and modify ZIM files'],
            ['name' => 'search', 'description' => 'Search ZIM file contents'],
            ['name' => 'export', 'description' => 'Export ZIM content']
        ],
        'paths' => [
            '/status' => [
                'get' => [
                    'tags' => ['status'],
                    'summary' => 'API Status',
                    'description' => 'Check API status and currently loaded ZIM file',
                    'responses' => [
                        '200' => [
                            'description' => 'API status',
                            'content' => [
                                'application/json' => [
                                    'schema' => [
                                        'type' => 'object',
                                        'properties' => [
                                            'status' => ['type' => 'string', 'example' => 'ok'],
                                            'version' => ['type' => 'string', 'example' => '1.0.0'],
                                            'loadedZim' => ['type' => 'string', 'nullable' => true],
                                            'timestamp' => ['type' => 'string', 'format' => 'date-time']
                                        ]
                                    ]
                                ]
                            ]
                        ]
                    ]
                ]
            ],
            '/zim/upload' => [
                'post' => [
                    'tags' => ['read'],
                    'summary' => 'Upload ZIM File',
                    'description' => 'Upload a ZIM file for processing',
                    'requestBody' => [
                        'required' => true,
                        'content' => [
                            'multipart/form-data' => [
                                'schema' => [
                                    'type' => 'object',
                                    'properties' => [
                                        'file' => [
                                            'type' => 'string',
                                            'format' => 'binary',
                                            'description' => 'ZIM file to upload'
                                        ]
                                    ]
                                ]
                            ]
                        ]
                    ],
                    'responses' => [
                        '200' => ['description' => 'ZIM file loaded'],
                        '400' => ['description' => 'Invalid file']
                    ]
                ]
            ],
            '/zim/info' => [
                'get' => [
                    'tags' => ['read'],
                    'summary' => 'Get ZIM Info',
                    'description' => 'Get detailed information about loaded ZIM file',
                    'responses' => [
                        '200' => ['description' => 'ZIM file information'],
                        '400' => ['description' => 'No ZIM file loaded']
                    ]
                ]
            ],
            '/zim/header' => [
                'get' => [
                    'tags' => ['read'],
                    'summary' => 'Get ZIM Header',
                    'description' => 'Get the ZIM file header information',
                    'responses' => [
                        '200' => ['description' => 'Header information']
                    ]
                ]
            ],
            '/zim/articles' => [
                'get' => [
                    'tags' => ['read'],
                    'summary' => 'List Articles',
                    'description' => 'List all articles with optional filtering',
                    'parameters' => [
                        ['name' => 'namespace', 'in' => 'query', 'schema' => ['type' => 'string']],
                        ['name' => 'limit', 'in' => 'query', 'schema' => ['type' => 'integer', 'default' => 100]],
                        ['name' => 'offset', 'in' => 'query', 'schema' => ['type' => 'integer', 'default' => 0]]
                    ],
                    'responses' => [
                        '200' => ['description' => 'List of articles']
                    ]
                ]
            ],
            '/zim/article/{namespace}/{path}' => [
                'get' => [
                    'tags' => ['read'],
                    'summary' => 'Get Article Content',
                    'description' => 'Retrieve content of a specific article',
                    'parameters' => [
                        ['name' => 'namespace', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'string']],
                        ['name' => 'path', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'string']],
                        ['name' => 'raw', 'in' => 'query', 'schema' => ['type' => 'boolean', 'default' => false]]
                    ],
                    'responses' => [
                        '200' => ['description' => 'Article content'],
                        '404' => ['description' => 'Article not found']
                    ]
                ]
            ],
            '/zim/search' => [
                'get' => [
                    'tags' => ['search'],
                    'summary' => 'Search Articles',
                    'description' => 'Search articles by title or URL',
                    'parameters' => [
                        ['name' => 'q', 'in' => 'query', 'required' => true, 'schema' => ['type' => 'string']],
                        ['name' => 'namespace', 'in' => 'query', 'schema' => ['type' => 'string']],
                        ['name' => 'limit', 'in' => 'query', 'schema' => ['type' => 'integer', 'default' => 20]]
                    ],
                    'responses' => [
                        '200' => ['description' => 'Search results']
                    ]
                ]
            ],
            '/zim/create' => [
                'post' => [
                    'tags' => ['write'],
                    'summary' => 'Create ZIM File',
                    'description' => 'Create a new ZIM file',
                    'requestBody' => [
                        'required' => true,
                        'content' => [
                            'application/json' => [
                                'schema' => [
                                    'type' => 'object',
                                    'required' => ['filename', 'articles'],
                                    'properties' => [
                                        'filename' => ['type' => 'string'],
                                        'articles' => ['type' => 'array', 'items' => ['type' => 'object']],
                                        'mainPageUrl' => ['type' => 'string']
                                    ]
                                ]
                            ]
                        ]
                    ],
                    'responses' => [
                        '200' => ['description' => 'ZIM file created']
                    ]
                ]
            ]
        ],
        'components' => [
            'schemas' => [
                'ZIMHeader' => [
                    'type' => 'object',
                    'properties' => [
                        'magicNumber' => ['type' => 'string'],
                        'majorVersion' => ['type' => 'integer'],
                        'minorVersion' => ['type' => 'integer'],
                        'entryCount' => ['type' => 'integer'],
                        'articleCount' => ['type' => 'integer'],
                        'clusterCount' => ['type' => 'integer'],
                        'redirectCount' => ['type' => 'integer'],
                        'mainPageIndex' => ['type' => 'integer']
                    ]
                ],
                'ArticleEntry' => [
                    'type' => 'object',
                    'properties' => [
                        'index' => ['type' => 'integer'],
                        'namespace' => ['type' => 'string'],
                        'url' => ['type' => 'string'],
                        'title' => ['type' => 'string'],
                        'entryType' => ['type' => 'string']
                    ]
                ]
            ]
        ]
    ];
}

// =============================================================================
// Helper Functions
// =============================================================================

function jsonResponse($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    echo json_encode($data, JSON_PRETTY_PRINT);
    exit;
}

function errorResponse($message, $detail = null, $status = 400) {
    $response = ['error' => $message];
    if ($detail) $response['detail'] = $detail;
    jsonResponse($response, $status);
}

function getZIMInfo() {
    global $GLOBALS;
    $state = $GLOBALS['zim_state'];
    
    if (!$state['reader']) {
        errorResponse('No ZIM file loaded');
    }
    
    $reader = $state['reader'];
    $header = $reader->getHeader();
    
    // Count namespaces
    $namespaces = [];
    foreach ($reader->listArticles() as $entry) {
        $ns = chr($entry->namespace);
        if (!isset($namespaces[$ns])) $namespaces[$ns] = 0;
        $namespaces[$ns]++;
    }
    
    $fileSize = 0;
    if ($state['filepath'] && file_exists($state['filepath'])) {
        $fileSize = filesize($state['filepath']);
    }
    
    return [
        'filename' => $state['filename'],
        'fileSize' => $fileSize,
        'header' => [
            'magicNumber' => sprintf('0x%08X', $header->magicNumber),
            'majorVersion' => $header->majorVersion,
            'minorVersion' => $header->minorVersion,
            'entryCount' => $header->entryCount,
            'articleCount' => $header->articleCount,
            'clusterCount' => $header->clusterCount,
            'redirectCount' => $header->redirectCount,
            'mainPageIndex' => $header->mainPageIndex
        ],
        'mimeTypes' => $reader->getMimeTypes(),
        'namespaces' => $namespaces
    ];
}

// =============================================================================
// Router
// =============================================================================

function handleRequest() {
    $method = $_SERVER['REQUEST_METHOD'];
    $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $query = $_GET;
    
    // Handle CORS preflight
    if ($method === 'OPTIONS') {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        exit;
    }
    
    // Route matching
    switch (true) {
        // Welcome page
        case $uri === '/' && $method === 'GET':
            handleWelcome();
            break;
        
        // Swagger UI
        case $uri === '/docs' && $method === 'GET':
            handleSwaggerUI();
            break;
        
        // OpenAPI JSON
        case $uri === '/openapi.json' && $method === 'GET':
            jsonResponse(getOpenAPISpec());
            break;
        
        // Status
        case $uri === '/status' && $method === 'GET':
            handleStatus();
            break;
        
        // Upload ZIM
        case $uri === '/zim/upload' && $method === 'POST':
            handleUpload();
            break;
        
        // Load ZIM
        case $uri === '/zim/load' && $method === 'POST':
            handleLoad();
            break;
        
        // Get ZIM info
        case $uri === '/zim/info' && $method === 'GET':
            jsonResponse(getZIMInfo());
            break;
        
        // Get header
        case $uri === '/zim/header' && $method === 'GET':
            handleHeader();
            break;
        
        // Get MIME types
        case $uri === '/zim/mime-types' && $method === 'GET':
            handleMimeTypes();
            break;
        
        // List articles
        case $uri === '/zim/articles' && $method === 'GET':
            handleListArticles();
            break;
        
        // List redirects
        case $uri === '/zim/redirects' && $method === 'GET':
            handleListRedirects();
            break;
        
        // Get main page
        case $uri === '/zim/main-page' && $method === 'GET':
            handleMainPage();
            break;
        
        // Search
        case $uri === '/zim/search' && $method === 'GET':
            handleSearch();
            break;
        
        // Create ZIM
        case $uri === '/zim/create' && $method === 'POST':
            handleCreate();
            break;
        
        // Get article (must be last due to pattern matching)
        case preg_match('#^/zim/article/([^/]+)/(.+)$#', $uri, $matches) && $method === 'GET':
            handleGetArticle($matches[1], $matches[2]);
            break;
        
        // Download
        case preg_match('#^/zim/download/(.+)$#', $uri, $matches) && $method === 'GET':
            handleDownload($matches[1]);
            break;
        
        default:
            errorResponse('Not found', "Route not found: $method $uri", 404);
    }
}

// =============================================================================
// Route Handlers
// =============================================================================

function handleWelcome() {
    header('Content-Type: text/html');
    echo <<<HTML
<!DOCTYPE html>
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
    <h1>🗂️ ZIM Library REST API (PHP)</h1>
    <p>Welcome to the ZIM file format REST API with Swagger documentation.</p>
    <div class="links">
        <a href="/docs">📚 Swagger UI</a>
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
</html>
HTML;
    exit;
}

function handleSwaggerUI() {
    header('Content-Type: text/html');
    echo <<<HTML
<!DOCTYPE html>
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
</html>
HTML;
    exit;
}

function handleStatus() {
    global $GLOBALS;
    jsonResponse([
        'status' => 'ok',
        'version' => API_VERSION,
        'loadedZim' => $GLOBALS['zim_state']['filename'],
        'timestamp' => date('c')
    ]);
}

function handleUpload() {
    global $GLOBALS;
    
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        errorResponse('No file uploaded or upload error');
    }
    
    $file = $_FILES['file'];
    if (!str_ends_with($file['name'], '.zim')) {
        errorResponse('File must have .zim extension');
    }
    
    $targetPath = UPLOAD_DIR . basename($file['name']);
    
    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        errorResponse('Failed to save uploaded file', null, 500);
    }
    
    try {
        if ($GLOBALS['zim_state']['reader']) {
            $GLOBALS['zim_state']['reader']->close();
        }
        
        $reader = new ZIMReader($targetPath);
        $reader->open();
        
        $GLOBALS['zim_state']['reader'] = $reader;
        $GLOBALS['zim_state']['filename'] = $file['name'];
        $GLOBALS['zim_state']['filepath'] = $targetPath;
        
        jsonResponse(getZIMInfo());
    } catch (Exception $e) {
        errorResponse('Invalid ZIM file', $e->getMessage());
    }
}

function handleLoad() {
    global $GLOBALS;
    
    $input = json_decode(file_get_contents('php://input'), true);
    $path = $input['path'] ?? null;
    
    if (!$path) {
        errorResponse('Path is required');
    }
    
    if (!file_exists($path)) {
        errorResponse('File not found', $path, 404);
    }
    
    try {
        if ($GLOBALS['zim_state']['reader']) {
            $GLOBALS['zim_state']['reader']->close();
        }
        
        $reader = new ZIMReader($path);
        $reader->open();
        
        $GLOBALS['zim_state']['reader'] = $reader;
        $GLOBALS['zim_state']['filename'] = basename($path);
        $GLOBALS['zim_state']['filepath'] = $path;
        
        jsonResponse(getZIMInfo());
    } catch (Exception $e) {
        errorResponse('Invalid ZIM file', $e->getMessage());
    }
}

function handleHeader() {
    global $GLOBALS;
    $state = $GLOBALS['zim_state'];
    
    if (!$state['reader']) {
        errorResponse('No ZIM file loaded');
    }
    
    $header = $state['reader']->getHeader();
    jsonResponse([
        'magicNumber' => sprintf('0x%08X', $header->magicNumber),
        'majorVersion' => $header->majorVersion,
        'minorVersion' => $header->minorVersion,
        'entryCount' => $header->entryCount,
        'articleCount' => $header->articleCount,
        'clusterCount' => $header->clusterCount,
        'redirectCount' => $header->redirectCount,
        'mainPageIndex' => $header->mainPageIndex
    ]);
}

function handleMimeTypes() {
    global $GLOBALS;
    $state = $GLOBALS['zim_state'];
    
    if (!$state['reader']) {
        errorResponse('No ZIM file loaded');
    }
    
    jsonResponse($state['reader']->getMimeTypes());
}

function handleListArticles() {
    global $GLOBALS;
    $state = $GLOBALS['zim_state'];
    
    if (!$state['reader']) {
        errorResponse('No ZIM file loaded');
    }
    
    $namespace = $_GET['namespace'] ?? null;
    $limit = min((int)($_GET['limit'] ?? 100), 1000);
    $offset = (int)($_GET['offset'] ?? 0);
    
    $articles = $state['reader']->listArticles();
    $results = [];
    $count = 0;
    
    foreach ($articles as $i => $entry) {
        $ns = chr($entry->namespace);
        
        if ($namespace && $ns !== $namespace) continue;
        
        if ($count < $offset) {
            $count++;
            continue;
        }
        
        if (count($results) >= $limit) break;
        
        $results[] = [
            'index' => $i,
            'namespace' => $ns,
            'url' => $entry->url,
            'title' => $entry->title,
            'mimetypeIndex' => $entry->mimetypeIndex,
            'clusterNumber' => $entry->clusterNumber,
            'blobNumber' => $entry->blobNumber,
            'entryType' => 'article'
        ];
        $count++;
    }
    
    jsonResponse($results);
}

function handleListRedirects() {
    global $GLOBALS;
    $state = $GLOBALS['zim_state'];
    
    if (!$state['reader']) {
        errorResponse('No ZIM file loaded');
    }
    
    $limit = min((int)($_GET['limit'] ?? 100), 1000);
    $offset = (int)($_GET['offset'] ?? 0);
    
    $results = [];
    $count = 0;
    
    foreach ($state['reader']->directory_entries as $i => $entry) {
        if ($entry instanceof ZIMRedirectEntry) {
            if ($count < $offset) {
                $count++;
                continue;
            }
            
            if (count($results) >= $limit) break;
            
            $results[] = [
                'index' => $i,
                'namespace' => chr($entry->namespace),
                'url' => $entry->url,
                'title' => $entry->title,
                'redirectIndex' => $entry->redirectIndex,
                'entryType' => 'redirect'
            ];
            $count++;
        }
    }
    
    jsonResponse($results);
}

function handleGetArticle($namespace, $path) {
    global $GLOBALS;
    $state = $GLOBALS['zim_state'];
    
    if (!$state['reader']) {
        errorResponse('No ZIM file loaded');
    }
    
    $fullPath = "$namespace/$path";
    $entry = $state['reader']->getEntryByPath($fullPath);
    
    if (!$entry) {
        errorResponse('Article not found', $fullPath, 404);
    }
    
    // Handle redirect
    if ($entry instanceof ZIMRedirectEntry) {
        $entries = $state['reader']->directory_entries;
        if ($entry->redirectIndex < count($entries)) {
            $entry = $entries[$entry->redirectIndex];
        } else {
            errorResponse('Redirect target not found', null, 404);
        }
    }
    
    if (!($entry instanceof ZIMDirectoryEntry)) {
        errorResponse('Entry is not an article');
    }
    
    try {
        $content = $state['reader']->getArticleContent($entry);
    } catch (Exception $e) {
        errorResponse('Error reading content', $e->getMessage(), 500);
    }
    
    $mimeTypes = $state['reader']->getMimeTypes();
    $mimeType = $mimeTypes[$entry->mimetypeIndex] ?? 'application/octet-stream';
    
    // Return raw if requested
    if (isset($_GET['raw']) && $_GET['raw'] === 'true') {
        header("Content-Type: $mimeType");
        echo $content;
        exit;
    }
    
    // Encode content
    $isText = strpos($mimeType, 'text') !== false || 
              strpos($mimeType, 'json') !== false ||
              strpos($mimeType, 'xml') !== false;
    
    if ($isText) {
        $contentStr = $content;
        $encoding = 'utf-8';
    } else {
        $contentStr = base64_encode($content);
        $encoding = 'base64';
    }
    
    jsonResponse([
        'url' => $entry->url,
        'title' => $entry->title,
        'namespace' => chr($entry->namespace),
        'content' => $contentStr,
        'contentType' => $mimeType,
        'contentLength' => strlen($content),
        'encoding' => $encoding
    ]);
}

function handleMainPage() {
    global $GLOBALS;
    $state = $GLOBALS['zim_state'];
    
    if (!$state['reader']) {
        errorResponse('No ZIM file loaded');
    }
    
    $mainPage = $state['reader']->getMainPage();
    if (!$mainPage) {
        errorResponse('No main page defined', null, 404);
    }
    
    if (!($mainPage instanceof ZIMDirectoryEntry)) {
        errorResponse('Main page is a redirect', null, 404);
    }
    
    $content = $state['reader']->getArticleContent($mainPage);
    $mimeTypes = $state['reader']->getMimeTypes();
    
    jsonResponse([
        'url' => $mainPage->url,
        'title' => $mainPage->title,
        'namespace' => chr($mainPage->namespace),
        'content' => $content,
        'contentType' => $mimeTypes[$mainPage->mimetypeIndex] ?? 'text/html',
        'contentLength' => strlen($content),
        'encoding' => 'utf-8'
    ]);
}

function handleSearch() {
    global $GLOBALS;
    $state = $GLOBALS['zim_state'];
    
    if (!$state['reader']) {
        errorResponse('No ZIM file loaded');
    }
    
    $query = $_GET['q'] ?? '';
    if (!$query) {
        errorResponse('Query parameter q is required');
    }
    
    $namespace = $_GET['namespace'] ?? null;
    $limit = min((int)($_GET['limit'] ?? 20), 100);
    
    $queryLower = strtolower($query);
    $results = [];
    
    foreach ($state['reader']->listArticles() as $i => $entry) {
        $ns = chr($entry->namespace);
        
        if ($namespace && $ns !== $namespace) continue;
        
        if (stripos($entry->url, $queryLower) !== false ||
            stripos($entry->title, $queryLower) !== false) {
            
            $results[] = [
                'index' => $i,
                'namespace' => $ns,
                'url' => $entry->url,
                'title' => $entry->title,
                'mimetypeIndex' => $entry->mimetypeIndex,
                'clusterNumber' => $entry->clusterNumber,
                'blobNumber' => $entry->blobNumber,
                'entryType' => 'article'
            ];
            
            if (count($results) >= $limit) break;
        }
    }
    
    jsonResponse([
        'total' => count($results),
        'results' => $results
    ]);
}

function handleCreate() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['filename']) || !isset($input['articles'])) {
        errorResponse('filename and articles are required');
    }
    
    $outputPath = UPLOAD_DIR . $input['filename'];
    
    try {
        $writer = new ZIMWriter($outputPath);
        $writer->create();
        
        foreach ($input['articles'] as $i => $article) {
            $ns = ord($article['namespace'] ?? 'A');
            $writer->addArticle(
                $ns,
                $article['url'],
                $article['title'],
                $article['content'],
                $article['mimeType'] ?? 'text/html'
            );
        }
        
        if (isset($input['mainPageUrl'])) {
            foreach ($input['articles'] as $i => $article) {
                if ($article['url'] === $input['mainPageUrl']) {
                    $writer->main_page_index = $i;
                    break;
                }
            }
        }
        
        $writer->finalize();
        $writer->close();
        
        jsonResponse([
            'success' => true,
            'filename' => $input['filename'],
            'path' => $outputPath,
            'fileSize' => filesize($outputPath),
            'articlesCount' => count($input['articles'])
        ]);
        
    } catch (Exception $e) {
        errorResponse('Error creating ZIM file', $e->getMessage(), 500);
    }
}

function handleDownload($filename) {
    $filePath = UPLOAD_DIR . $filename;
    
    if (!file_exists($filePath)) {
        errorResponse('File not found', null, 404);
    }
    
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . filesize($filePath));
    readfile($filePath);
    exit;
}

// =============================================================================
// Run
// =============================================================================

handleRequest();

?>

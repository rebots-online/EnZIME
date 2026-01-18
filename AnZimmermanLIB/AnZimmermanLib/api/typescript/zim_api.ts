// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

/**
 * ZIM Library REST API with Express and Swagger UI
 * 
 * This module provides a RESTful API for ZIM file operations with
 * automatic Swagger/OpenAPI documentation and interactive testing.
 * 
 * Run: npx ts-node zim_api.ts
 * Or: npm start
 * 
 * Swagger UI: http://localhost:3000/api-docs
 * OpenAPI JSON: http://localhost:3000/api-docs.json
 */

import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

// Import ZIM library (adjust path as needed)
// import { ZIMReader, ZIMWriter, DirectoryEntry, RedirectEntry, Namespace } from '../../zimlib';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File upload configuration
const upload = multer({ 
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
        if (file.originalname.endsWith('.zim')) {
            cb(null, true);
        } else {
            cb(new Error('Only .zim files are allowed'));
        }
    }
});

// =============================================================================
// Swagger Configuration
// =============================================================================

const swaggerOptions: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'ZIM Library API',
            version: '1.0.0',
            description: `
## ZIM File Format REST API (TypeScript/Node.js)

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
Click **Try it out** on any endpoint to test interactively.
            `,
            contact: {
                name: 'ZIM Library',
                url: 'https://github.com/yourproject/zimlib'
            },
            license: {
                name: 'Proprietary',
                url: 'https://opensource.org/licenses/Proprietary'
            }
        },
        servers: [
            {
                url: `http://localhost:${PORT}`,
                description: 'Development server'
            }
        ],
        tags: [
            { name: 'status', description: 'API status and health checks' },
            { name: 'read', description: 'Read ZIM file contents' },
            { name: 'write', description: 'Create and modify ZIM files' },
            { name: 'search', description: 'Search ZIM file contents' },
            { name: 'export', description: 'Export ZIM content' }
        ],
        components: {
            schemas: {
                ZIMHeader: {
                    type: 'object',
                    properties: {
                        magicNumber: { type: 'string', example: '0x4D495A5A' },
                        majorVersion: { type: 'integer', example: 4 },
                        minorVersion: { type: 'integer', example: 0 },
                        entryCount: { type: 'integer', example: 150 },
                        articleCount: { type: 'integer', example: 100 },
                        clusterCount: { type: 'integer', example: 50 },
                        redirectCount: { type: 'integer', example: 20 },
                        mainPageIndex: { type: 'integer', example: 0 }
                    }
                },
                ArticleEntry: {
                    type: 'object',
                    properties: {
                        index: { type: 'integer', description: 'Entry index' },
                        namespace: { type: 'string', example: 'A' },
                        url: { type: 'string', example: 'Main_Page' },
                        title: { type: 'string', example: 'Welcome' },
                        mimetypeIndex: { type: 'integer' },
                        clusterNumber: { type: 'integer' },
                        blobNumber: { type: 'integer' },
                        entryType: { type: 'string', enum: ['article', 'redirect'] }
                    }
                },
                ArticleContent: {
                    type: 'object',
                    properties: {
                        url: { type: 'string' },
                        title: { type: 'string' },
                        namespace: { type: 'string' },
                        content: { type: 'string' },
                        contentType: { type: 'string' },
                        contentLength: { type: 'integer' },
                        encoding: { type: 'string', enum: ['utf-8', 'base64'] }
                    }
                },
                CreateArticle: {
                    type: 'object',
                    required: ['url', 'title', 'content'],
                    properties: {
                        namespace: { type: 'string', default: 'A' },
                        url: { type: 'string', example: 'New_Article' },
                        title: { type: 'string', example: 'New Article' },
                        content: { type: 'string', example: '<html><body>Hello</body></html>' },
                        mimeType: { type: 'string', default: 'text/html' }
                    }
                },
                CreateZIMRequest: {
                    type: 'object',
                    required: ['filename', 'articles'],
                    properties: {
                        filename: { type: 'string', example: 'my_wiki.zim' },
                        articles: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/CreateArticle' }
                        },
                        mainPageUrl: { type: 'string', example: 'Main_Page' }
                    }
                },
                SearchResult: {
                    type: 'object',
                    properties: {
                        total: { type: 'integer' },
                        results: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/ArticleEntry' }
                        }
                    }
                },
                ZIMInfo: {
                    type: 'object',
                    properties: {
                        filename: { type: 'string' },
                        fileSize: { type: 'integer' },
                        header: { $ref: '#/components/schemas/ZIMHeader' },
                        mimeTypes: { type: 'array', items: { type: 'string' } },
                        namespaces: { type: 'object', additionalProperties: { type: 'integer' } }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                        detail: { type: 'string' }
                    }
                }
            },
            parameters: {
                namespace: {
                    name: 'namespace',
                    in: 'path',
                    required: true,
                    schema: { type: 'string', enum: ['A', 'I', 'M', '-', 'S', 'J', 'T'] },
                    description: 'Article namespace'
                },
                limit: {
                    name: 'limit',
                    in: 'query',
                    schema: { type: 'integer', default: 100, minimum: 1, maximum: 1000 },
                    description: 'Maximum results'
                },
                offset: {
                    name: 'offset',
                    in: 'query',
                    schema: { type: 'integer', default: 0, minimum: 0 },
                    description: 'Pagination offset'
                }
            }
        }
    },
    apis: ['./zim_api.ts']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'ZIM Library API - Swagger UI'
}));

// OpenAPI JSON endpoint
app.get('/api-docs.json', (req: Request, res: Response) => {
    res.json(swaggerSpec);
});

// =============================================================================
// State Management
// =============================================================================

interface ZIMState {
    reader: any | null;
    filename: string | null;
    filePath: string | null;
}

const state: ZIMState = {
    reader: null,
    filename: null,
    filePath: null
};

// Mock ZIM Reader for demonstration (replace with actual zimlib import)
class MockZIMReader {
    private data: any = {
        header: {
            magicNumber: 0x4D495A5A,
            majorVersion: 4,
            minorVersion: 0,
            entryCount: 5,
            articleCount: 3,
            clusterCount: 2,
            redirectCount: 1,
            mainPageIndex: 0
        },
        mimeTypes: ['text/html', 'text/css', 'application/javascript'],
        entries: [
            { index: 0, namespace: 65, url: 'Main_Page', title: 'Welcome', mimetypeIndex: 0, clusterNumber: 0, blobNumber: 0, type: 'article' },
            { index: 1, namespace: 65, url: 'Article_1', title: 'First Article', mimetypeIndex: 0, clusterNumber: 0, blobNumber: 1, type: 'article' },
            { index: 2, namespace: 83, url: 'style.css', title: 'Stylesheet', mimetypeIndex: 1, clusterNumber: 1, blobNumber: 0, type: 'article' },
            { index: 3, namespace: 65, url: 'Home', title: 'Home', redirectIndex: 0, type: 'redirect' }
        ]
    };

    getHeader() { return this.data.header; }
    getMimeTypes() { return this.data.mimeTypes; }
    listArticles() { return this.data.entries.filter((e: any) => e.type === 'article'); }
    listRedirects() { return this.data.entries.filter((e: any) => e.type === 'redirect'); }
    getEntryByPath(path: string) {
        const [ns, ...urlParts] = path.split('/');
        const url = urlParts.join('/');
        return this.data.entries.find((e: any) => 
            String.fromCharCode(e.namespace) === ns && e.url === url
        );
    }
    getArticleContent(entry: any) {
        return Buffer.from(`<html><body><h1>${entry.title}</h1><p>Content for ${entry.url}</p></body></html>`);
    }
    getMainPage() { return this.data.entries[0]; }
    close() {}
}

// =============================================================================
// API Endpoints - Status
// =============================================================================

/**
 * @swagger
 * /:
 *   get:
 *     tags: [status]
 *     summary: API Welcome Page
 *     description: Returns HTML welcome page with links to documentation
 *     responses:
 *       200:
 *         description: HTML welcome page
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */
app.get('/', (req: Request, res: Response) => {
    res.send(`
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
            <h1>🗂️ ZIM Library REST API (TypeScript)</h1>
            <p>Welcome to the ZIM file format REST API with Swagger documentation.</p>
            <div class="links">
                <a href="/api-docs">📚 Swagger UI</a>
                <a href="/api-docs.json">📄 OpenAPI JSON</a>
            </div>
            <h2>Quick Start</h2>
            <ol>
                <li>Upload a ZIM file: <code>POST /zim/upload</code></li>
                <li>Get file info: <code>GET /zim/info</code></li>
                <li>List articles: <code>GET /zim/articles</code></li>
                <li>Read article: <code>GET /zim/article/:namespace/:path</code></li>
            </ol>
        </body>
        </html>
    `);
});

/**
 * @swagger
 * /status:
 *   get:
 *     tags: [status]
 *     summary: API Status
 *     description: Check API status and currently loaded ZIM file
 *     responses:
 *       200:
 *         description: API status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: 'ok' }
 *                 version: { type: string, example: '1.0.0' }
 *                 loadedZim: { type: string, nullable: true }
 *                 timestamp: { type: string, format: date-time }
 */
app.get('/status', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        version: '1.0.0',
        loadedZim: state.filename,
        timestamp: new Date().toISOString()
    });
});

// =============================================================================
// API Endpoints - Read Operations
// =============================================================================

/**
 * @swagger
 * /zim/upload:
 *   post:
 *     tags: [read]
 *     summary: Upload ZIM File
 *     description: Upload a ZIM file to the server for reading
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: ZIM file to upload
 *     responses:
 *       200:
 *         description: ZIM file loaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ZIMInfo'
 *       400:
 *         description: Invalid file
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post('/zim/upload', upload.single('file'), async (req: Request, res: Response) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        // Close existing reader
        if (state.reader) {
            state.reader.close();
        }

        // In production, use actual ZIMReader:
        // state.reader = new ZIMReader(req.file.path);
        // state.reader.open();
        
        // For demo, use mock reader
        state.reader = new MockZIMReader();
        state.filename = req.file.originalname;
        state.filePath = req.file.path;

        res.json(getZIMInfo());
    } catch (error: any) {
        res.status(400).json({ error: 'Invalid ZIM file', detail: error.message });
    }
});

/**
 * @swagger
 * /zim/load:
 *   post:
 *     tags: [read]
 *     summary: Load ZIM File by Path
 *     description: Load a ZIM file from the server filesystem
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [path]
 *             properties:
 *               path:
 *                 type: string
 *                 description: Path to ZIM file on server
 *                 example: /data/wikipedia.zim
 *     responses:
 *       200:
 *         description: ZIM file loaded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ZIMInfo'
 *       404:
 *         description: File not found
 */
app.post('/zim/load', (req: Request, res: Response) => {
    const { path: filePath } = req.body;

    if (!filePath) {
        return res.status(400).json({ error: 'Path is required' });
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found', detail: filePath });
    }

    try {
        if (state.reader) {
            state.reader.close();
        }

        // In production: state.reader = new ZIMReader(filePath); state.reader.open();
        state.reader = new MockZIMReader();
        state.filename = path.basename(filePath);
        state.filePath = filePath;

        res.json(getZIMInfo());
    } catch (error: any) {
        res.status(400).json({ error: 'Invalid ZIM file', detail: error.message });
    }
});

function getZIMInfo() {
    if (!state.reader) {
        throw new Error('No ZIM file loaded');
    }

    const header = state.reader.getHeader();
    const articles = state.reader.listArticles();
    
    const namespaces: Record<string, number> = {};
    articles.forEach((entry: any) => {
        const ns = String.fromCharCode(entry.namespace);
        namespaces[ns] = (namespaces[ns] || 0) + 1;
    });

    let fileSize = 0;
    if (state.filePath && fs.existsSync(state.filePath)) {
        fileSize = fs.statSync(state.filePath).size;
    }

    return {
        filename: state.filename,
        fileSize,
        header: {
            magicNumber: `0x${header.magicNumber.toString(16).toUpperCase()}`,
            majorVersion: header.majorVersion,
            minorVersion: header.minorVersion,
            entryCount: header.entryCount,
            articleCount: header.articleCount,
            clusterCount: header.clusterCount,
            redirectCount: header.redirectCount,
            mainPageIndex: header.mainPageIndex
        },
        mimeTypes: state.reader.getMimeTypes(),
        namespaces
    };
}

/**
 * @swagger
 * /zim/info:
 *   get:
 *     tags: [read]
 *     summary: Get ZIM Info
 *     description: Get detailed information about the loaded ZIM file
 *     responses:
 *       200:
 *         description: ZIM file information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ZIMInfo'
 *       400:
 *         description: No ZIM file loaded
 */
app.get('/zim/info', (req: Request, res: Response) => {
    if (!state.reader) {
        return res.status(400).json({ error: 'No ZIM file loaded' });
    }
    res.json(getZIMInfo());
});

/**
 * @swagger
 * /zim/header:
 *   get:
 *     tags: [read]
 *     summary: Get ZIM Header
 *     description: Get the ZIM file header information
 *     responses:
 *       200:
 *         description: Header information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ZIMHeader'
 */
app.get('/zim/header', (req: Request, res: Response) => {
    if (!state.reader) {
        return res.status(400).json({ error: 'No ZIM file loaded' });
    }
    const header = state.reader.getHeader();
    res.json({
        magicNumber: `0x${header.magicNumber.toString(16).toUpperCase()}`,
        majorVersion: header.majorVersion,
        minorVersion: header.minorVersion,
        entryCount: header.entryCount,
        articleCount: header.articleCount,
        clusterCount: header.clusterCount,
        redirectCount: header.redirectCount,
        mainPageIndex: header.mainPageIndex
    });
});

/**
 * @swagger
 * /zim/mime-types:
 *   get:
 *     tags: [read]
 *     summary: Get MIME Types
 *     description: List all MIME types used in the ZIM file
 *     responses:
 *       200:
 *         description: List of MIME types
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 */
app.get('/zim/mime-types', (req: Request, res: Response) => {
    if (!state.reader) {
        return res.status(400).json({ error: 'No ZIM file loaded' });
    }
    res.json(state.reader.getMimeTypes());
});

/**
 * @swagger
 * /zim/articles:
 *   get:
 *     tags: [read]
 *     summary: List Articles
 *     description: List all articles in the ZIM file with optional filtering
 *     parameters:
 *       - name: namespace
 *         in: query
 *         schema:
 *           type: string
 *           enum: [A, I, M, '-', S, J, T]
 *         description: Filter by namespace
 *       - $ref: '#/components/parameters/limit'
 *       - $ref: '#/components/parameters/offset'
 *     responses:
 *       200:
 *         description: List of articles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ArticleEntry'
 */
app.get('/zim/articles', (req: Request, res: Response) => {
    if (!state.reader) {
        return res.status(400).json({ error: 'No ZIM file loaded' });
    }

    const namespace = req.query.namespace as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    let articles = state.reader.listArticles();

    if (namespace) {
        articles = articles.filter((a: any) => 
            String.fromCharCode(a.namespace) === namespace
        );
    }

    const results = articles.slice(offset, offset + limit).map((entry: any) => ({
        index: entry.index,
        namespace: String.fromCharCode(entry.namespace),
        url: entry.url,
        title: entry.title,
        mimetypeIndex: entry.mimetypeIndex,
        clusterNumber: entry.clusterNumber,
        blobNumber: entry.blobNumber,
        entryType: 'article'
    }));

    res.json(results);
});

/**
 * @swagger
 * /zim/redirects:
 *   get:
 *     tags: [read]
 *     summary: List Redirects
 *     description: List all redirect entries in the ZIM file
 *     parameters:
 *       - $ref: '#/components/parameters/limit'
 *       - $ref: '#/components/parameters/offset'
 *     responses:
 *       200:
 *         description: List of redirects
 */
app.get('/zim/redirects', (req: Request, res: Response) => {
    if (!state.reader) {
        return res.status(400).json({ error: 'No ZIM file loaded' });
    }

    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const redirects = state.reader.listRedirects().slice(offset, offset + limit);

    res.json(redirects.map((entry: any) => ({
        index: entry.index,
        namespace: String.fromCharCode(entry.namespace),
        url: entry.url,
        title: entry.title,
        redirectIndex: entry.redirectIndex,
        entryType: 'redirect'
    })));
});

/**
 * @swagger
 * /zim/article/{namespace}/{path}:
 *   get:
 *     tags: [read]
 *     summary: Get Article Content
 *     description: Retrieve the content of a specific article
 *     parameters:
 *       - $ref: '#/components/parameters/namespace'
 *       - name: path
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Article URL path
 *       - name: raw
 *         in: query
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Return raw content instead of JSON
 *     responses:
 *       200:
 *         description: Article content
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArticleContent'
 *       404:
 *         description: Article not found
 */
app.get('/zim/article/:namespace/:path(*)', (req: Request, res: Response) => {
    if (!state.reader) {
        return res.status(400).json({ error: 'No ZIM file loaded' });
    }

    const { namespace, path: articlePath } = req.params;
    const raw = req.query.raw === 'true';
    const fullPath = `${namespace}/${articlePath}`;

    const entry = state.reader.getEntryByPath(fullPath);

    if (!entry) {
        return res.status(404).json({ error: 'Article not found', detail: fullPath });
    }

    const content = state.reader.getArticleContent(entry);
    const mimeTypes = state.reader.getMimeTypes();
    const mimeType = mimeTypes[entry.mimetypeIndex] || 'application/octet-stream';

    if (raw) {
        res.set('Content-Type', mimeType);
        return res.send(content);
    }

    let contentStr: string;
    let encoding = 'utf-8';

    try {
        if (mimeType.includes('text') || mimeType.includes('json') || mimeType.includes('xml')) {
            contentStr = content.toString('utf-8');
        } else {
            contentStr = content.toString('base64');
            encoding = 'base64';
        }
    } catch {
        contentStr = content.toString('base64');
        encoding = 'base64';
    }

    res.json({
        url: entry.url,
        title: entry.title,
        namespace: String.fromCharCode(entry.namespace),
        content: contentStr,
        contentType: mimeType,
        contentLength: content.length,
        encoding
    });
});

/**
 * @swagger
 * /zim/main-page:
 *   get:
 *     tags: [read]
 *     summary: Get Main Page
 *     description: Get the main page content of the ZIM file
 *     responses:
 *       200:
 *         description: Main page content
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArticleContent'
 */
app.get('/zim/main-page', (req: Request, res: Response) => {
    if (!state.reader) {
        return res.status(400).json({ error: 'No ZIM file loaded' });
    }

    const mainPage = state.reader.getMainPage();
    if (!mainPage) {
        return res.status(404).json({ error: 'No main page defined' });
    }

    const content = state.reader.getArticleContent(mainPage);
    const mimeTypes = state.reader.getMimeTypes();

    res.json({
        url: mainPage.url,
        title: mainPage.title,
        namespace: String.fromCharCode(mainPage.namespace),
        content: content.toString('utf-8'),
        contentType: mimeTypes[mainPage.mimetypeIndex] || 'text/html',
        contentLength: content.length,
        encoding: 'utf-8'
    });
});

// =============================================================================
// API Endpoints - Search
// =============================================================================

/**
 * @swagger
 * /zim/search:
 *   get:
 *     tags: [search]
 *     summary: Search Articles
 *     description: Search articles by title or URL
 *     parameters:
 *       - name: q
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *         description: Search query
 *       - name: namespace
 *         in: query
 *         schema:
 *           type: string
 *           enum: [A, I, M, '-', S, J, T]
 *         description: Filter by namespace
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Maximum results
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SearchResult'
 */
app.get('/zim/search', (req: Request, res: Response) => {
    if (!state.reader) {
        return res.status(400).json({ error: 'No ZIM file loaded' });
    }

    const query = (req.query.q as string || '').toLowerCase();
    const namespace = req.query.namespace as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    if (!query) {
        return res.status(400).json({ error: 'Query parameter q is required' });
    }

    let articles = state.reader.listArticles();

    if (namespace) {
        articles = articles.filter((a: any) => 
            String.fromCharCode(a.namespace) === namespace
        );
    }

    const results = articles
        .filter((a: any) => 
            a.url.toLowerCase().includes(query) || 
            a.title.toLowerCase().includes(query)
        )
        .slice(0, limit)
        .map((entry: any) => ({
            index: entry.index,
            namespace: String.fromCharCode(entry.namespace),
            url: entry.url,
            title: entry.title,
            mimetypeIndex: entry.mimetypeIndex,
            clusterNumber: entry.clusterNumber,
            blobNumber: entry.blobNumber,
            entryType: 'article'
        }));

    res.json({
        total: results.length,
        results
    });
});

// =============================================================================
// API Endpoints - Write Operations
// =============================================================================

/**
 * @swagger
 * /zim/create:
 *   post:
 *     tags: [write]
 *     summary: Create ZIM File
 *     description: Create a new ZIM file with the provided articles
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateZIMRequest'
 *     responses:
 *       200:
 *         description: ZIM file created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 filename: { type: string }
 *                 path: { type: string }
 *                 fileSize: { type: integer }
 *                 articlesCount: { type: integer }
 */
app.post('/zim/create', (req: Request, res: Response) => {
    const { filename, articles, mainPageUrl } = req.body;

    if (!filename || !articles || !Array.isArray(articles)) {
        return res.status(400).json({ error: 'filename and articles array are required' });
    }

    const outputPath = path.join('uploads', filename);

    try {
        // In production, use actual ZIMWriter:
        /*
        const writer = new ZIMWriter(outputPath);
        writer.create();
        
        articles.forEach((article: any, index: number) => {
            const ns = article.namespace?.charCodeAt(0) || 65;
            writer.addArticle(ns, article.url, article.title, 
                Buffer.from(article.content), article.mimeType || 'text/html');
        });
        
        if (mainPageUrl) {
            const mainIndex = articles.findIndex(a => a.url === mainPageUrl);
            if (mainIndex >= 0) writer.mainPageIndex = mainIndex;
        }
        
        writer.finalize();
        writer.close();
        */

        // For demo, create placeholder file
        fs.mkdirSync('uploads', { recursive: true });
        fs.writeFileSync(outputPath, Buffer.from([0x5A, 0x5A, 0x49, 0x4D]));

        res.json({
            success: true,
            filename,
            path: outputPath,
            fileSize: 4,
            articlesCount: articles.length
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Error creating ZIM file', detail: error.message });
    }
});

/**
 * @swagger
 * /zim/download/{filename}:
 *   get:
 *     tags: [export]
 *     summary: Download ZIM File
 *     description: Download a created ZIM file
 *     parameters:
 *       - name: filename
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ZIM filename
 *     responses:
 *       200:
 *         description: ZIM file download
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 */
app.get('/zim/download/:filename', (req: Request, res: Response) => {
    const filePath = path.join('uploads', req.params.filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath);
});

// =============================================================================
// Error Handler
// =============================================================================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
});

// =============================================================================
// Start Server
// =============================================================================

app.listen(PORT, () => {
    console.log(`
🗂️  ZIM Library API Server (TypeScript)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Server:     http://localhost:${PORT}
  Swagger UI: http://localhost:${PORT}/api-docs
  OpenAPI:    http://localhost:${PORT}/api-docs.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
});

export default app;

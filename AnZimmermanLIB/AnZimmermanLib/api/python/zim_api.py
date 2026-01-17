"""
ZIM Library REST API with FastAPI and Swagger UI

This module provides a RESTful API for ZIM file operations with
automatic Swagger/OpenAPI documentation and interactive testing.

Run: uvicorn zim_api:app --reload --port 8000
Swagger UI: http://localhost:8000/docs
ReDoc: http://localhost:8000/redoc
OpenAPI JSON: http://localhost:8000/openapi.json
"""

import os
import sys
import base64
import tempfile
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

from fastapi import FastAPI, HTTPException, UploadFile, File, Query, Path, Body
from fastapi.responses import HTMLResponse, Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Add parent directory for zimlib import
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from zimlib import ZIMReader, ZIMWriter, DirectoryEntry, RedirectEntry, Namespace

# =============================================================================
# Pydantic Models for API Request/Response
# =============================================================================

class NamespaceEnum(str, Enum):
    """ZIM namespace identifiers."""
    MAIN_ARTICLE = "A"
    IMAGE = "I"
    METADATA = "M"
    RAW_DATA = "-"
    STYLE = "S"
    SCRIPT = "J"
    FONT = "T"


class ZIMHeaderResponse(BaseModel):
    """ZIM file header information."""
    magic_number: str = Field(..., description="Magic number (should be 0x4D495A5A)")
    major_version: int = Field(..., description="Format major version")
    minor_version: int = Field(..., description="Format minor version")
    entry_count: int = Field(..., description="Total number of entries")
    article_count: int = Field(..., description="Number of articles")
    cluster_count: int = Field(..., description="Number of clusters")
    redirect_count: int = Field(..., description="Number of redirects")
    main_page_index: int = Field(..., description="Index of main page entry")
    
    class Config:
        json_schema_extra = {
            "example": {
                "magic_number": "0x4D495A5A",
                "major_version": 4,
                "minor_version": 0,
                "entry_count": 150,
                "article_count": 100,
                "cluster_count": 50,
                "redirect_count": 20,
                "main_page_index": 0
            }
        }


class ArticleEntryResponse(BaseModel):
    """Article entry information."""
    index: int = Field(..., description="Entry index in directory")
    namespace: str = Field(..., description="Namespace character")
    url: str = Field(..., description="Article URL")
    title: str = Field(..., description="Article title")
    mimetype_index: int = Field(..., description="MIME type index")
    cluster_number: int = Field(..., description="Cluster containing content")
    blob_number: int = Field(..., description="Blob index within cluster")
    entry_type: str = Field(default="article", description="Entry type")
    
    class Config:
        json_schema_extra = {
            "example": {
                "index": 0,
                "namespace": "A",
                "url": "Main_Page",
                "title": "Welcome",
                "mimetype_index": 0,
                "cluster_number": 0,
                "blob_number": 0,
                "entry_type": "article"
            }
        }


class RedirectEntryResponse(BaseModel):
    """Redirect entry information."""
    index: int = Field(..., description="Entry index in directory")
    namespace: str = Field(..., description="Namespace character")
    url: str = Field(..., description="Redirect source URL")
    title: str = Field(..., description="Redirect title")
    redirect_index: int = Field(..., description="Target entry index")
    entry_type: str = Field(default="redirect", description="Entry type")


class ArticleContentResponse(BaseModel):
    """Article content response."""
    url: str = Field(..., description="Article URL")
    title: str = Field(..., description="Article title")
    namespace: str = Field(..., description="Namespace")
    content: str = Field(..., description="Article content (text or base64)")
    content_type: str = Field(..., description="MIME type")
    content_length: int = Field(..., description="Content length in bytes")
    encoding: str = Field(default="utf-8", description="Content encoding (utf-8 or base64)")


class CreateArticleRequest(BaseModel):
    """Request to create a new article."""
    namespace: NamespaceEnum = Field(default=NamespaceEnum.MAIN_ARTICLE, description="Target namespace")
    url: str = Field(..., description="Article URL (without namespace)")
    title: str = Field(..., description="Article title")
    content: str = Field(..., description="Article content")
    mime_type: str = Field(default="text/html", description="MIME type")
    
    class Config:
        json_schema_extra = {
            "example": {
                "namespace": "A",
                "url": "New_Article",
                "title": "New Article Title",
                "content": "<html><body><h1>Hello</h1></body></html>",
                "mime_type": "text/html"
            }
        }


class CreateRedirectRequest(BaseModel):
    """Request to create a redirect."""
    namespace: NamespaceEnum = Field(default=NamespaceEnum.MAIN_ARTICLE, description="Namespace")
    url: str = Field(..., description="Redirect source URL")
    title: str = Field(..., description="Redirect title")
    target_index: int = Field(..., description="Target entry index")


class CreateZIMRequest(BaseModel):
    """Request to create a new ZIM file."""
    filename: str = Field(..., description="Output filename")
    articles: List[CreateArticleRequest] = Field(default=[], description="Articles to add")
    redirects: List[CreateRedirectRequest] = Field(default=[], description="Redirects to add")
    main_page_url: Optional[str] = Field(None, description="Main page URL")
    
    class Config:
        json_schema_extra = {
            "example": {
                "filename": "my_wiki.zim",
                "articles": [
                    {
                        "namespace": "A",
                        "url": "Main_Page",
                        "title": "Welcome",
                        "content": "<html><body><h1>Welcome</h1></body></html>",
                        "mime_type": "text/html"
                    }
                ],
                "redirects": [],
                "main_page_url": "Main_Page"
            }
        }


class SearchRequest(BaseModel):
    """Search request parameters."""
    query: str = Field(..., description="Search query")
    namespace: Optional[NamespaceEnum] = Field(None, description="Filter by namespace")
    limit: int = Field(default=20, ge=1, le=100, description="Maximum results")
    
    class Config:
        json_schema_extra = {
            "example": {
                "query": "python",
                "namespace": "A",
                "limit": 20
            }
        }


class SearchResultResponse(BaseModel):
    """Search result."""
    total: int = Field(..., description="Total matches found")
    results: List[ArticleEntryResponse] = Field(..., description="Matching articles")


class ZIMInfoResponse(BaseModel):
    """Complete ZIM file information."""
    filename: str
    file_size: int
    header: ZIMHeaderResponse
    mime_types: List[str]
    namespaces: Dict[str, int]


class APIStatusResponse(BaseModel):
    """API status response."""
    status: str = "ok"
    version: str = "1.0.0"
    loaded_zim: Optional[str] = None
    timestamp: str


class ErrorResponse(BaseModel):
    """Error response."""
    error: str
    detail: Optional[str] = None


# =============================================================================
# FastAPI Application
# =============================================================================

app = FastAPI(
    title="ZIM Library API",
    description="""
## ZIM File Format REST API

This API provides RESTful access to ZIM (Zeno IMproved) file operations including:

### Features
- 📖 **Read** ZIM files and extract content
- ✏️ **Write** new ZIM files with articles
- 🔍 **Search** articles by title/URL
- 📊 **Analyze** ZIM file structure and metadata

### ZIM File Format
ZIM is an open file format for storing web content offline, primarily used for Wikipedia and other Wikimedia projects.

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
Use the **Try it out** button on each endpoint to test the API interactively.
    """,
    version="1.0.0",
    contact={
        "name": "ZIM Library",
        "url": "https://github.com/yourproject/zimlib",
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    },
    openapi_tags=[
        {"name": "status", "description": "API status and health checks"},
        {"name": "read", "description": "Read ZIM file contents"},
        {"name": "write", "description": "Create and modify ZIM files"},
        {"name": "search", "description": "Search ZIM file contents"},
        {"name": "export", "description": "Export ZIM content"},
    ]
)

# CORS middleware for browser access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state for loaded ZIM file
class ZIMState:
    reader: Optional[ZIMReader] = None
    filename: Optional[str] = None
    temp_dir: str = tempfile.gettempdir()

state = ZIMState()


# =============================================================================
# API Endpoints - Status
# =============================================================================

@app.get(
    "/",
    response_class=HTMLResponse,
    tags=["status"],
    summary="API Welcome Page",
    description="Returns HTML welcome page with links to documentation"
)
async def root():
    """Welcome page with API information and links."""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>ZIM Library API</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                   max-width: 800px; margin: 50px auto; padding: 20px; }
            h1 { color: #2c3e50; }
            .links { margin: 20px 0; }
            .links a { display: inline-block; margin: 10px; padding: 15px 25px;
                       background: #3498db; color: white; text-decoration: none;
                       border-radius: 5px; }
            .links a:hover { background: #2980b9; }
            code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
        </style>
    </head>
    <body>
        <h1>🗂️ ZIM Library REST API</h1>
        <p>Welcome to the ZIM file format REST API with Swagger documentation.</p>
        
        <div class="links">
            <a href="/docs">📚 Swagger UI</a>
            <a href="/redoc">📖 ReDoc</a>
            <a href="/openapi.json">📄 OpenAPI JSON</a>
        </div>
        
        <h2>Quick Start</h2>
        <ol>
            <li>Upload a ZIM file: <code>POST /zim/upload</code></li>
            <li>Get file info: <code>GET /zim/info</code></li>
            <li>List articles: <code>GET /zim/articles</code></li>
            <li>Read article: <code>GET /zim/article/{path}</code></li>
        </ol>
        
        <h2>Features</h2>
        <ul>
            <li>📖 Read ZIM files and extract content</li>
            <li>✏️ Write new ZIM files</li>
            <li>🔍 Search articles</li>
            <li>📊 Analyze ZIM structure</li>
        </ul>
    </body>
    </html>
    """


@app.get(
    "/status",
    response_model=APIStatusResponse,
    tags=["status"],
    summary="API Status",
    description="Check API status and currently loaded ZIM file"
)
async def get_status():
    """Get API status and information about loaded ZIM file."""
    return APIStatusResponse(
        status="ok",
        version="1.0.0",
        loaded_zim=state.filename,
        timestamp=datetime.now().isoformat()
    )


# =============================================================================
# API Endpoints - Read Operations
# =============================================================================

@app.post(
    "/zim/upload",
    response_model=ZIMInfoResponse,
    tags=["read"],
    summary="Upload ZIM File",
    description="Upload a ZIM file to the server for reading"
)
async def upload_zim(file: UploadFile = File(..., description="ZIM file to upload")):
    """
    Upload a ZIM file for processing.
    
    The file will be saved temporarily and loaded for subsequent operations.
    """
    if not file.filename.endswith('.zim'):
        raise HTTPException(status_code=400, detail="File must have .zim extension")
    
    # Save uploaded file
    temp_path = os.path.join(state.temp_dir, file.filename)
    content = await file.read()
    
    with open(temp_path, 'wb') as f:
        f.write(content)
    
    # Close existing reader
    if state.reader:
        state.reader.close()
    
    # Open new ZIM file
    try:
        state.reader = ZIMReader(temp_path)
        state.reader.open()
        state.filename = file.filename
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid ZIM file: {str(e)}")
    
    return await get_zim_info()


@app.post(
    "/zim/load",
    response_model=ZIMInfoResponse,
    tags=["read"],
    summary="Load ZIM File by Path",
    description="Load a ZIM file from the server filesystem"
)
async def load_zim(
    path: str = Body(..., embed=True, description="Path to ZIM file on server")
):
    """Load a ZIM file from a server path."""
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"File not found: {path}")
    
    # Close existing reader
    if state.reader:
        state.reader.close()
    
    try:
        state.reader = ZIMReader(path)
        state.reader.open()
        state.filename = os.path.basename(path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid ZIM file: {str(e)}")
    
    return await get_zim_info()


@app.get(
    "/zim/info",
    response_model=ZIMInfoResponse,
    tags=["read"],
    summary="Get ZIM Info",
    description="Get detailed information about the loaded ZIM file"
)
async def get_zim_info():
    """Get complete information about the loaded ZIM file."""
    if not state.reader:
        raise HTTPException(status_code=400, detail="No ZIM file loaded")
    
    header = state.reader.header
    
    # Count namespaces
    namespaces = {}
    for entry in state.reader.directory_entries:
        ns = chr(entry.namespace)
        namespaces[ns] = namespaces.get(ns, 0) + 1
    
    file_size = 0
    if state.filename:
        temp_path = os.path.join(state.temp_dir, state.filename)
        if os.path.exists(temp_path):
            file_size = os.path.getsize(temp_path)
    
    return ZIMInfoResponse(
        filename=state.filename or "unknown",
        file_size=file_size,
        header=ZIMHeaderResponse(
            magic_number=f"0x{header.magic_number:08X}",
            major_version=header.major_version,
            minor_version=header.minor_version,
            entry_count=header.entry_count,
            article_count=header.article_count,
            cluster_count=header.cluster_count,
            redirect_count=header.redirect_count,
            main_page_index=header.main_page_index
        ),
        mime_types=state.reader.mime_types,
        namespaces=namespaces
    )


@app.get(
    "/zim/header",
    response_model=ZIMHeaderResponse,
    tags=["read"],
    summary="Get ZIM Header",
    description="Get the ZIM file header information"
)
async def get_header():
    """Get ZIM file header."""
    if not state.reader:
        raise HTTPException(status_code=400, detail="No ZIM file loaded")
    
    header = state.reader.header
    return ZIMHeaderResponse(
        magic_number=f"0x{header.magic_number:08X}",
        major_version=header.major_version,
        minor_version=header.minor_version,
        entry_count=header.entry_count,
        article_count=header.article_count,
        cluster_count=header.cluster_count,
        redirect_count=header.redirect_count,
        main_page_index=header.main_page_index
    )


@app.get(
    "/zim/mime-types",
    response_model=List[str],
    tags=["read"],
    summary="Get MIME Types",
    description="List all MIME types used in the ZIM file"
)
async def get_mime_types():
    """Get list of MIME types in the ZIM file."""
    if not state.reader:
        raise HTTPException(status_code=400, detail="No ZIM file loaded")
    
    return state.reader.mime_types


@app.get(
    "/zim/articles",
    response_model=List[ArticleEntryResponse],
    tags=["read"],
    summary="List Articles",
    description="List all articles in the ZIM file with optional filtering"
)
async def list_articles(
    namespace: Optional[NamespaceEnum] = Query(None, description="Filter by namespace"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum results"),
    offset: int = Query(0, ge=0, description="Offset for pagination")
):
    """List articles with optional namespace filtering and pagination."""
    if not state.reader:
        raise HTTPException(status_code=400, detail="No ZIM file loaded")
    
    results = []
    count = 0
    
    for i, entry in enumerate(state.reader.directory_entries):
        if isinstance(entry, DirectoryEntry):
            ns = chr(entry.namespace)
            
            if namespace and ns != namespace.value:
                continue
            
            if count < offset:
                count += 1
                continue
            
            if len(results) >= limit:
                break
            
            results.append(ArticleEntryResponse(
                index=i,
                namespace=ns,
                url=entry.url,
                title=entry.title,
                mimetype_index=entry.mimetype_index,
                cluster_number=entry.cluster_number,
                blob_number=entry.blob_number,
                entry_type="article"
            ))
            count += 1
    
    return results


@app.get(
    "/zim/redirects",
    response_model=List[RedirectEntryResponse],
    tags=["read"],
    summary="List Redirects",
    description="List all redirect entries in the ZIM file"
)
async def list_redirects(
    limit: int = Query(100, ge=1, le=1000, description="Maximum results"),
    offset: int = Query(0, ge=0, description="Offset for pagination")
):
    """List redirect entries with pagination."""
    if not state.reader:
        raise HTTPException(status_code=400, detail="No ZIM file loaded")
    
    results = []
    count = 0
    
    for i, entry in enumerate(state.reader.directory_entries):
        if isinstance(entry, RedirectEntry):
            if count < offset:
                count += 1
                continue
            
            if len(results) >= limit:
                break
            
            results.append(RedirectEntryResponse(
                index=i,
                namespace=chr(entry.namespace),
                url=entry.url,
                title=entry.title,
                redirect_index=entry.redirect_index,
                entry_type="redirect"
            ))
            count += 1
    
    return results


@app.get(
    "/zim/article/{namespace}/{path:path}",
    response_model=ArticleContentResponse,
    tags=["read"],
    summary="Get Article Content",
    description="Retrieve the content of a specific article by namespace and path"
)
async def get_article(
    namespace: NamespaceEnum = Path(..., description="Article namespace"),
    path: str = Path(..., description="Article URL path"),
    raw: bool = Query(False, description="Return raw content instead of JSON")
):
    """
    Get article content by namespace and path.
    
    - **namespace**: The namespace (A for articles, S for styles, etc.)
    - **path**: The article URL path
    - **raw**: If true, returns raw content with appropriate Content-Type
    """
    if not state.reader:
        raise HTTPException(status_code=400, detail="No ZIM file loaded")
    
    full_path = f"{namespace.value}/{path}"
    entry = state.reader.get_entry_by_path(full_path)
    
    if not entry:
        raise HTTPException(status_code=404, detail=f"Article not found: {full_path}")
    
    if isinstance(entry, RedirectEntry):
        # Follow redirect
        if entry.redirect_index < len(state.reader.directory_entries):
            entry = state.reader.directory_entries[entry.redirect_index]
        else:
            raise HTTPException(status_code=404, detail="Redirect target not found")
    
    if not isinstance(entry, DirectoryEntry):
        raise HTTPException(status_code=400, detail="Entry is not an article")
    
    try:
        content = state.reader.get_article_content(entry)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading content: {str(e)}")
    
    # Get MIME type
    mime_type = "application/octet-stream"
    if entry.mimetype_index < len(state.reader.mime_types):
        mime_type = state.reader.mime_types[entry.mimetype_index]
    
    # Return raw content if requested
    if raw:
        return Response(content=content, media_type=mime_type)
    
    # Try to decode as text, fall back to base64
    try:
        if 'text' in mime_type or 'json' in mime_type or 'xml' in mime_type:
            content_str = content.decode('utf-8')
            encoding = "utf-8"
        else:
            content_str = base64.b64encode(content).decode('ascii')
            encoding = "base64"
    except UnicodeDecodeError:
        content_str = base64.b64encode(content).decode('ascii')
        encoding = "base64"
    
    return ArticleContentResponse(
        url=entry.url,
        title=entry.title,
        namespace=chr(entry.namespace),
        content=content_str,
        content_type=mime_type,
        content_length=len(content),
        encoding=encoding
    )


@app.get(
    "/zim/main-page",
    response_model=ArticleContentResponse,
    tags=["read"],
    summary="Get Main Page",
    description="Get the main page content of the ZIM file"
)
async def get_main_page():
    """Get the main page of the ZIM file."""
    if not state.reader:
        raise HTTPException(status_code=400, detail="No ZIM file loaded")
    
    main_page = state.reader.get_main_page()
    if not main_page:
        raise HTTPException(status_code=404, detail="No main page defined")
    
    if isinstance(main_page, DirectoryEntry):
        content = state.reader.get_article_content(main_page)
        
        mime_type = "text/html"
        if main_page.mimetype_index < len(state.reader.mime_types):
            mime_type = state.reader.mime_types[main_page.mimetype_index]
        
        try:
            content_str = content.decode('utf-8')
            encoding = "utf-8"
        except UnicodeDecodeError:
            content_str = base64.b64encode(content).decode('ascii')
            encoding = "base64"
        
        return ArticleContentResponse(
            url=main_page.url,
            title=main_page.title,
            namespace=chr(main_page.namespace),
            content=content_str,
            content_type=mime_type,
            content_length=len(content),
            encoding=encoding
        )
    
    raise HTTPException(status_code=404, detail="Main page is a redirect")


# =============================================================================
# API Endpoints - Search
# =============================================================================

@app.get(
    "/zim/search",
    response_model=SearchResultResponse,
    tags=["search"],
    summary="Search Articles",
    description="Search articles by title or URL"
)
async def search_articles(
    q: str = Query(..., min_length=1, description="Search query"),
    namespace: Optional[NamespaceEnum] = Query(None, description="Filter by namespace"),
    limit: int = Query(20, ge=1, le=100, description="Maximum results")
):
    """
    Search for articles matching the query.
    
    Searches in article titles and URLs (case-insensitive).
    """
    if not state.reader:
        raise HTTPException(status_code=400, detail="No ZIM file loaded")
    
    query_lower = q.lower()
    results = []
    
    for i, entry in enumerate(state.reader.directory_entries):
        if isinstance(entry, DirectoryEntry):
            ns = chr(entry.namespace)
            
            if namespace and ns != namespace.value:
                continue
            
            if (query_lower in entry.url.lower() or 
                query_lower in entry.title.lower()):
                
                results.append(ArticleEntryResponse(
                    index=i,
                    namespace=ns,
                    url=entry.url,
                    title=entry.title,
                    mimetype_index=entry.mimetype_index,
                    cluster_number=entry.cluster_number,
                    blob_number=entry.blob_number,
                    entry_type="article"
                ))
                
                if len(results) >= limit:
                    break
    
    return SearchResultResponse(total=len(results), results=results)


@app.post(
    "/zim/search",
    response_model=SearchResultResponse,
    tags=["search"],
    summary="Advanced Search",
    description="Advanced search with request body parameters"
)
async def advanced_search(request: SearchRequest):
    """Advanced search with more options."""
    return await search_articles(
        q=request.query,
        namespace=request.namespace,
        limit=request.limit
    )


# =============================================================================
# API Endpoints - Write Operations
# =============================================================================

@app.post(
    "/zim/create",
    tags=["write"],
    summary="Create ZIM File",
    description="Create a new ZIM file with the provided articles"
)
async def create_zim(request: CreateZIMRequest):
    """
    Create a new ZIM file.
    
    Provide a list of articles and optionally redirects to include.
    """
    output_path = os.path.join(state.temp_dir, request.filename)
    
    try:
        with ZIMWriter(output_path) as writer:
            # Add articles
            for i, article in enumerate(request.articles):
                ns_value = ord(article.namespace.value)
                writer.add_article(
                    namespace=ns_value,
                    url=article.url,
                    title=article.title,
                    content=article.content.encode('utf-8'),
                    mime_type=article.mime_type
                )
            
            # Add redirects
            for redirect in request.redirects:
                ns_value = ord(redirect.namespace.value)
                writer.add_redirect(
                    namespace=ns_value,
                    url=redirect.url,
                    title=redirect.title,
                    redirect_index=redirect.target_index
                )
            
            # Set main page
            if request.main_page_url:
                for i, article in enumerate(request.articles):
                    if article.url == request.main_page_url:
                        writer.main_page_index = i
                        break
        
        file_size = os.path.getsize(output_path)
        
        return {
            "success": True,
            "filename": request.filename,
            "path": output_path,
            "file_size": file_size,
            "articles_count": len(request.articles),
            "redirects_count": len(request.redirects)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating ZIM: {str(e)}")


@app.get(
    "/zim/download/{filename}",
    tags=["export"],
    summary="Download ZIM File",
    description="Download a created ZIM file"
)
async def download_zim(filename: str = Path(..., description="ZIM filename")):
    """Download a ZIM file that was created or uploaded."""
    file_path = os.path.join(state.temp_dir, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    with open(file_path, 'rb') as f:
        content = f.read()
    
    return Response(
        content=content,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# =============================================================================
# API Endpoints - Export
# =============================================================================

@app.get(
    "/zim/export/article/{namespace}/{path:path}",
    tags=["export"],
    summary="Export Article as HTML",
    description="Export an article rendered as standalone HTML"
)
async def export_article_html(
    namespace: NamespaceEnum = Path(..., description="Article namespace"),
    path: str = Path(..., description="Article URL path")
):
    """Export article as standalone HTML with embedded styles."""
    if not state.reader:
        raise HTTPException(status_code=400, detail="No ZIM file loaded")
    
    full_path = f"{namespace.value}/{path}"
    entry = state.reader.get_entry_by_path(full_path)
    
    if not entry or not isinstance(entry, DirectoryEntry):
        raise HTTPException(status_code=404, detail="Article not found")
    
    content = state.reader.get_article_content(entry)
    
    return Response(
        content=content,
        media_type="text/html",
        headers={"Content-Disposition": f"attachment; filename={path}.html"}
    )


@app.get(
    "/zim/export/json",
    tags=["export"],
    summary="Export Metadata as JSON",
    description="Export ZIM file metadata and article list as JSON"
)
async def export_json():
    """Export ZIM file metadata and index as JSON."""
    if not state.reader:
        raise HTTPException(status_code=400, detail="No ZIM file loaded")
    
    articles = []
    for i, entry in enumerate(state.reader.directory_entries):
        if isinstance(entry, DirectoryEntry):
            articles.append({
                "index": i,
                "namespace": chr(entry.namespace),
                "url": entry.url,
                "title": entry.title
            })
    
    export_data = {
        "filename": state.filename,
        "header": {
            "version": f"{state.reader.header.major_version}.{state.reader.header.minor_version}",
            "entry_count": state.reader.header.entry_count,
            "article_count": state.reader.header.article_count
        },
        "mime_types": state.reader.mime_types,
        "articles": articles
    }
    
    return JSONResponse(
        content=export_data,
        headers={"Content-Disposition": "attachment; filename=zim_export.json"}
    )


# =============================================================================
# Cleanup on shutdown
# =============================================================================

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown."""
    if state.reader:
        state.reader.close()


# =============================================================================
# Run with uvicorn
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

#!/usr/bin/env python3
"""
Example: Reading a ZIM file

This example demonstrates how to read and extract content from ZIM archives.
It covers:
- Opening a ZIM file
- Reading the header and metadata
- Listing articles and entries
- Retrieving article content
- Navigating namespaces
- Following redirects

Author: Clean-room ZIM Library
License: MIT
"""

import sys
import os

# Add parent directory to path for importing zimlib
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from zimlib import ZIMReader, DirectoryEntry, RedirectEntry, Namespace


def read_zim_basic(zim_path: str):
    """
    Basic ZIM file reading - header and entry listing.
    """
    print(f"\n{'='*60}")
    print(f"Reading ZIM file: {zim_path}")
    print('='*60)
    
    with ZIMReader(zim_path) as zim:
        # Access header information
        header = zim.header
        print("\n📋 HEADER INFORMATION")
        print("-" * 40)
        print(f"  Magic Number: 0x{header.magic_number:08X}")
        print(f"  Version: {header.major_version}.{header.minor_version}")
        print(f"  Entry Count: {header.entry_count:,}")
        print(f"  Article Count: {header.article_count:,}")
        print(f"  Cluster Count: {header.cluster_count:,}")
        print(f"  Redirect Count: {header.redirect_count:,}")
        print(f"  Main Page Index: {header.main_page_index}")
        
        # Get MIME types
        print("\n📄 MIME TYPES")
        print("-" * 40)
        for i, mime_type in enumerate(zim.mime_types):
            print(f"  [{i}] {mime_type}")
        
        # List all entries
        print("\n📚 ALL ENTRIES")
        print("-" * 40)
        for i, entry in enumerate(zim.directory_entries):
            namespace = chr(entry.namespace)
            entry_type = "Article" if isinstance(entry, DirectoryEntry) else "Redirect"
            print(f"  [{i}] [{namespace}] {entry.url} ({entry_type})")
            if i >= 9:  # Limit output for large files
                remaining = len(zim.directory_entries) - 10
                if remaining > 0:
                    print(f"  ... and {remaining} more entries")
                break


def read_zim_articles(zim_path: str):
    """
    Read and display article content from a ZIM file.
    """
    print(f"\n{'='*60}")
    print("Reading Article Content")
    print('='*60)
    
    with ZIMReader(zim_path) as zim:
        # Get main page
        print("\n🏠 MAIN PAGE")
        print("-" * 40)
        main_page = zim.get_main_page()
        
        if main_page:
            print(f"  URL: {main_page.url}")
            print(f"  Title: {main_page.title}")
            print(f"  Namespace: {chr(main_page.namespace)}")
            
            if isinstance(main_page, DirectoryEntry):
                content = zim.get_article_content(main_page)
                print(f"  Content size: {len(content):,} bytes")
                print(f"\n  Content preview (first 500 chars):")
                print("  " + "-" * 38)
                preview = content.decode('utf-8', errors='replace')[:500]
                for line in preview.split('\n')[:15]:
                    print(f"  | {line[:70]}")
                if len(content) > 500:
                    print("  | ...")
        else:
            print("  No main page defined")
        
        # List articles only (not redirects)
        print("\n📖 ARTICLES")
        print("-" * 40)
        articles = zim.list_articles()
        print(f"  Total articles: {len(articles)}")
        
        for article in articles[:5]:  # Show first 5
            namespace = chr(article.namespace)
            print(f"\n  [{namespace}] {article.url}")
            print(f"      Title: {article.title}")
            print(f"      Cluster: {article.cluster_number}, Blob: {article.blob_number}")
            
            # Get content
            try:
                content = zim.get_article_content(article)
                print(f"      Size: {len(content):,} bytes")
            except Exception as e:
                print(f"      Error reading content: {e}")


def read_zim_by_path(zim_path: str, article_path: str):
    """
    Read a specific article by its path.
    """
    print(f"\n{'='*60}")
    print(f"Reading Article by Path: {article_path}")
    print('='*60)
    
    with ZIMReader(zim_path) as zim:
        entry = zim.get_entry_by_path(article_path)
        
        if entry is None:
            print(f"  ❌ Article not found: {article_path}")
            return None
        
        print(f"\n  ✓ Found entry:")
        print(f"    URL: {entry.url}")
        print(f"    Title: {entry.title}")
        print(f"    Namespace: {chr(entry.namespace)}")
        
        if isinstance(entry, DirectoryEntry):
            print(f"    Type: Article")
            print(f"    Cluster: {entry.cluster_number}")
            print(f"    Blob: {entry.blob_number}")
            
            content = zim.get_article_content(entry)
            print(f"    Content size: {len(content):,} bytes")
            
            return content
            
        elif isinstance(entry, RedirectEntry):
            print(f"    Type: Redirect")
            print(f"    Redirects to index: {entry.redirect_index}")
            
            # Follow redirect
            if entry.redirect_index < len(zim.directory_entries):
                target = zim.directory_entries[entry.redirect_index]
                print(f"    Target: {target.url}")
                
                if isinstance(target, DirectoryEntry):
                    content = zim.get_article_content(target)
                    print(f"    Target content size: {len(content):,} bytes")
                    return content
            
            return None


def search_articles(zim_path: str, search_term: str):
    """
    Search for articles containing a term in their title or URL.
    """
    print(f"\n{'='*60}")
    print(f"Searching for: '{search_term}'")
    print('='*60)
    
    with ZIMReader(zim_path) as zim:
        results = []
        search_lower = search_term.lower()
        
        for entry in zim.directory_entries:
            if isinstance(entry, DirectoryEntry):
                if (search_lower in entry.url.lower() or 
                    search_lower in entry.title.lower()):
                    results.append(entry)
        
        print(f"\n  Found {len(results)} matching articles:")
        print("-" * 40)
        
        for entry in results[:10]:  # Show first 10
            namespace = chr(entry.namespace)
            print(f"  [{namespace}] {entry.url}")
            print(f"       Title: {entry.title}")
        
        if len(results) > 10:
            print(f"  ... and {len(results) - 10} more results")
        
        return results


def analyze_namespaces(zim_path: str):
    """
    Analyze the distribution of entries across namespaces.
    """
    print(f"\n{'='*60}")
    print("Namespace Analysis")
    print('='*60)
    
    with ZIMReader(zim_path) as zim:
        namespace_counts = {}
        namespace_sizes = {}
        
        for entry in zim.directory_entries:
            ns = chr(entry.namespace)
            namespace_counts[ns] = namespace_counts.get(ns, 0) + 1
            
            if isinstance(entry, DirectoryEntry):
                try:
                    content = zim.get_article_content(entry)
                    namespace_sizes[ns] = namespace_sizes.get(ns, 0) + len(content)
                except:
                    pass
        
        print("\n  Namespace Distribution:")
        print("-" * 40)
        print(f"  {'Namespace':<15} {'Count':<10} {'Total Size':<15}")
        print(f"  {'-'*13:<15} {'-'*8:<10} {'-'*13:<15}")
        
        for ns in sorted(namespace_counts.keys()):
            count = namespace_counts[ns]
            size = namespace_sizes.get(ns, 0)
            
            # Get namespace description
            ns_names = {
                'A': 'Main Articles',
                'I': 'Images',
                'M': 'Metadata',
                '-': 'Raw Data',
                'S': 'Stylesheets',
                'J': 'Scripts',
                'T': 'Fonts',
                'U': 'Translations',
                'V': 'Videos',
                'W': 'Audio',
            }
            ns_name = ns_names.get(ns, 'Unknown')
            
            size_str = f"{size:,} bytes" if size > 0 else "N/A"
            print(f"  {ns} ({ns_name})"[:15].ljust(15) + f" {count:<10} {size_str:<15}")


def extract_all_articles(zim_path: str, output_dir: str):
    """
    Extract all articles to a directory structure.
    """
    print(f"\n{'='*60}")
    print(f"Extracting to: {output_dir}")
    print('='*60)
    
    os.makedirs(output_dir, exist_ok=True)
    
    with ZIMReader(zim_path) as zim:
        articles = zim.list_articles()
        extracted = 0
        errors = 0
        
        for article in articles:
            try:
                # Create namespace directory
                ns = chr(article.namespace)
                ns_dir = os.path.join(output_dir, ns)
                os.makedirs(ns_dir, exist_ok=True)
                
                # Sanitize filename
                filename = article.url.replace('/', '_').replace('\\', '_')
                if not filename:
                    filename = f"unnamed_{extracted}"
                
                # Get content
                content = zim.get_article_content(article)
                
                # Determine extension based on MIME type
                mime_index = article.mimetype_index
                if mime_index < len(zim.mime_types):
                    mime = zim.mime_types[mime_index]
                    if 'html' in mime:
                        if not filename.endswith('.html'):
                            filename += '.html'
                    elif 'css' in mime:
                        if not filename.endswith('.css'):
                            filename += '.css'
                    elif 'javascript' in mime:
                        if not filename.endswith('.js'):
                            filename += '.js'
                
                # Write file
                filepath = os.path.join(ns_dir, filename)
                with open(filepath, 'wb') as f:
                    f.write(content)
                
                extracted += 1
                
            except Exception as e:
                errors += 1
                print(f"  ❌ Error extracting {article.url}: {e}")
        
        print(f"\n  ✓ Extracted: {extracted} articles")
        if errors:
            print(f"  ❌ Errors: {errors}")


def main():
    """
    Main function demonstrating all reading capabilities.
    """
    # Check for ZIM file argument or use default
    if len(sys.argv) > 1:
        zim_path = sys.argv[1]
    else:
        # Try to find a ZIM file in current directory or examples
        zim_path = "simple_wiki.zim"
        if not os.path.exists(zim_path):
            print("No ZIM file found. Please run 01_create_zim.py first,")
            print("or provide a ZIM file path as argument.")
            print("\nUsage: python 02_read_zim.py [path/to/file.zim]")
            return
    
    if not os.path.exists(zim_path):
        print(f"Error: File not found: {zim_path}")
        return
    
    print("=" * 60)
    print("ZIM File Reading Examples")
    print("=" * 60)
    
    # Run all examples
    read_zim_basic(zim_path)
    read_zim_articles(zim_path)
    
    # Try reading specific paths
    read_zim_by_path(zim_path, "A/Main_Page")
    read_zim_by_path(zim_path, "A/Python")
    
    # Search
    search_articles(zim_path, "Python")
    
    # Namespace analysis
    analyze_namespaces(zim_path)
    
    # Optional: Extract all articles
    # extract_all_articles(zim_path, "extracted_content")
    
    print("\n" + "=" * 60)
    print("Reading examples completed!")
    print("=" * 60)


if __name__ == "__main__":
    main()

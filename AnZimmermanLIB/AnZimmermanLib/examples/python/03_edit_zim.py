#!/usr/bin/env python3
# Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
# All rights reserved.
# Unauthorized use without prior written consent is strictly prohibited.

"""
Example: Editing/Modifying ZIM files

This example demonstrates how to modify ZIM archives by:
- Reading an existing ZIM file
- Modifying article content
- Adding new articles to existing content
- Removing articles (by not including them)
- Creating a new ZIM file with modifications

Note: ZIM files are immutable by design. To "edit" a ZIM file,
we read the original, apply modifications, and write a new file.

Author: Clean-room ZIM Library
License: Proprietary
"""

import sys
import os
import re
from datetime import datetime

# Add parent directory to path for importing zimlib
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from zimlib import ZIMReader, ZIMWriter, DirectoryEntry, RedirectEntry, Namespace


class ZIMEditor:
    """
    A helper class for editing ZIM files.
    
    Since ZIM files are immutable, editing involves:
    1. Reading the original file
    2. Storing modifications in memory
    3. Writing a new file with changes applied
    """
    
    def __init__(self, source_path: str):
        """Initialize editor with source ZIM file."""
        self.source_path = source_path
        self.modifications = {}  # path -> new_content or None (delete)
        self.new_articles = []   # list of (namespace, url, title, content, mime)
        self.new_redirects = []  # list of (namespace, url, title, target_url)
        self.excluded_paths = set()  # paths to exclude from output
        
    def modify_article(self, path: str, new_content: bytes):
        """
        Modify an existing article's content.
        
        Args:
            path: Full path including namespace (e.g., "A/Main_Page")
            new_content: New content as bytes
        """
        self.modifications[path] = new_content
        print(f"  📝 Queued modification: {path}")
        
    def delete_article(self, path: str):
        """
        Mark an article for deletion (exclusion from output).
        
        Args:
            path: Full path including namespace (e.g., "A/Old_Article")
        """
        self.excluded_paths.add(path)
        print(f"  🗑️  Queued deletion: {path}")
        
    def add_article(self, namespace: int, url: str, title: str, 
                    content: bytes, mime_type: str = "text/html"):
        """
        Add a new article.
        
        Args:
            namespace: Namespace constant (e.g., Namespace.MAIN_ARTICLE)
            url: Article URL
            title: Article title
            content: Article content as bytes
            mime_type: MIME type string
        """
        self.new_articles.append((namespace, url, title, content, mime_type))
        print(f"  ➕ Queued new article: {chr(namespace)}/{url}")
        
    def add_redirect(self, namespace: int, url: str, title: str, target_url: str):
        """
        Add a new redirect.
        
        Args:
            namespace: Namespace constant
            url: Redirect source URL
            title: Redirect title
            target_url: Target article URL
        """
        self.new_redirects.append((namespace, url, title, target_url))
        print(f"  ↪️  Queued new redirect: {chr(namespace)}/{url} → {target_url}")
    
    def find_and_replace(self, path: str, find: str, replace: str):
        """
        Find and replace text in an article.
        
        Args:
            path: Article path
            find: Text to find
            replace: Replacement text
        """
        with ZIMReader(self.source_path) as zim:
            entry = zim.get_entry_by_path(path)
            if entry and isinstance(entry, DirectoryEntry):
                content = zim.get_article_content(entry)
                text = content.decode('utf-8', errors='replace')
                new_text = text.replace(find, replace)
                self.modifications[path] = new_text.encode('utf-8')
                count = text.count(find)
                print(f"  🔄 Find/Replace in {path}: {count} occurrences")
                
    def regex_replace(self, path: str, pattern: str, replacement: str):
        """
        Regex find and replace in an article.
        
        Args:
            path: Article path
            pattern: Regex pattern
            replacement: Replacement string (can use \\1, \\2 for groups)
        """
        with ZIMReader(self.source_path) as zim:
            entry = zim.get_entry_by_path(path)
            if entry and isinstance(entry, DirectoryEntry):
                content = zim.get_article_content(entry)
                text = content.decode('utf-8', errors='replace')
                new_text = re.sub(pattern, replacement, text)
                self.modifications[path] = new_text.encode('utf-8')
                print(f"  🔄 Regex replace in {path}")
    
    def save(self, output_path: str, update_metadata: bool = True):
        """
        Apply all modifications and save to a new ZIM file.
        
        Args:
            output_path: Path for the output ZIM file
            update_metadata: Whether to update modification date metadata
        """
        print(f"\n💾 Saving to: {output_path}")
        print("-" * 50)
        
        with ZIMReader(self.source_path) as reader:
            with ZIMWriter(output_path) as writer:
                # Track URL to index mapping for redirects
                url_to_index = {}
                current_index = 0
                
                # Copy existing entries with modifications
                for entry in reader.directory_entries:
                    ns = chr(entry.namespace)
                    path = f"{ns}/{entry.url}"
                    
                    # Skip excluded entries
                    if path in self.excluded_paths:
                        print(f"  ⏭️  Skipped (deleted): {path}")
                        continue
                    
                    if isinstance(entry, DirectoryEntry):
                        # Get content (modified or original)
                        if path in self.modifications:
                            content = self.modifications[path]
                            print(f"  ✏️  Modified: {path}")
                        else:
                            content = reader.get_article_content(entry)
                        
                        # Get MIME type
                        mime_type = "application/octet-stream"
                        if entry.mimetype_index < len(reader.mime_types):
                            mime_type = reader.mime_types[entry.mimetype_index]
                        
                        # Add to writer
                        writer.add_article(
                            namespace=entry.namespace,
                            url=entry.url,
                            title=entry.title,
                            content=content,
                            mime_type=mime_type
                        )
                        
                        url_to_index[path] = current_index
                        current_index += 1
                        
                    elif isinstance(entry, RedirectEntry):
                        # Store redirect for later (need target indices)
                        pass
                
                # Add new articles
                for namespace, url, title, content, mime_type in self.new_articles:
                    path = f"{chr(namespace)}/{url}"
                    writer.add_article(
                        namespace=namespace,
                        url=url,
                        title=title,
                        content=content,
                        mime_type=mime_type
                    )
                    url_to_index[path] = current_index
                    current_index += 1
                    print(f"  ➕ Added new: {path}")
                
                # Add redirects (existing and new)
                for entry in reader.directory_entries:
                    if isinstance(entry, RedirectEntry):
                        ns = chr(entry.namespace)
                        path = f"{ns}/{entry.url}"
                        
                        if path in self.excluded_paths:
                            continue
                        
                        # Find target index
                        if entry.redirect_index < len(reader.directory_entries):
                            target = reader.directory_entries[entry.redirect_index]
                            target_path = f"{chr(target.namespace)}/{target.url}"
                            
                            if target_path in url_to_index:
                                writer.add_redirect(
                                    namespace=entry.namespace,
                                    url=entry.url,
                                    title=entry.title,
                                    redirect_index=url_to_index[target_path]
                                )
                
                # Add new redirects
                for namespace, url, title, target_url in self.new_redirects:
                    target_path = f"{chr(namespace)}/{target_url}"
                    if target_path in url_to_index:
                        writer.add_redirect(
                            namespace=namespace,
                            url=url,
                            title=title,
                            redirect_index=url_to_index[target_path]
                        )
                        print(f"  ↪️  Added redirect: {chr(namespace)}/{url}")
                
                # Set main page
                if reader.header:
                    writer.main_page_index = min(
                        reader.header.main_page_index, 
                        len(writer.directory_entries) - 1
                    )
        
        print("-" * 50)
        print(f"✅ Saved successfully: {output_path}")
        
        if os.path.exists(output_path):
            size = os.path.getsize(output_path)
            print(f"   File size: {size:,} bytes")


def example_modify_content():
    """
    Example: Modify article content in a ZIM file.
    """
    source = "simple_wiki.zim"
    output = "modified_wiki.zim"
    
    if not os.path.exists(source):
        print(f"Source file not found: {source}")
        print("Please run 01_create_zim.py first.")
        return
    
    print("\n" + "=" * 60)
    print("Example: Modifying Article Content")
    print("=" * 60)
    
    editor = ZIMEditor(source)
    
    # Modify the main page
    new_main_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Modified Wiki - Home</title>
    <link rel="stylesheet" href="../S/style.css">
</head>
<body>
    <header>
        <h1>🎉 Modified Wiki</h1>
        <p class="subtitle">This page was modified using ZIMEditor!</p>
    </header>
    <nav>
        <ul>
            <li><a href="Python">Python</a></li>
            <li><a href="JavaScript">JavaScript</a></li>
            <li><a href="NewArticle">New Article</a></li>
            <li><a href="About">About</a></li>
        </ul>
    </nav>
    <main>
        <p>Welcome to the <strong>modified</strong> version of the wiki.</p>
        <p>Changes made:</p>
        <ul>
            <li>Updated main page design</li>
            <li>Added new article</li>
            <li>Modified Python article</li>
        </ul>
        <p>Last modified: """ + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + """</p>
    </main>
</body>
</html>"""
    
    editor.modify_article("A/Main_Page", new_main_content.encode('utf-8'))
    
    # Use find/replace on Python article
    editor.find_and_replace(
        "A/Python",
        "high-level, general-purpose programming language",
        "powerful, versatile, and beginner-friendly programming language"
    )
    
    # Add a new article
    new_article_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>New Article</title>
    <link rel="stylesheet" href="../S/style.css">
</head>
<body>
    <header>
        <h1>New Article</h1>
    </header>
    <main>
        <p>This article was added during the editing process.</p>
        <p>It demonstrates the ability to add new content to existing ZIM archives.</p>
        
        <h2>How It Works</h2>
        <ol>
            <li>Read the original ZIM file</li>
            <li>Queue modifications in memory</li>
            <li>Write a new ZIM file with changes</li>
        </ol>
        
        <p><a href="Main_Page">← Back to Home</a></p>
    </main>
</body>
</html>"""
    
    editor.add_article(
        Namespace.MAIN_ARTICLE,
        "NewArticle",
        "New Article",
        new_article_content.encode('utf-8'),
        "text/html"
    )
    
    # Add a redirect
    editor.add_redirect(
        Namespace.MAIN_ARTICLE,
        "New",
        "New",
        "NewArticle"
    )
    
    # Save the modified ZIM
    editor.save(output)
    
    return output


def example_batch_modifications():
    """
    Example: Apply batch modifications to multiple articles.
    """
    source = "simple_wiki.zim"
    output = "batch_modified_wiki.zim"
    
    if not os.path.exists(source):
        print(f"Source file not found: {source}")
        return
    
    print("\n" + "=" * 60)
    print("Example: Batch Modifications")
    print("=" * 60)
    
    editor = ZIMEditor(source)
    
    # Add footer to all HTML articles
    with ZIMReader(source) as reader:
        for entry in reader.directory_entries:
            if isinstance(entry, DirectoryEntry):
                path = f"{chr(entry.namespace)}/{entry.url}"
                
                # Only modify HTML articles
                mime_idx = entry.mimetype_index
                if mime_idx < len(reader.mime_types):
                    mime = reader.mime_types[mime_idx]
                    if 'html' in mime:
                        content = reader.get_article_content(entry)
                        text = content.decode('utf-8', errors='replace')
                        
                        # Add modification timestamp before </body>
                        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        footer = f'\n<div class="batch-footer">Batch processed: {timestamp}</div>\n'
                        
                        if '</body>' in text:
                            text = text.replace('</body>', footer + '</body>')
                            editor.modify_article(path, text.encode('utf-8'))
    
    editor.save(output)
    return output


def example_filter_content():
    """
    Example: Create a filtered version with only specific namespaces.
    """
    source = "simple_wiki.zim"
    output = "articles_only.zim"
    
    if not os.path.exists(source):
        print(f"Source file not found: {source}")
        return
    
    print("\n" + "=" * 60)
    print("Example: Filter Content (Articles Only)")
    print("=" * 60)
    
    editor = ZIMEditor(source)
    
    # Exclude non-article content
    with ZIMReader(source) as reader:
        for entry in reader.directory_entries:
            if entry.namespace != Namespace.MAIN_ARTICLE:
                path = f"{chr(entry.namespace)}/{entry.url}"
                editor.delete_article(path)
    
    editor.save(output)
    return output


def verify_modifications(original: str, modified: str):
    """
    Compare original and modified ZIM files.
    """
    print("\n" + "=" * 60)
    print("Verification: Comparing Files")
    print("=" * 60)
    
    if not os.path.exists(original) or not os.path.exists(modified):
        print("One or both files not found.")
        return
    
    with ZIMReader(original) as orig:
        with ZIMReader(modified) as mod:
            print("\n  Comparison:")
            print(f"  {'Metric':<25} {'Original':<15} {'Modified':<15}")
            print(f"  {'-'*23:<25} {'-'*13:<15} {'-'*13:<15}")
            
            print(f"  {'Entry Count':<25} {orig.header.entry_count:<15} {mod.header.entry_count:<15}")
            print(f"  {'Article Count':<25} {orig.header.article_count:<15} {mod.header.article_count:<15}")
            print(f"  {'Cluster Count':<25} {orig.header.cluster_count:<15} {mod.header.cluster_count:<15}")
            print(f"  {'MIME Types':<25} {len(orig.mime_types):<15} {len(mod.mime_types):<15}")


def main():
    """Main function running all editing examples."""
    print("=" * 60)
    print("ZIM File Editing Examples")
    print("=" * 60)
    
    # Check for source file
    if not os.path.exists("simple_wiki.zim"):
        print("\n⚠️  Source file 'simple_wiki.zim' not found.")
        print("   Please run 01_create_zim.py first to create a test file.")
        return
    
    # Run examples
    modified = example_modify_content()
    
    if modified:
        verify_modifications("simple_wiki.zim", modified)
    
    example_batch_modifications()
    example_filter_content()
    
    print("\n" + "=" * 60)
    print("Editing examples completed!")
    print("=" * 60)


if __name__ == "__main__":
    main()

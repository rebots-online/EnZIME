#!/usr/bin/env python3
"""
Example: Creating a ZIM file from scratch

This example demonstrates how to create a new ZIM archive containing
multiple articles, images, and redirects. It covers:
- Initializing a ZIMWriter
- Adding articles with different MIME types
- Adding redirects
- Setting the main page
- Finalizing and saving the ZIM file

Author: Clean-room ZIM Library
License: MIT
"""

import sys
import os

# Add parent directory to path for importing zimlib
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from zimlib import ZIMWriter, Namespace


def create_simple_zim():
    """
    Create a simple ZIM file with a few HTML articles.
    """
    output_file = "simple_wiki.zim"
    
    print(f"Creating ZIM file: {output_file}")
    print("-" * 50)
    
    # Initialize writer with context manager
    with ZIMWriter(output_file) as writer:
        
        # Article 1: Main Page (Home)
        main_page_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Welcome to My Wiki</title>
    <link rel="stylesheet" href="../S/style.css">
</head>
<body>
    <header>
        <h1>Welcome to My Wiki</h1>
    </header>
    <nav>
        <ul>
            <li><a href="Python">Python</a></li>
            <li><a href="JavaScript">JavaScript</a></li>
            <li><a href="About">About</a></li>
        </ul>
    </nav>
    <main>
        <p>This is a sample ZIM archive created with the clean-room ZIM library.</p>
        <p>Browse the articles using the navigation above.</p>
    </main>
    <footer>
        <p>&copy; 2024 My Wiki</p>
    </footer>
</body>
</html>"""
        
        writer.add_article(
            namespace=Namespace.MAIN_ARTICLE,
            url="Main_Page",
            title="Welcome to My Wiki",
            content=main_page_content.encode('utf-8'),
            mime_type="text/html"
        )
        print("✓ Added: Main_Page")
        
        # Article 2: Python article
        python_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Python Programming Language</title>
    <link rel="stylesheet" href="../S/style.css">
</head>
<body>
    <header>
        <h1>Python</h1>
    </header>
    <main>
        <p>Python is a high-level, general-purpose programming language.</p>
        
        <h2>History</h2>
        <p>Python was conceived in the late 1980s by Guido van Rossum.</p>
        
        <h2>Features</h2>
        <ul>
            <li>Easy to learn syntax</li>
            <li>Dynamic typing</li>
            <li>Extensive standard library</li>
            <li>Cross-platform compatibility</li>
        </ul>
        
        <h2>Example Code</h2>
        <pre><code>
def hello_world():
    print("Hello, World!")

if __name__ == "__main__":
    hello_world()
        </code></pre>
        
        <p><a href="Main_Page">← Back to Home</a></p>
    </main>
</body>
</html>"""
        
        writer.add_article(
            namespace=Namespace.MAIN_ARTICLE,
            url="Python",
            title="Python Programming Language",
            content=python_content.encode('utf-8'),
            mime_type="text/html"
        )
        print("✓ Added: Python")
        
        # Article 3: JavaScript article
        javascript_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>JavaScript Programming Language</title>
    <link rel="stylesheet" href="../S/style.css">
</head>
<body>
    <header>
        <h1>JavaScript</h1>
    </header>
    <main>
        <p>JavaScript is a programming language that is one of the core 
        technologies of the World Wide Web.</p>
        
        <h2>Features</h2>
        <ul>
            <li>Event-driven programming</li>
            <li>First-class functions</li>
            <li>Prototype-based objects</li>
            <li>Runs in browsers and Node.js</li>
        </ul>
        
        <h2>Example Code</h2>
        <pre><code>
function helloWorld() {
    console.log("Hello, World!");
}

helloWorld();
        </code></pre>
        
        <p><a href="Main_Page">← Back to Home</a></p>
    </main>
</body>
</html>"""
        
        writer.add_article(
            namespace=Namespace.MAIN_ARTICLE,
            url="JavaScript",
            title="JavaScript Programming Language",
            content=javascript_content.encode('utf-8'),
            mime_type="text/html"
        )
        print("✓ Added: JavaScript")
        
        # Article 4: About page
        about_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>About This Wiki</title>
    <link rel="stylesheet" href="../S/style.css">
</head>
<body>
    <header>
        <h1>About</h1>
    </header>
    <main>
        <p>This wiki was created as a demonstration of the clean-room 
        ZIM library implementation.</p>
        
        <h2>What is ZIM?</h2>
        <p>ZIM is an open file format that stores website content for 
        offline usage. It is primarily used by the Kiwix project to 
        distribute Wikipedia and other web content.</p>
        
        <h2>Features of this Library</h2>
        <ul>
            <li>Pure Python implementation</li>
            <li>No external dependencies</li>
            <li>Clean-room design</li>
            <li>MIT licensed</li>
        </ul>
        
        <p><a href="Main_Page">← Back to Home</a></p>
    </main>
</body>
</html>"""
        
        writer.add_article(
            namespace=Namespace.MAIN_ARTICLE,
            url="About",
            title="About This Wiki",
            content=about_content.encode('utf-8'),
            mime_type="text/html"
        )
        print("✓ Added: About")
        
        # Add CSS stylesheet
        css_content = """/* Wiki Stylesheet */
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    color: #333;
    background-color: #f5f5f5;
}

header {
    background: #2c3e50;
    color: white;
    padding: 20px;
    margin: -20px -20px 20px -20px;
}

header h1 {
    margin: 0;
}

nav ul {
    list-style: none;
    padding: 0;
    display: flex;
    gap: 20px;
    background: #34495e;
    margin: -20px -20px 20px -20px;
    padding: 10px 20px;
}

nav a {
    color: white;
    text-decoration: none;
}

nav a:hover {
    text-decoration: underline;
}

main {
    background: white;
    padding: 20px;
    border-radius: 5px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

pre {
    background: #f8f8f8;
    border: 1px solid #ddd;
    border-radius: 3px;
    padding: 15px;
    overflow-x: auto;
}

code {
    font-family: 'Consolas', 'Monaco', monospace;
}

footer {
    text-align: center;
    margin-top: 20px;
    color: #666;
}

a {
    color: #3498db;
}
"""
        
        writer.add_article(
            namespace=Namespace.STYLE,
            url="style.css",
            title="Main Stylesheet",
            content=css_content.encode('utf-8'),
            mime_type="text/css"
        )
        print("✓ Added: style.css (stylesheet)")
        
        # Add some redirects
        # "Home" redirects to "Main_Page"
        writer.add_redirect(
            namespace=Namespace.MAIN_ARTICLE,
            url="Home",
            title="Home",
            redirect_index=0  # Index of Main_Page
        )
        print("✓ Added redirect: Home → Main_Page")
        
        # "JS" redirects to "JavaScript"
        writer.add_redirect(
            namespace=Namespace.MAIN_ARTICLE,
            url="JS",
            title="JS",
            redirect_index=2  # Index of JavaScript
        )
        print("✓ Added redirect: JS → JavaScript")
        
        # Set main page index
        writer.main_page_index = 0
        
        # Finalize is called automatically by context manager
        print("-" * 50)
        print(f"✓ ZIM file created successfully: {output_file}")
    
    # Verify file was created
    if os.path.exists(output_file):
        file_size = os.path.getsize(output_file)
        print(f"  File size: {file_size:,} bytes")
    
    return output_file


def create_advanced_zim():
    """
    Create a more complex ZIM file with metadata and multiple content types.
    """
    output_file = "advanced_wiki.zim"
    
    print(f"\nCreating advanced ZIM file: {output_file}")
    print("-" * 50)
    
    with ZIMWriter(output_file) as writer:
        
        # Add metadata entries
        metadata_entries = [
            ("Title", "Advanced Wiki Example"),
            ("Description", "A demonstration of ZIM file creation"),
            ("Creator", "Clean-room ZIM Library"),
            ("Publisher", "Example Publisher"),
            ("Date", "2024-01-01"),
            ("Language", "eng"),
        ]
        
        for name, value in metadata_entries:
            writer.add_article(
                namespace=Namespace.METADATA,
                url=name,
                title=name,
                content=value.encode('utf-8'),
                mime_type="text/plain"
            )
            print(f"✓ Added metadata: {name} = {value}")
        
        # Add main content
        main_content = """<!DOCTYPE html>
<html>
<head><title>Advanced Example</title></head>
<body>
<h1>Advanced ZIM Example</h1>
<p>This ZIM file includes metadata and multiple content types.</p>
</body>
</html>"""
        
        writer.add_article(
            namespace=Namespace.MAIN_ARTICLE,
            url="Main_Page",
            title="Advanced Example",
            content=main_content.encode('utf-8'),
            mime_type="text/html"
        )
        print("✓ Added: Main_Page")
        
        # Add JSON data
        json_data = """{
    "name": "Advanced Wiki",
    "version": "1.0",
    "articles": 1,
    "features": ["metadata", "json", "multiple-types"]
}"""
        
        writer.add_article(
            namespace=Namespace.RAW_DATA,
            url="manifest.json",
            title="Manifest",
            content=json_data.encode('utf-8'),
            mime_type="application/json"
        )
        print("✓ Added: manifest.json")
        
        writer.main_page_index = len(metadata_entries)  # After metadata
        
        print("-" * 50)
        print(f"✓ Advanced ZIM file created: {output_file}")
    
    return output_file


if __name__ == "__main__":
    print("=" * 60)
    print("ZIM File Creation Examples")
    print("=" * 60)
    
    # Create simple ZIM
    simple_file = create_simple_zim()
    
    # Create advanced ZIM
    advanced_file = create_advanced_zim()
    
    print("\n" + "=" * 60)
    print("Examples completed!")
    print(f"Created files: {simple_file}, {advanced_file}")
    print("=" * 60)

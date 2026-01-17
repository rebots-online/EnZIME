/**
 * Example: Creating a ZIM file from scratch (TypeScript/Node.js)
 * 
 * This example demonstrates how to create a new ZIM archive containing
 * multiple articles, stylesheets, and redirects.
 * 
 * Requirements:
 * - Node.js 14+
 * - @types/node installed
 * 
 * Run: npx ts-node 01_create_zim.ts
 * Or compile and run: tsc 01_create_zim.ts && node 01_create_zim.js
 */

import { ZIMWriter, Namespace } from '../../zimlib';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Create a simple wiki ZIM file with multiple articles.
 */
function createSimpleWiki(): string {
    const outputFile = 'simple_wiki.zim';
    
    console.log(`Creating ZIM file: ${outputFile}`);
    console.log('-'.repeat(50));
    
    const writer = new ZIMWriter(outputFile);
    writer.create();
    
    // Article 1: Main Page
    const mainPageContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Welcome to TypeScript Wiki</title>
    <link rel="stylesheet" href="../S/style.css">
</head>
<body>
    <header>
        <h1>Welcome to TypeScript Wiki</h1>
    </header>
    <nav>
        <ul>
            <li><a href="TypeScript">TypeScript</a></li>
            <li><a href="NodeJS">Node.js</a></li>
            <li><a href="React">React</a></li>
        </ul>
    </nav>
    <main>
        <p>This ZIM archive was created using the TypeScript ZIM library.</p>
        <p>Explore the articles using the navigation above.</p>
    </main>
</body>
</html>`;
    
    writer.addArticle(
        Namespace.MAIN_ARTICLE,
        'Main_Page',
        'Welcome to TypeScript Wiki',
        Buffer.from(mainPageContent, 'utf-8'),
        'text/html'
    );
    console.log('✓ Added: Main_Page');
    
    // Article 2: TypeScript
    const typescriptContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>TypeScript</title>
    <link rel="stylesheet" href="../S/style.css">
</head>
<body>
    <header>
        <h1>TypeScript</h1>
    </header>
    <main>
        <p>TypeScript is a strongly typed programming language that builds on JavaScript.</p>
        
        <h2>Features</h2>
        <ul>
            <li>Static type checking</li>
            <li>Enhanced IDE support</li>
            <li>ECMAScript compatibility</li>
            <li>Object-oriented features</li>
        </ul>
        
        <h2>Example Code</h2>
        <pre><code>
interface User {
    name: string;
    age: number;
}

function greet(user: User): string {
    return \`Hello, \${user.name}!\`;
}

const user: User = { name: 'Alice', age: 30 };
console.log(greet(user));
        </code></pre>
        
        <p><a href="Main_Page">← Back to Home</a></p>
    </main>
</body>
</html>`;
    
    writer.addArticle(
        Namespace.MAIN_ARTICLE,
        'TypeScript',
        'TypeScript Programming Language',
        Buffer.from(typescriptContent, 'utf-8'),
        'text/html'
    );
    console.log('✓ Added: TypeScript');
    
    // Article 3: Node.js
    const nodejsContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Node.js</title>
    <link rel="stylesheet" href="../S/style.css">
</head>
<body>
    <header>
        <h1>Node.js</h1>
    </header>
    <main>
        <p>Node.js is a JavaScript runtime built on Chrome's V8 engine.</p>
        
        <h2>Key Features</h2>
        <ul>
            <li>Asynchronous I/O</li>
            <li>Event-driven architecture</li>
            <li>NPM package ecosystem</li>
            <li>Cross-platform support</li>
        </ul>
        
        <h2>Example Code</h2>
        <pre><code>
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello from Node.js!');
});

server.listen(3000, () => {
    console.log('Server running at http://localhost:3000/');
});
        </code></pre>
        
        <p><a href="Main_Page">← Back to Home</a></p>
    </main>
</body>
</html>`;
    
    writer.addArticle(
        Namespace.MAIN_ARTICLE,
        'NodeJS',
        'Node.js Runtime',
        Buffer.from(nodejsContent, 'utf-8'),
        'text/html'
    );
    console.log('✓ Added: NodeJS');
    
    // Article 4: React
    const reactContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>React</title>
    <link rel="stylesheet" href="../S/style.css">
</head>
<body>
    <header>
        <h1>React</h1>
    </header>
    <main>
        <p>React is a JavaScript library for building user interfaces.</p>
        
        <h2>Core Concepts</h2>
        <ul>
            <li>Components</li>
            <li>Virtual DOM</li>
            <li>JSX syntax</li>
            <li>Hooks</li>
        </ul>
        
        <h2>Example Component</h2>
        <pre><code>
import React, { useState } from 'react';

function Counter() {
    const [count, setCount] = useState(0);
    
    return (
        &lt;div&gt;
            &lt;p&gt;Count: {count}&lt;/p&gt;
            &lt;button onClick={() => setCount(count + 1)}&gt;
                Increment
            &lt;/button&gt;
        &lt;/div&gt;
    );
}

export default Counter;
        </code></pre>
        
        <p><a href="Main_Page">← Back to Home</a></p>
    </main>
</body>
</html>`;
    
    writer.addArticle(
        Namespace.MAIN_ARTICLE,
        'React',
        'React JavaScript Library',
        Buffer.from(reactContent, 'utf-8'),
        'text/html'
    );
    console.log('✓ Added: React');
    
    // Add CSS stylesheet
    const cssContent = `/* TypeScript Wiki Stylesheet */
body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
    color: #1a1a2e;
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    min-height: 100vh;
}

header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 30px;
    margin: -20px -20px 20px -20px;
    border-radius: 0 0 10px 10px;
}

header h1 {
    margin: 0;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
}

nav ul {
    list-style: none;
    padding: 0;
    display: flex;
    gap: 20px;
    background: rgba(255,255,255,0.1);
    margin: -20px -20px 20px -20px;
    padding: 15px 20px;
}

nav a {
    color: white;
    text-decoration: none;
    padding: 8px 16px;
    background: rgba(255,255,255,0.2);
    border-radius: 5px;
    transition: background 0.3s;
}

nav a:hover {
    background: rgba(255,255,255,0.3);
}

main {
    background: white;
    padding: 30px;
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
}

pre {
    background: #2d2d2d;
    color: #f8f8f2;
    border-radius: 8px;
    padding: 20px;
    overflow-x: auto;
}

code {
    font-family: 'Fira Code', 'Consolas', monospace;
}

a {
    color: #667eea;
}

h2 {
    color: #764ba2;
    border-bottom: 2px solid #667eea;
    padding-bottom: 10px;
}

ul {
    padding-left: 20px;
}

li {
    margin: 8px 0;
}
`;
    
    writer.addArticle(
        Namespace.STYLE,
        'style.css',
        'Main Stylesheet',
        Buffer.from(cssContent, 'utf-8'),
        'text/css'
    );
    console.log('✓ Added: style.css');
    
    // Add redirects
    writer.addRedirect(Namespace.MAIN_ARTICLE, 'Home', 'Home', 0);
    console.log('✓ Added redirect: Home → Main_Page');
    
    writer.addRedirect(Namespace.MAIN_ARTICLE, 'TS', 'TS', 1);
    console.log('✓ Added redirect: TS → TypeScript');
    
    writer.addRedirect(Namespace.MAIN_ARTICLE, 'Node', 'Node', 2);
    console.log('✓ Added redirect: Node → NodeJS');
    
    // Finalize
    writer.finalize();
    writer.close();
    
    console.log('-'.repeat(50));
    console.log(`✓ ZIM file created: ${outputFile}`);
    
    // Show file size
    if (fs.existsSync(outputFile)) {
        const stats = fs.statSync(outputFile);
        console.log(`  File size: ${stats.size.toLocaleString()} bytes`);
    }
    
    return outputFile;
}

/**
 * Create a ZIM file with JSON data and metadata.
 */
function createDataZim(): string {
    const outputFile = 'data_archive.zim';
    
    console.log(`\nCreating data ZIM file: ${outputFile}`);
    console.log('-'.repeat(50));
    
    const writer = new ZIMWriter(outputFile);
    writer.create();
    
    // Add metadata
    const metadata = {
        Title: 'Data Archive Example',
        Description: 'A ZIM file containing structured data',
        Creator: 'TypeScript ZIM Library',
        Date: new Date().toISOString().split('T')[0],
        Language: 'eng'
    };
    
    for (const [key, value] of Object.entries(metadata)) {
        writer.addArticle(
            Namespace.METADATA,
            key,
            key,
            Buffer.from(value, 'utf-8'),
            'text/plain'
        );
        console.log(`✓ Added metadata: ${key}`);
    }
    
    // Add JSON data
    const articlesData = {
        articles: [
            { id: 1, title: 'Introduction', category: 'basics' },
            { id: 2, title: 'Advanced Topics', category: 'advanced' },
            { id: 3, title: 'Best Practices', category: 'tips' }
        ],
        totalCount: 3,
        lastUpdated: new Date().toISOString()
    };
    
    writer.addArticle(
        Namespace.RAW_DATA,
        'articles.json',
        'Articles Index',
        Buffer.from(JSON.stringify(articlesData, null, 2), 'utf-8'),
        'application/json'
    );
    console.log('✓ Added: articles.json');
    
    // Add main page
    const mainContent = `<!DOCTYPE html>
<html>
<head><title>Data Archive</title></head>
<body>
<h1>Data Archive</h1>
<p>This ZIM contains structured data in JSON format.</p>
<p>See: <a href="../-/articles.json">articles.json</a></p>
</body>
</html>`;
    
    writer.addArticle(
        Namespace.MAIN_ARTICLE,
        'Main_Page',
        'Data Archive Home',
        Buffer.from(mainContent, 'utf-8'),
        'text/html'
    );
    console.log('✓ Added: Main_Page');
    
    writer.finalize();
    writer.close();
    
    console.log('-'.repeat(50));
    console.log(`✓ Data ZIM file created: ${outputFile}`);
    
    return outputFile;
}

// Main execution
console.log('='.repeat(60));
console.log('TypeScript ZIM File Creation Examples');
console.log('='.repeat(60));

const simpleFile = createSimpleWiki();
const dataFile = createDataZim();

console.log('\n' + '='.repeat(60));
console.log('Examples completed!');
console.log(`Created files: ${simpleFile}, ${dataFile}`);
console.log('='.repeat(60));

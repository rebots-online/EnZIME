// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

/**
 * Example: Reading a ZIM file (TypeScript/Node.js)
 * 
 * This example demonstrates how to read and extract content from ZIM archives.
 * 
 * Run: npx ts-node 02_read_zim.ts [path/to/file.zim]
 */

import { ZIMReader, DirectoryEntry, RedirectEntry, Entry } from '../../zimlib';
import * as fs from 'fs';

/**
 * Display ZIM file header information.
 */
function displayHeader(reader: ZIMReader): void {
    const header = reader.getHeader();
    if (!header) {
        console.log('No header available');
        return;
    }
    
    console.log('\n📋 HEADER INFORMATION');
    console.log('-'.repeat(40));
    console.log(`  Magic Number: 0x${header.magicNumber.toString(16).toUpperCase()}`);
    console.log(`  Version: ${header.majorVersion}.${header.minorVersion}`);
    console.log(`  Entry Count: ${header.entryCount.toLocaleString()}`);
    console.log(`  Article Count: ${header.articleCount.toLocaleString()}`);
    console.log(`  Cluster Count: ${header.clusterCount.toLocaleString()}`);
    console.log(`  Redirect Count: ${header.redirectCount.toLocaleString()}`);
    console.log(`  Main Page Index: ${header.mainPageIndex}`);
}

/**
 * Display MIME types in the ZIM file.
 */
function displayMimeTypes(reader: ZIMReader): void {
    const mimeTypes = reader.getMimeTypes();
    
    console.log('\n📄 MIME TYPES');
    console.log('-'.repeat(40));
    mimeTypes.forEach((mime, index) => {
        console.log(`  [${index}] ${mime}`);
    });
}

/**
 * Check if entry is a DirectoryEntry (type guard).
 */
function isDirectoryEntry(entry: Entry): entry is DirectoryEntry {
    return 'clusterNumber' in entry && 'blobNumber' in entry;
}

/**
 * Check if entry is a RedirectEntry (type guard).
 */
function isRedirectEntry(entry: Entry): entry is RedirectEntry {
    return 'redirectIndex' in entry;
}

/**
 * List all entries in the ZIM file.
 */
function listEntries(reader: ZIMReader, limit: number = 10): void {
    const articles = reader.listArticles();
    
    console.log('\n📚 ARTICLES');
    console.log('-'.repeat(40));
    console.log(`  Total articles: ${articles.length}`);
    
    articles.slice(0, limit).forEach((article, index) => {
        const namespace = String.fromCharCode(article.namespace);
        console.log(`\n  [${index}] [${namespace}] ${article.url}`);
        console.log(`       Title: ${article.title}`);
        console.log(`       Cluster: ${article.clusterNumber}, Blob: ${article.blobNumber}`);
    });
    
    if (articles.length > limit) {
        console.log(`\n  ... and ${articles.length - limit} more articles`);
    }
}

/**
 * Read and display an article by path.
 */
function readArticleByPath(reader: ZIMReader, path: string): Buffer | null {
    console.log(`\n🔍 Reading: ${path}`);
    console.log('-'.repeat(40));
    
    const entry = reader.getEntryByPath(path);
    
    if (!entry) {
        console.log(`  ❌ Not found: ${path}`);
        return null;
    }
    
    const namespace = String.fromCharCode(entry.namespace);
    console.log(`  ✓ Found entry:`);
    console.log(`    Namespace: ${namespace}`);
    console.log(`    URL: ${entry.url}`);
    console.log(`    Title: ${entry.title}`);
    
    if (isDirectoryEntry(entry)) {
        console.log(`    Type: Article`);
        console.log(`    Cluster: ${entry.clusterNumber}`);
        console.log(`    Blob: ${entry.blobNumber}`);
        
        try {
            const content = reader.getArticleContent(entry);
            console.log(`    Content size: ${content.length.toLocaleString()} bytes`);
            
            // Preview content
            const preview = content.toString('utf-8').slice(0, 300);
            console.log(`\n    Preview:`);
            console.log('    ' + '-'.repeat(36));
            preview.split('\n').slice(0, 10).forEach(line => {
                console.log(`    | ${line.slice(0, 60)}`);
            });
            if (content.length > 300) {
                console.log('    | ...');
            }
            
            return content;
        } catch (error) {
            console.log(`    ❌ Error reading content: ${error}`);
            return null;
        }
    } else if (isRedirectEntry(entry)) {
        console.log(`    Type: Redirect`);
        console.log(`    Target index: ${entry.redirectIndex}`);
        return null;
    }
    
    return null;
}

/**
 * Display main page information.
 */
function displayMainPage(reader: ZIMReader): void {
    console.log('\n🏠 MAIN PAGE');
    console.log('-'.repeat(40));
    
    const mainPage = reader.getMainPage();
    
    if (!mainPage) {
        console.log('  No main page defined');
        return;
    }
    
    const namespace = String.fromCharCode(mainPage.namespace);
    console.log(`  URL: ${mainPage.url}`);
    console.log(`  Title: ${mainPage.title}`);
    console.log(`  Namespace: ${namespace}`);
    
    if (isDirectoryEntry(mainPage)) {
        try {
            const content = reader.getArticleContent(mainPage);
            console.log(`  Content size: ${content.length.toLocaleString()} bytes`);
        } catch (error) {
            console.log(`  Error reading content: ${error}`);
        }
    }
}

/**
 * Search for articles by keyword.
 */
function searchArticles(reader: ZIMReader, keyword: string): DirectoryEntry[] {
    console.log(`\n🔎 Searching for: "${keyword}"`);
    console.log('-'.repeat(40));
    
    const articles = reader.listArticles();
    const keywordLower = keyword.toLowerCase();
    
    const results = articles.filter(article => 
        article.url.toLowerCase().includes(keywordLower) ||
        article.title.toLowerCase().includes(keywordLower)
    );
    
    console.log(`  Found ${results.length} matches:`);
    
    results.slice(0, 5).forEach(article => {
        const namespace = String.fromCharCode(article.namespace);
        console.log(`  - [${namespace}] ${article.url} (${article.title})`);
    });
    
    if (results.length > 5) {
        console.log(`  ... and ${results.length - 5} more`);
    }
    
    return results;
}

/**
 * Analyze namespace distribution.
 */
function analyzeNamespaces(reader: ZIMReader): void {
    console.log('\n📊 NAMESPACE ANALYSIS');
    console.log('-'.repeat(40));
    
    const articles = reader.listArticles();
    const namespaceCount: Record<string, number> = {};
    
    articles.forEach(article => {
        const ns = String.fromCharCode(article.namespace);
        namespaceCount[ns] = (namespaceCount[ns] || 0) + 1;
    });
    
    const nsNames: Record<string, string> = {
        'A': 'Main Articles',
        'I': 'Images',
        'M': 'Metadata',
        '-': 'Raw Data',
        'S': 'Stylesheets',
        'J': 'Scripts',
        'T': 'Fonts'
    };
    
    console.log(`  ${'Namespace'.padEnd(20)} ${'Count'.padEnd(10)}`);
    console.log(`  ${'-'.repeat(18).padEnd(20)} ${'-'.repeat(8).padEnd(10)}`);
    
    Object.entries(namespaceCount)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([ns, count]) => {
            const name = nsNames[ns] || 'Unknown';
            console.log(`  ${`${ns} (${name})`.padEnd(20)} ${count.toString().padEnd(10)}`);
        });
}

/**
 * Main function.
 */
function main(): void {
    const args = process.argv.slice(2);
    let zimPath = args[0] || 'simple_wiki.zim';
    
    if (!fs.existsSync(zimPath)) {
        console.log(`File not found: ${zimPath}`);
        console.log('Please run 01_create_zim.ts first, or provide a ZIM file path.');
        console.log('\nUsage: npx ts-node 02_read_zim.ts [path/to/file.zim]');
        return;
    }
    
    console.log('='.repeat(60));
    console.log('TypeScript ZIM File Reading Examples');
    console.log('='.repeat(60));
    console.log(`\nReading: ${zimPath}`);
    
    const reader = new ZIMReader(zimPath);
    
    try {
        reader.open();
        
        displayHeader(reader);
        displayMimeTypes(reader);
        displayMainPage(reader);
        listEntries(reader);
        
        // Read specific articles
        readArticleByPath(reader, 'A/Main_Page');
        readArticleByPath(reader, 'A/TypeScript');
        
        // Search
        searchArticles(reader, 'script');
        
        // Analyze
        analyzeNamespaces(reader);
        
    } finally {
        reader.close();
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Reading examples completed!');
    console.log('='.repeat(60));
}

main();

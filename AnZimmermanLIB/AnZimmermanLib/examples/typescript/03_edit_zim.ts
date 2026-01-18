// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

/**
 * Example: Editing/Modifying ZIM files (TypeScript/Node.js)
 * 
 * Since ZIM files are immutable, editing involves reading the original,
 * applying modifications, and writing a new file.
 * 
 * Run: npx ts-node 03_edit_zim.ts
 */

import { ZIMReader, ZIMWriter, DirectoryEntry, RedirectEntry, Entry, Namespace } from '../../zimlib';
import * as fs from 'fs';

interface Modification {
    path: string;
    content: Buffer;
}

interface NewArticle {
    namespace: number;
    url: string;
    title: string;
    content: Buffer;
    mimeType: string;
}

interface NewRedirect {
    namespace: number;
    url: string;
    title: string;
    targetUrl: string;
}

/**
 * ZIM Editor class for modifying ZIM files.
 */
class ZIMEditor {
    private sourcePath: string;
    private modifications: Map<string, Buffer> = new Map();
    private newArticles: NewArticle[] = [];
    private newRedirects: NewRedirect[] = [];
    private excludedPaths: Set<string> = new Set();

    constructor(sourcePath: string) {
        this.sourcePath = sourcePath;
    }

    /**
     * Queue a content modification for an existing article.
     */
    modifyArticle(path: string, newContent: Buffer): void {
        this.modifications.set(path, newContent);
        console.log(`  📝 Queued modification: ${path}`);
    }

    /**
     * Queue an article for deletion.
     */
    deleteArticle(path: string): void {
        this.excludedPaths.add(path);
        console.log(`  🗑️  Queued deletion: ${path}`);
    }

    /**
     * Queue a new article to be added.
     */
    addArticle(namespace: number, url: string, title: string, 
               content: Buffer, mimeType: string = 'text/html'): void {
        this.newArticles.push({ namespace, url, title, content, mimeType });
        console.log(`  ➕ Queued new article: ${String.fromCharCode(namespace)}/${url}`);
    }

    /**
     * Queue a new redirect.
     */
    addRedirect(namespace: number, url: string, title: string, targetUrl: string): void {
        this.newRedirects.push({ namespace, url, title, targetUrl });
        console.log(`  ↪️  Queued redirect: ${String.fromCharCode(namespace)}/${url} → ${targetUrl}`);
    }

    /**
     * Find and replace text in an article.
     */
    findAndReplace(path: string, find: string, replace: string): void {
        const reader = new ZIMReader(this.sourcePath);
        reader.open();
        
        try {
            const entry = reader.getEntryByPath(path);
            if (entry && this.isDirectoryEntry(entry)) {
                const content = reader.getArticleContent(entry);
                const text = content.toString('utf-8');
                const newText = text.split(find).join(replace);
                const count = (text.match(new RegExp(find, 'g')) || []).length;
                this.modifications.set(path, Buffer.from(newText, 'utf-8'));
                console.log(`  🔄 Find/Replace in ${path}: ${count} occurrences`);
            }
        } finally {
            reader.close();
        }
    }

    /**
     * Type guard for DirectoryEntry.
     */
    private isDirectoryEntry(entry: Entry): entry is DirectoryEntry {
        return 'clusterNumber' in entry && 'blobNumber' in entry;
    }

    /**
     * Apply all modifications and save to a new ZIM file.
     */
    save(outputPath: string): void {
        console.log(`\n💾 Saving to: ${outputPath}`);
        console.log('-'.repeat(50));

        const reader = new ZIMReader(this.sourcePath);
        reader.open();

        const writer = new ZIMWriter(outputPath);
        writer.create();

        try {
            const urlToIndex: Map<string, number> = new Map();
            let currentIndex = 0;
            const mimeTypes = reader.getMimeTypes();

            // Copy existing entries with modifications
            const articles = reader.listArticles();
            
            for (const entry of articles) {
                const ns = String.fromCharCode(entry.namespace);
                const path = `${ns}/${entry.url}`;

                if (this.excludedPaths.has(path)) {
                    console.log(`  ⏭️  Skipped: ${path}`);
                    continue;
                }

                let content: Buffer;
                if (this.modifications.has(path)) {
                    content = this.modifications.get(path)!;
                    console.log(`  ✏️  Modified: ${path}`);
                } else {
                    content = reader.getArticleContent(entry);
                }

                const mimeType = entry.mimetypeIndex < mimeTypes.length 
                    ? mimeTypes[entry.mimetypeIndex] 
                    : 'application/octet-stream';

                writer.addArticle(
                    entry.namespace,
                    entry.url,
                    entry.title,
                    content,
                    mimeType
                );

                urlToIndex.set(path, currentIndex);
                currentIndex++;
            }

            // Add new articles
            for (const article of this.newArticles) {
                const path = `${String.fromCharCode(article.namespace)}/${article.url}`;
                writer.addArticle(
                    article.namespace,
                    article.url,
                    article.title,
                    article.content,
                    article.mimeType
                );
                urlToIndex.set(path, currentIndex);
                currentIndex++;
                console.log(`  ➕ Added: ${path}`);
            }

            // Add new redirects
            for (const redirect of this.newRedirects) {
                const targetPath = `${String.fromCharCode(redirect.namespace)}/${redirect.targetUrl}`;
                const targetIndex = urlToIndex.get(targetPath);
                
                if (targetIndex !== undefined) {
                    writer.addRedirect(
                        redirect.namespace,
                        redirect.url,
                        redirect.title,
                        targetIndex
                    );
                    console.log(`  ↪️  Added redirect: ${redirect.url}`);
                }
            }

            writer.finalize();

        } finally {
            reader.close();
            writer.close();
        }

        console.log('-'.repeat(50));
        console.log(`✅ Saved: ${outputPath}`);

        if (fs.existsSync(outputPath)) {
            const stats = fs.statSync(outputPath);
            console.log(`   Size: ${stats.size.toLocaleString()} bytes`);
        }
    }
}

/**
 * Example: Modify article content.
 */
function exampleModifyContent(): string {
    const source = 'simple_wiki.zim';
    const output = 'modified_wiki.zim';

    if (!fs.existsSync(source)) {
        console.log(`Source not found: ${source}`);
        return '';
    }

    console.log('\n' + '='.repeat(60));
    console.log('Example: Modifying Article Content');
    console.log('='.repeat(60));

    const editor = new ZIMEditor(source);

    // Modify main page
    const newMainContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Modified Wiki</title>
</head>
<body>
    <h1>🎉 Modified Wiki</h1>
    <p>This page was modified using ZIMEditor!</p>
    <p>Modified at: ${new Date().toISOString()}</p>
    <nav>
        <a href="TypeScript">TypeScript</a> |
        <a href="NewPage">New Page</a>
    </nav>
</body>
</html>`;

    editor.modifyArticle('A/Main_Page', Buffer.from(newMainContent, 'utf-8'));

    // Add a new article
    const newPageContent = `<!DOCTYPE html>
<html>
<head><title>New Page</title></head>
<body>
    <h1>New Page</h1>
    <p>This page was added during editing.</p>
    <a href="Main_Page">← Home</a>
</body>
</html>`;

    editor.addArticle(
        Namespace.MAIN_ARTICLE,
        'NewPage',
        'New Page',
        Buffer.from(newPageContent, 'utf-8'),
        'text/html'
    );

    // Add redirect
    editor.addRedirect(Namespace.MAIN_ARTICLE, 'New', 'New', 'NewPage');

    // Find and replace
    editor.findAndReplace('A/TypeScript', 'TypeScript', 'TypeScript™');

    editor.save(output);

    return output;
}

/**
 * Example: Filter content by namespace.
 */
function exampleFilterContent(): string {
    const source = 'simple_wiki.zim';
    const output = 'filtered_wiki.zim';

    if (!fs.existsSync(source)) {
        return '';
    }

    console.log('\n' + '='.repeat(60));
    console.log('Example: Filter Content');
    console.log('='.repeat(60));

    const editor = new ZIMEditor(source);
    const reader = new ZIMReader(source);
    reader.open();

    try {
        const articles = reader.listArticles();
        
        // Delete all non-main-article entries
        for (const article of articles) {
            if (article.namespace !== Namespace.MAIN_ARTICLE) {
                const path = `${String.fromCharCode(article.namespace)}/${article.url}`;
                editor.deleteArticle(path);
            }
        }
    } finally {
        reader.close();
    }

    editor.save(output);
    return output;
}

/**
 * Compare original and modified ZIM files.
 */
function compareFiles(original: string, modified: string): void {
    if (!fs.existsSync(original) || !fs.existsSync(modified)) {
        return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('Comparison');
    console.log('='.repeat(60));

    const origReader = new ZIMReader(original);
    const modReader = new ZIMReader(modified);

    origReader.open();
    modReader.open();

    try {
        const origHeader = origReader.getHeader()!;
        const modHeader = modReader.getHeader()!;

        console.log(`\n  ${'Metric'.padEnd(20)} ${'Original'.padEnd(12)} ${'Modified'.padEnd(12)}`);
        console.log(`  ${'-'.repeat(18).padEnd(20)} ${'-'.repeat(10).padEnd(12)} ${'-'.repeat(10).padEnd(12)}`);
        console.log(`  ${'Entries'.padEnd(20)} ${origHeader.entryCount.toString().padEnd(12)} ${modHeader.entryCount.toString().padEnd(12)}`);
        console.log(`  ${'Articles'.padEnd(20)} ${origHeader.articleCount.toString().padEnd(12)} ${modHeader.articleCount.toString().padEnd(12)}`);
        console.log(`  ${'Clusters'.padEnd(20)} ${origHeader.clusterCount.toString().padEnd(12)} ${modHeader.clusterCount.toString().padEnd(12)}`);

    } finally {
        origReader.close();
        modReader.close();
    }
}

// Main
console.log('='.repeat(60));
console.log('TypeScript ZIM Editing Examples');
console.log('='.repeat(60));

if (!fs.existsSync('simple_wiki.zim')) {
    console.log('\n⚠️  Source file not found. Run 01_create_zim.ts first.');
} else {
    const modified = exampleModifyContent();
    if (modified) {
        compareFiles('simple_wiki.zim', modified);
    }
    exampleFilterContent();
}

console.log('\n' + '='.repeat(60));
console.log('Editing examples completed!');
console.log('='.repeat(60));

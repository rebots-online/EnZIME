<?php

/*
 * Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
 * All rights reserved.
 * Unauthorized use without prior written consent is strictly prohibited.
 */

/**
 * Example: Editing/Modifying ZIM files (PHP)
 * 
 * Since ZIM files are immutable, editing involves reading the original,
 * applying modifications, and writing a new file.
 * 
 * Run: php 03_edit_zim.php
 */

require_once __DIR__ . '/../../zimlib.php';

/**
 * ZIM Editor class for modifying ZIM files.
 */
class ZIMEditor {
    private $sourcePath;
    private $modifications = array();
    private $newArticles = array();
    private $newRedirects = array();
    private $excludedPaths = array();
    
    public function __construct($sourcePath) {
        $this->sourcePath = $sourcePath;
    }
    
    /**
     * Queue a content modification.
     */
    public function modifyArticle($path, $newContent) {
        $this->modifications[$path] = $newContent;
        echo "  📝 Queued modification: $path\n";
    }
    
    /**
     * Queue an article for deletion.
     */
    public function deleteArticle($path) {
        $this->excludedPaths[$path] = true;
        echo "  🗑️  Queued deletion: $path\n";
    }
    
    /**
     * Queue a new article.
     */
    public function addArticle($namespace, $url, $title, $content, $mimeType = 'text/html') {
        $this->newArticles[] = array(
            'namespace' => $namespace,
            'url' => $url,
            'title' => $title,
            'content' => $content,
            'mimeType' => $mimeType
        );
        $ns = chr($namespace);
        echo "  ➕ Queued new article: $ns/$url\n";
    }
    
    /**
     * Queue a new redirect.
     */
    public function addRedirect($namespace, $url, $title, $targetUrl) {
        $this->newRedirects[] = array(
            'namespace' => $namespace,
            'url' => $url,
            'title' => $title,
            'targetUrl' => $targetUrl
        );
        $ns = chr($namespace);
        echo "  ↪️  Queued redirect: $ns/$url → $targetUrl\n";
    }
    
    /**
     * Find and replace text in an article.
     */
    public function findAndReplace($path, $find, $replace) {
        $reader = new ZIMReader($this->sourcePath);
        $reader->open();
        
        try {
            $entry = $reader->getEntryByPath($path);
            if ($entry && $entry instanceof ZIMDirectoryEntry) {
                $content = $reader->getArticleContent($entry);
                $count = substr_count($content, $find);
                $newContent = str_replace($find, $replace, $content);
                $this->modifications[$path] = $newContent;
                echo "  🔄 Find/Replace in $path: $count occurrences\n";
            }
        } finally {
            $reader->close();
        }
    }
    
    /**
     * Apply modifications and save.
     */
    public function save($outputPath) {
        echo "\n💾 Saving to: $outputPath\n";
        echo str_repeat('-', 50) . "\n";
        
        $reader = new ZIMReader($this->sourcePath);
        $reader->open();
        
        $writer = new ZIMWriter($outputPath);
        $writer->create();
        
        try {
            $urlToIndex = array();
            $currentIndex = 0;
            $mimeTypes = $reader->getMimeTypes();
            
            // Copy existing articles with modifications
            $articles = $reader->listArticles();
            
            foreach ($articles as $article) {
                $ns = chr($article->namespace);
                $path = "$ns/{$article->url}";
                
                // Skip excluded
                if (isset($this->excludedPaths[$path])) {
                    echo "  ⏭️  Skipped: $path\n";
                    continue;
                }
                
                // Get content (modified or original)
                if (isset($this->modifications[$path])) {
                    $content = $this->modifications[$path];
                    echo "  ✏️  Modified: $path\n";
                } else {
                    $content = $reader->getArticleContent($article);
                }
                
                // Get MIME type
                $mimeType = 'application/octet-stream';
                if ($article->mimetypeIndex < count($mimeTypes)) {
                    $mimeType = $mimeTypes[$article->mimetypeIndex];
                }
                
                $writer->addArticle(
                    $article->namespace,
                    $article->url,
                    $article->title,
                    $content,
                    $mimeType
                );
                
                $urlToIndex[$path] = $currentIndex;
                $currentIndex++;
            }
            
            // Add new articles
            foreach ($this->newArticles as $article) {
                $ns = chr($article['namespace']);
                $path = "$ns/{$article['url']}";
                
                $writer->addArticle(
                    $article['namespace'],
                    $article['url'],
                    $article['title'],
                    $article['content'],
                    $article['mimeType']
                );
                
                $urlToIndex[$path] = $currentIndex;
                $currentIndex++;
                echo "  ➕ Added: $path\n";
            }
            
            // Add new redirects
            foreach ($this->newRedirects as $redirect) {
                $ns = chr($redirect['namespace']);
                $targetPath = "$ns/{$redirect['targetUrl']}";
                
                if (isset($urlToIndex[$targetPath])) {
                    $writer->addRedirect(
                        $redirect['namespace'],
                        $redirect['url'],
                        $redirect['title'],
                        $urlToIndex[$targetPath]
                    );
                    echo "  ↪️  Added redirect: {$redirect['url']}\n";
                }
            }
            
            $writer->finalize();
            
        } finally {
            $reader->close();
            $writer->close();
        }
        
        echo str_repeat('-', 50) . "\n";
        echo "✅ Saved: $outputPath\n";
        
        if (file_exists($outputPath)) {
            $size = filesize($outputPath);
            echo "   Size: " . number_format($size) . " bytes\n";
        }
    }
}

/**
 * Example: Modify content.
 */
function exampleModifyContent() {
    $source = 'simple_wiki.zim';
    $output = 'modified_wiki.zim';
    
    if (!file_exists($source)) {
        echo "Source not found: $source\n";
        return '';
    }
    
    echo "\n" . str_repeat('=', 60) . "\n";
    echo "Example: Modifying Article Content\n";
    echo str_repeat('=', 60) . "\n";
    
    $editor = new ZIMEditor($source);
    
    // Modify main page
    $newMainContent = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Modified PHP Wiki</title>
</head>
<body>
    <h1>🎉 Modified PHP Wiki</h1>
    <p>This page was modified using ZIMEditor!</p>
    <p>Modified at: {$_SERVER['REQUEST_TIME_FLOAT']}</p>
    <nav>
        <a href="PHP">PHP</a> |
        <a href="NewPage">New Page</a>
    </nav>
</body>
</html>
HTML;
    
    $editor->modifyArticle('A/Main_Page', $newMainContent);
    
    // Add new article
    $newPageContent = <<<HTML
<!DOCTYPE html>
<html>
<head><title>New Page</title></head>
<body>
    <h1>New Page</h1>
    <p>This page was added during editing.</p>
    <a href="Main_Page">← Home</a>
</body>
</html>
HTML;
    
    $editor->addArticle(
        ZIMNamespace::MAIN_ARTICLE,
        'NewPage',
        'New Page',
        $newPageContent,
        'text/html'
    );
    
    // Add redirect
    $editor->addRedirect(ZIMNamespace::MAIN_ARTICLE, 'New', 'New', 'NewPage');
    
    // Find and replace
    $editor->findAndReplace('A/PHP', 'PHP', 'PHP™');
    
    $editor->save($output);
    
    return $output;
}

/**
 * Example: Filter content.
 */
function exampleFilterContent() {
    $source = 'simple_wiki.zim';
    $output = 'filtered_wiki.zim';
    
    if (!file_exists($source)) {
        return '';
    }
    
    echo "\n" . str_repeat('=', 60) . "\n";
    echo "Example: Filter Content\n";
    echo str_repeat('=', 60) . "\n";
    
    $editor = new ZIMEditor($source);
    $reader = new ZIMReader($source);
    $reader->open();
    
    try {
        $articles = $reader->listArticles();
        
        foreach ($articles as $article) {
            if ($article->namespace !== ZIMNamespace::MAIN_ARTICLE) {
                $ns = chr($article->namespace);
                $path = "$ns/{$article->url}";
                $editor->deleteArticle($path);
            }
        }
    } finally {
        $reader->close();
    }
    
    $editor->save($output);
    return $output;
}

/**
 * Compare files.
 */
function compareFiles($original, $modified) {
    if (!file_exists($original) || !file_exists($modified)) {
        return;
    }
    
    echo "\n" . str_repeat('=', 60) . "\n";
    echo "Comparison\n";
    echo str_repeat('=', 60) . "\n";
    
    $origReader = new ZIMReader($original);
    $modReader = new ZIMReader($modified);
    
    $origReader->open();
    $modReader->open();
    
    try {
        $origHeader = $origReader->getHeader();
        $modHeader = $modReader->getHeader();
        
        printf("\n  %-20s %-12s %-12s\n", 'Metric', 'Original', 'Modified');
        printf("  %-20s %-12s %-12s\n", str_repeat('-', 18), str_repeat('-', 10), str_repeat('-', 10));
        printf("  %-20s %-12d %-12d\n", 'Entries', $origHeader->entryCount, $modHeader->entryCount);
        printf("  %-20s %-12d %-12d\n", 'Articles', $origHeader->articleCount, $modHeader->articleCount);
        printf("  %-20s %-12d %-12d\n", 'Clusters', $origHeader->clusterCount, $modHeader->clusterCount);
        
    } finally {
        $origReader->close();
        $modReader->close();
    }
}

// Main
echo str_repeat('=', 60) . "\n";
echo "PHP ZIM Editing Examples\n";
echo str_repeat('=', 60) . "\n";

if (!file_exists('simple_wiki.zim')) {
    echo "\n⚠️  Source file not found. Run 01_create_zim.php first.\n";
} else {
    $modified = exampleModifyContent();
    if ($modified) {
        compareFiles('simple_wiki.zim', $modified);
    }
    exampleFilterContent();
}

echo "\n" . str_repeat('=', 60) . "\n";
echo "Editing examples completed!\n";
echo str_repeat('=', 60) . "\n";

?>

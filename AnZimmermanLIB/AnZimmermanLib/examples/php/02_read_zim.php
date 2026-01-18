<?php

/*
 * Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
 * All rights reserved.
 * Unauthorized use without prior written consent is strictly prohibited.
 */

/**
 * Example: Reading a ZIM file (PHP)
 * 
 * This example demonstrates how to read and extract content from ZIM archives.
 * 
 * Run: php 02_read_zim.php [path/to/file.zim]
 */

require_once __DIR__ . '/../../zimlib.php';

/**
 * Display ZIM header information.
 */
function displayHeader($reader) {
    $header = $reader->getHeader();
    
    echo "\n📋 HEADER INFORMATION\n";
    echo str_repeat('-', 40) . "\n";
    printf("  Magic Number: 0x%08X\n", $header->magicNumber);
    printf("  Version: %d.%d\n", $header->majorVersion, $header->minorVersion);
    printf("  Entry Count: %s\n", number_format($header->entryCount));
    printf("  Article Count: %s\n", number_format($header->articleCount));
    printf("  Cluster Count: %s\n", number_format($header->clusterCount));
    printf("  Redirect Count: %s\n", number_format($header->redirectCount));
    printf("  Main Page Index: %d\n", $header->mainPageIndex);
}

/**
 * Display MIME types.
 */
function displayMimeTypes($reader) {
    $mimeTypes = $reader->getMimeTypes();
    
    echo "\n📄 MIME TYPES\n";
    echo str_repeat('-', 40) . "\n";
    foreach ($mimeTypes as $index => $mime) {
        echo "  [$index] $mime\n";
    }
}

/**
 * List entries in the ZIM file.
 */
function listEntries($reader, $limit = 10) {
    $articles = $reader->listArticles();
    
    echo "\n📚 ARTICLES\n";
    echo str_repeat('-', 40) . "\n";
    printf("  Total articles: %d\n", count($articles));
    
    $count = 0;
    foreach ($articles as $article) {
        if ($count >= $limit) {
            $remaining = count($articles) - $limit;
            echo "\n  ... and $remaining more articles\n";
            break;
        }
        
        $ns = chr($article->namespace);
        echo "\n  [$count] [$ns] {$article->url}\n";
        echo "       Title: {$article->title}\n";
        echo "       Cluster: {$article->clusterNumber}, Blob: {$article->blobNumber}\n";
        $count++;
    }
}

/**
 * Read article by path.
 */
function readArticleByPath($reader, $path) {
    echo "\n🔍 Reading: $path\n";
    echo str_repeat('-', 40) . "\n";
    
    $entry = $reader->getEntryByPath($path);
    
    if ($entry === null) {
        echo "  ❌ Not found: $path\n";
        return null;
    }
    
    $ns = chr($entry->namespace);
    echo "  ✓ Found entry:\n";
    echo "    Namespace: $ns\n";
    echo "    URL: {$entry->url}\n";
    echo "    Title: {$entry->title}\n";
    
    if ($entry instanceof ZIMDirectoryEntry) {
        echo "    Type: Article\n";
        echo "    Cluster: {$entry->clusterNumber}\n";
        echo "    Blob: {$entry->blobNumber}\n";
        
        try {
            $content = $reader->getArticleContent($entry);
            $size = strlen($content);
            echo "    Content size: " . number_format($size) . " bytes\n";
            
            // Preview
            $preview = substr($content, 0, 300);
            echo "\n    Preview:\n";
            echo "    " . str_repeat('-', 36) . "\n";
            $lines = explode("\n", $preview);
            foreach (array_slice($lines, 0, 10) as $line) {
                echo "    | " . substr($line, 0, 60) . "\n";
            }
            if ($size > 300) {
                echo "    | ...\n";
            }
            
            return $content;
        } catch (Exception $e) {
            echo "    ❌ Error: " . $e->getMessage() . "\n";
            return null;
        }
    } elseif ($entry instanceof ZIMRedirectEntry) {
        echo "    Type: Redirect\n";
        echo "    Target index: {$entry->redirectIndex}\n";
        return null;
    }
    
    return null;
}

/**
 * Display main page.
 */
function displayMainPage($reader) {
    echo "\n🏠 MAIN PAGE\n";
    echo str_repeat('-', 40) . "\n";
    
    $mainPage = $reader->getMainPage();
    
    if ($mainPage === null) {
        echo "  No main page defined\n";
        return;
    }
    
    $ns = chr($mainPage->namespace);
    echo "  URL: {$mainPage->url}\n";
    echo "  Title: {$mainPage->title}\n";
    echo "  Namespace: $ns\n";
    
    if ($mainPage instanceof ZIMDirectoryEntry) {
        try {
            $content = $reader->getArticleContent($mainPage);
            echo "  Content size: " . number_format(strlen($content)) . " bytes\n";
        } catch (Exception $e) {
            echo "  Error: " . $e->getMessage() . "\n";
        }
    }
}

/**
 * Search articles.
 */
function searchArticles($reader, $keyword) {
    echo "\n🔎 Searching for: \"$keyword\"\n";
    echo str_repeat('-', 40) . "\n";
    
    $articles = $reader->listArticles();
    $keywordLower = strtolower($keyword);
    $results = array();
    
    foreach ($articles as $article) {
        if (stripos($article->url, $keywordLower) !== false ||
            stripos($article->title, $keywordLower) !== false) {
            $results[] = $article;
        }
    }
    
    echo "  Found " . count($results) . " matches:\n";
    
    $count = 0;
    foreach ($results as $article) {
        if ($count >= 5) {
            $remaining = count($results) - 5;
            echo "  ... and $remaining more\n";
            break;
        }
        $ns = chr($article->namespace);
        echo "  - [$ns] {$article->url} ({$article->title})\n";
        $count++;
    }
    
    return $results;
}

/**
 * Analyze namespaces.
 */
function analyzeNamespaces($reader) {
    echo "\n📊 NAMESPACE ANALYSIS\n";
    echo str_repeat('-', 40) . "\n";
    
    $articles = $reader->listArticles();
    $namespaceCounts = array();
    
    foreach ($articles as $article) {
        $ns = chr($article->namespace);
        if (!isset($namespaceCounts[$ns])) {
            $namespaceCounts[$ns] = 0;
        }
        $namespaceCounts[$ns]++;
    }
    
    $nsNames = array(
        'A' => 'Main Articles',
        'I' => 'Images',
        'M' => 'Metadata',
        '-' => 'Raw Data',
        'S' => 'Stylesheets',
        'J' => 'Scripts',
        'T' => 'Fonts'
    );
    
    printf("  %-20s %-10s\n", 'Namespace', 'Count');
    printf("  %-20s %-10s\n", str_repeat('-', 18), str_repeat('-', 8));
    
    ksort($namespaceCounts);
    foreach ($namespaceCounts as $ns => $count) {
        $name = isset($nsNames[$ns]) ? $nsNames[$ns] : 'Unknown';
        printf("  %-20s %-10d\n", "$ns ($name)", $count);
    }
}

// Main
$zimPath = isset($argv[1]) ? $argv[1] : 'simple_wiki.zim';

if (!file_exists($zimPath)) {
    echo "File not found: $zimPath\n";
    echo "Please run 01_create_zim.php first, or provide a ZIM file path.\n";
    echo "\nUsage: php 02_read_zim.php [path/to/file.zim]\n";
    exit(1);
}

echo str_repeat('=', 60) . "\n";
echo "PHP ZIM File Reading Examples\n";
echo str_repeat('=', 60) . "\n";
echo "\nReading: $zimPath\n";

$reader = new ZIMReader($zimPath);
$reader->open();

try {
    displayHeader($reader);
    displayMimeTypes($reader);
    displayMainPage($reader);
    listEntries($reader);
    
    readArticleByPath($reader, 'A/Main_Page');
    readArticleByPath($reader, 'A/PHP');
    
    searchArticles($reader, 'php');
    analyzeNamespaces($reader);
    
} finally {
    $reader->close();
}

echo "\n" . str_repeat('=', 60) . "\n";
echo "Reading examples completed!\n";
echo str_repeat('=', 60) . "\n";

?>

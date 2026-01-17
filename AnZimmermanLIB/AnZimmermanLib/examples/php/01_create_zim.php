<?php
/**
 * Example: Creating a ZIM file from scratch (PHP)
 * 
 * This example demonstrates how to create a new ZIM archive containing
 * multiple articles, stylesheets, and redirects.
 * 
 * Run: php 01_create_zim.php
 */

require_once __DIR__ . '/../../zimlib.php';

/**
 * Create a simple wiki ZIM file.
 */
function createSimpleWiki() {
    $outputFile = 'simple_wiki.zim';
    
    echo "Creating ZIM file: $outputFile\n";
    echo str_repeat('-', 50) . "\n";
    
    $writer = new ZIMWriter($outputFile);
    $writer->create();
    
    // Article 1: Main Page
    $mainPageContent = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Welcome to PHP Wiki</title>
    <link rel="stylesheet" href="../S/style.css">
</head>
<body>
    <header>
        <h1>Welcome to PHP Wiki</h1>
    </header>
    <nav>
        <ul>
            <li><a href="PHP">PHP</a></li>
            <li><a href="Laravel">Laravel</a></li>
            <li><a href="Symfony">Symfony</a></li>
        </ul>
    </nav>
    <main>
        <p>This ZIM archive was created using the PHP ZIM library.</p>
        <p>Explore the articles using the navigation above.</p>
    </main>
</body>
</html>
HTML;
    
    $writer->addArticle(
        ZIMNamespace::MAIN_ARTICLE,
        'Main_Page',
        'Welcome to PHP Wiki',
        $mainPageContent,
        'text/html'
    );
    echo "✓ Added: Main_Page\n";
    
    // Article 2: PHP
    $phpContent = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>PHP Programming Language</title>
    <link rel="stylesheet" href="../S/style.css">
</head>
<body>
    <header>
        <h1>PHP</h1>
    </header>
    <main>
        <p>PHP is a popular general-purpose scripting language especially suited for web development.</p>
        
        <h2>Features</h2>
        <ul>
            <li>Server-side scripting</li>
            <li>Cross-platform compatibility</li>
            <li>Database integration</li>
            <li>Large ecosystem</li>
        </ul>
        
        <h2>Example Code</h2>
        <pre><code>&lt;?php
function greet(\$name) {
    return "Hello, " . \$name . "!";
}

echo greet("World");
?&gt;</code></pre>
        
        <p><a href="Main_Page">← Back to Home</a></p>
    </main>
</body>
</html>
HTML;
    
    $writer->addArticle(
        ZIMNamespace::MAIN_ARTICLE,
        'PHP',
        'PHP Programming Language',
        $phpContent,
        'text/html'
    );
    echo "✓ Added: PHP\n";
    
    // Article 3: Laravel
    $laravelContent = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Laravel Framework</title>
    <link rel="stylesheet" href="../S/style.css">
</head>
<body>
    <header>
        <h1>Laravel</h1>
    </header>
    <main>
        <p>Laravel is a web application framework with expressive, elegant syntax.</p>
        
        <h2>Key Features</h2>
        <ul>
            <li>MVC architecture</li>
            <li>Eloquent ORM</li>
            <li>Blade templating</li>
            <li>Artisan CLI</li>
        </ul>
        
        <h2>Example Route</h2>
        <pre><code>Route::get('/hello/{name}', function (\$name) {
    return view('hello', ['name' => \$name]);
});</code></pre>
        
        <p><a href="Main_Page">← Back to Home</a></p>
    </main>
</body>
</html>
HTML;
    
    $writer->addArticle(
        ZIMNamespace::MAIN_ARTICLE,
        'Laravel',
        'Laravel Framework',
        $laravelContent,
        'text/html'
    );
    echo "✓ Added: Laravel\n";
    
    // Article 4: Symfony
    $symfonyContent = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Symfony Framework</title>
    <link rel="stylesheet" href="../S/style.css">
</head>
<body>
    <header>
        <h1>Symfony</h1>
    </header>
    <main>
        <p>Symfony is a set of reusable PHP components and a PHP framework for web projects.</p>
        
        <h2>Components</h2>
        <ul>
            <li>HttpFoundation</li>
            <li>Routing</li>
            <li>Console</li>
            <li>DependencyInjection</li>
        </ul>
        
        <p><a href="Main_Page">← Back to Home</a></p>
    </main>
</body>
</html>
HTML;
    
    $writer->addArticle(
        ZIMNamespace::MAIN_ARTICLE,
        'Symfony',
        'Symfony Framework',
        $symfonyContent,
        'text/html'
    );
    echo "✓ Added: Symfony\n";
    
    // Add CSS
    $cssContent = <<<CSS
/* PHP Wiki Stylesheet */
body {
    font-family: 'Segoe UI', Arial, sans-serif;
    line-height: 1.6;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    color: #333;
    background-color: #f4f4f9;
}

header {
    background: #4F5B93;
    color: white;
    padding: 20px;
    margin: -20px -20px 20px -20px;
}

header h1 { margin: 0; }

nav ul {
    list-style: none;
    padding: 0;
    display: flex;
    gap: 15px;
    background: #787CB5;
    margin: -20px -20px 20px -20px;
    padding: 10px 20px;
}

nav a {
    color: white;
    text-decoration: none;
}

main {
    background: white;
    padding: 20px;
    border-radius: 5px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

pre {
    background: #2d2d2d;
    color: #f8f8f2;
    padding: 15px;
    border-radius: 5px;
    overflow-x: auto;
}

a { color: #4F5B93; }
h2 { color: #4F5B93; border-bottom: 2px solid #787CB5; padding-bottom: 5px; }
CSS;
    
    $writer->addArticle(
        ZIMNamespace::STYLE,
        'style.css',
        'Main Stylesheet',
        $cssContent,
        'text/css'
    );
    echo "✓ Added: style.css\n";
    
    // Add redirects
    $writer->addRedirect(ZIMNamespace::MAIN_ARTICLE, 'Home', 'Home', 0);
    echo "✓ Added redirect: Home → Main_Page\n";
    
    // Finalize
    $writer->finalize();
    $writer->close();
    
    echo str_repeat('-', 50) . "\n";
    echo "✓ ZIM file created: $outputFile\n";
    
    if (file_exists($outputFile)) {
        $size = filesize($outputFile);
        echo "  File size: " . number_format($size) . " bytes\n";
    }
    
    return $outputFile;
}

/**
 * Create a ZIM with metadata.
 */
function createMetadataZim() {
    $outputFile = 'metadata_wiki.zim';
    
    echo "\nCreating metadata ZIM: $outputFile\n";
    echo str_repeat('-', 50) . "\n";
    
    $writer = new ZIMWriter($outputFile);
    $writer->create();
    
    // Add metadata
    $metadata = array(
        'Title' => 'PHP Wiki with Metadata',
        'Description' => 'A demonstration of ZIM metadata',
        'Creator' => 'PHP ZIM Library',
        'Publisher' => 'Example Publisher',
        'Date' => date('Y-m-d'),
        'Language' => 'eng'
    );
    
    foreach ($metadata as $key => $value) {
        $writer->addArticle(
            ZIMNamespace::METADATA,
            $key,
            $key,
            $value,
            'text/plain'
        );
        echo "✓ Added metadata: $key = $value\n";
    }
    
    // Main page
    $mainContent = <<<HTML
<!DOCTYPE html>
<html>
<head><title>Metadata Example</title></head>
<body>
<h1>ZIM with Metadata</h1>
<p>This ZIM file includes metadata entries.</p>
</body>
</html>
HTML;
    
    $writer->addArticle(
        ZIMNamespace::MAIN_ARTICLE,
        'Main_Page',
        'Metadata Example',
        $mainContent,
        'text/html'
    );
    echo "✓ Added: Main_Page\n";
    
    $writer->finalize();
    $writer->close();
    
    echo str_repeat('-', 50) . "\n";
    echo "✓ Metadata ZIM created: $outputFile\n";
    
    return $outputFile;
}

// Main
echo str_repeat('=', 60) . "\n";
echo "PHP ZIM File Creation Examples\n";
echo str_repeat('=', 60) . "\n";

$simpleFile = createSimpleWiki();
$metadataFile = createMetadataZim();

echo "\n" . str_repeat('=', 60) . "\n";
echo "Examples completed!\n";
echo "Created: $simpleFile, $metadataFile\n";
echo str_repeat('=', 60) . "\n";

?>

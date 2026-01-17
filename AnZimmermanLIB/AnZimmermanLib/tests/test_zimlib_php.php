<?php
/**
 * Unit Tests for zimlib.php
 * Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.
 * 
 * Run with: phpunit tests/test_zimlib_php.php
 */

declare(strict_types=1);

require_once __DIR__ . '/../zimlib.php';

use PHPUnit\Framework\TestCase;

class ZIMConstantsTest extends TestCase
{
    public function testZimMagic(): void
    {
        $this->assertEquals(72173914, ZIM_MAGIC);
    }

    public function testZimVersion(): void
    {
        $this->assertEquals(5, ZIM_VERSION);
    }
}

class MimeTypeTest extends TestCase
{
    public function testCommonMimeTypes(): void
    {
        $this->assertEquals('text/html', MimeType::HTML);
        $this->assertEquals('text/css', MimeType::CSS);
        $this->assertEquals('application/javascript', MimeType::JAVASCRIPT);
        $this->assertEquals('image/png', MimeType::PNG);
    }

    public function testFromExtension(): void
    {
        $this->assertEquals('text/html', MimeType::fromExtension('.html'));
        $this->assertEquals('text/css', MimeType::fromExtension('.css'));
        $this->assertEquals('image/png', MimeType::fromExtension('.png'));
    }
}

class CompressionTypeTest extends TestCase
{
    public function testCompressionTypes(): void
    {
        $this->assertEquals(0, CompressionType::NONE);
        $this->assertEquals(1, CompressionType::ZLIB);
        $this->assertEquals(2, CompressionType::BZIP2);
        $this->assertEquals(3, CompressionType::LZMA);
        $this->assertEquals(4, CompressionType::ZSTD);
    }
}

class DirectoryEntryTest extends TestCase
{
    public function testCreateContentEntry(): void
    {
        $entry = new DirectoryEntry([
            'namespace' => 'C',
            'url' => 'index.html',
            'title' => 'Home Page',
            'mimeType' => 'text/html',
            'clusterNumber' => 0,
            'blobNumber' => 0,
        ]);

        $this->assertEquals('C', $entry->namespace);
        $this->assertEquals('index.html', $entry->url);
        $this->assertEquals('Home Page', $entry->title);
    }

    public function testCreateRedirectEntry(): void
    {
        $entry = new DirectoryEntry([
            'namespace' => 'C',
            'url' => 'home',
            'title' => 'Home Redirect',
            'redirectIndex' => 0,
        ]);

        $this->assertEquals('C', $entry->namespace);
        $this->assertTrue($entry->isRedirect());
    }
}

class ClusterTest extends TestCase
{
    public function testCreateUncompressedCluster(): void
    {
        $cluster = new Cluster(CompressionType::NONE);
        $cluster->addBlob('Hello, World!');
        $cluster->addBlob('Another blob');

        $this->assertEquals(2, $cluster->getBlobCount());
    }

    public function testRetrieveBlobs(): void
    {
        $cluster = new Cluster(CompressionType::NONE);
        $cluster->addBlob('First blob');
        $cluster->addBlob('Second blob');

        $this->assertEquals('First blob', $cluster->getBlob(0));
        $this->assertEquals('Second blob', $cluster->getBlob(1));
    }
}

class ZIMWriterTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir() . '/zim-test-' . uniqid();
        mkdir($this->tempDir);
    }

    protected function tearDown(): void
    {
        array_map('unlink', glob($this->tempDir . '/*'));
        rmdir($this->tempDir);
    }

    public function testCreateMinimalZim(): void
    {
        $zimPath = $this->tempDir . '/test.zim';

        $writer = new ZIMWriter($zimPath);
        $writer->addArticle([
            'url' => 'index.html',
            'title' => 'Test',
            'content' => '<html><body>Hello</body></html>',
            'mimeType' => 'text/html',
        ]);
        $writer->setMainPage('index.html');
        $writer->finalize();

        $this->assertFileExists($zimPath);
        $this->assertGreaterThan(0, filesize($zimPath));

        // Verify magic number
        $handle = fopen($zimPath, 'rb');
        $magic = unpack('V', fread($handle, 4))[1];
        fclose($handle);
        $this->assertEquals(ZIM_MAGIC, $magic);
    }
}

class ZIMReaderTest extends TestCase
{
    private static string $tempDir;
    private static string $sampleZim;

    public static function setUpBeforeClass(): void
    {
        self::$tempDir = sys_get_temp_dir() . '/zim-test-' . uniqid();
        mkdir(self::$tempDir);
        self::$sampleZim = self::$tempDir . '/sample.zim';

        $writer = new ZIMWriter(self::$sampleZim);
        $writer->addArticle([
            'url' => 'index.html',
            'title' => 'Test Home',
            'content' => '<html><body><h1>Welcome</h1></body></html>',
            'mimeType' => 'text/html',
        ]);
        $writer->setMainPage('index.html');
        $writer->finalize();
    }

    public static function tearDownAfterClass(): void
    {
        array_map('unlink', glob(self::$tempDir . '/*'));
        rmdir(self::$tempDir);
    }

    public function testReadHeader(): void
    {
        $reader = new ZIMReader(self::$sampleZim);
        $header = $reader->getHeader();

        $this->assertEquals(ZIM_MAGIC, $header->magicNumber);
        $this->assertEquals(ZIM_VERSION, $header->majorVersion);
        $reader->close();
    }

    public function testReadArticleByUrl(): void
    {
        $reader = new ZIMReader(self::$sampleZim);
        $content = $reader->getArticleByUrl('index.html');
        $this->assertStringContainsString('Welcome', $content);
        $reader->close();
    }
}

class RoundTripTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir() . '/zim-test-' . uniqid();
        mkdir($this->tempDir);
    }

    protected function tearDown(): void
    {
        array_map('unlink', glob($this->tempDir . '/*'));
        rmdir($this->tempDir);
    }

    public function testRoundTripSimple(): void
    {
        $zimPath = $this->tempDir . '/roundtrip.zim';
        $original = '<html><body>Test content</body></html>';

        $writer = new ZIMWriter($zimPath);
        $writer->addArticle([
            'url' => 'test.html',
            'title' => 'Test',
            'content' => $original,
            'mimeType' => 'text/html',
        ]);
        $writer->setMainPage('test.html');
        $writer->finalize();

        $reader = new ZIMReader($zimPath);
        $read = $reader->getArticleByUrl('test.html');
        $reader->close();

        $this->assertEquals($original, $read);
    }
}

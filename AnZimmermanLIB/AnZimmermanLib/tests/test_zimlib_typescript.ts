// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

/**
 * Unit Tests for zimlib.ts
 * Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.
 * 
 * Run with: npx jest tests/test_zimlib_typescript.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  ZIMReader,
  ZIMWriter,
  ZIMHeader,
  DirectoryEntry,
  Cluster,
  MimeType,
  CompressionType,
  ZIM_MAGIC,
  ZIM_VERSION,
} from '../zimlib';

describe('ZIM Constants', () => {
  test('ZIM_MAGIC should be correct', () => {
    expect(ZIM_MAGIC).toBe(72173914);
  });

  test('ZIM_VERSION should be 5', () => {
    expect(ZIM_VERSION).toBe(5);
  });
});

describe('MimeType', () => {
  test('should have correct HTML MIME type', () => {
    expect(MimeType.HTML).toBe('text/html');
  });

  test('should have correct CSS MIME type', () => {
    expect(MimeType.CSS).toBe('text/css');
  });

  test('should have correct JavaScript MIME type', () => {
    expect(MimeType.JAVASCRIPT).toBe('application/javascript');
  });

  test('should have correct PNG MIME type', () => {
    expect(MimeType.PNG).toBe('image/png');
  });

  test('fromExtension should return correct types', () => {
    expect(MimeType.fromExtension('.html')).toBe('text/html');
    expect(MimeType.fromExtension('.css')).toBe('text/css');
    expect(MimeType.fromExtension('.js')).toBe('application/javascript');
    expect(MimeType.fromExtension('.png')).toBe('image/png');
    expect(MimeType.fromExtension('.jpg')).toBe('image/jpeg');
    expect(MimeType.fromExtension('.svg')).toBe('image/svg+xml');
  });
});

describe('CompressionType', () => {
  test('should have correct compression type values', () => {
    expect(CompressionType.NONE).toBe(0);
    expect(CompressionType.ZLIB).toBe(1);
    expect(CompressionType.BZIP2).toBe(2);
    expect(CompressionType.LZMA).toBe(3);
    expect(CompressionType.ZSTD).toBe(4);
  });
});

describe('DirectoryEntry', () => {
  test('should create content entry', () => {
    const entry = new DirectoryEntry({
      namespace: 'C',
      url: 'index.html',
      title: 'Home Page',
      mimeType: 'text/html',
      clusterNumber: 0,
      blobNumber: 0,
    });

    expect(entry.namespace).toBe('C');
    expect(entry.url).toBe('index.html');
    expect(entry.title).toBe('Home Page');
    expect(entry.mimeType).toBe('text/html');
  });

  test('should create redirect entry', () => {
    const entry = new DirectoryEntry({
      namespace: 'C',
      url: 'home',
      title: 'Home Redirect',
      redirectIndex: 0,
    });

    expect(entry.namespace).toBe('C');
    expect(entry.url).toBe('home');
    expect(entry.redirectIndex).toBe(0);
    expect(entry.isRedirect).toBe(true);
  });

  test('should serialize to bytes', () => {
    const entry = new DirectoryEntry({
      namespace: 'C',
      url: 'test.html',
      title: 'Test',
      mimeType: 'text/html',
      clusterNumber: 0,
      blobNumber: 0,
    });

    const data = entry.toBytes();
    expect(data).toBeInstanceOf(Buffer);
    expect(data.length).toBeGreaterThan(0);
  });
});

describe('Cluster', () => {
  test('should create uncompressed cluster', () => {
    const cluster = new Cluster(CompressionType.NONE);
    cluster.addBlob(Buffer.from('Hello, World!'));
    cluster.addBlob(Buffer.from('Another blob'));

    expect(cluster.blobCount).toBe(2);
    expect(cluster.compression).toBe(CompressionType.NONE);
  });

  test('should create ZLIB compressed cluster', () => {
    const cluster = new Cluster(CompressionType.ZLIB);
    const content = Buffer.from('Hello, World!'.repeat(100));
    cluster.addBlob(content);

    expect(cluster.blobCount).toBe(1);
    
    const data = cluster.toBytes();
    // Compressed should be smaller
    expect(data.length).toBeLessThan(content.length);
  });

  test('should retrieve blobs', () => {
    const cluster = new Cluster(CompressionType.NONE);
    const blob1 = Buffer.from('First blob');
    const blob2 = Buffer.from('Second blob');
    
    cluster.addBlob(blob1);
    cluster.addBlob(blob2);

    expect(cluster.getBlob(0)).toEqual(blob1);
    expect(cluster.getBlob(1)).toEqual(blob2);
  });
});

describe('ZIMWriter', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zim-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('should create minimal ZIM file', () => {
    const zimPath = path.join(tempDir, 'test.zim');
    
    const writer = new ZIMWriter(zimPath);
    writer.addArticle({
      url: 'index.html',
      title: 'Test Article',
      content: Buffer.from('<html><body>Hello</body></html>'),
      mimeType: 'text/html',
    });
    writer.setMainPage('index.html');
    writer.finalize();

    expect(fs.existsSync(zimPath)).toBe(true);
    expect(fs.statSync(zimPath).size).toBeGreaterThan(0);

    // Verify magic number
    const fd = fs.openSync(zimPath, 'r');
    const magicBuf = Buffer.alloc(4);
    fs.readSync(fd, magicBuf, 0, 4, 0);
    fs.closeSync(fd);
    expect(magicBuf.readUInt32LE(0)).toBe(ZIM_MAGIC);
  });

  test('should add multiple articles', () => {
    const zimPath = path.join(tempDir, 'multi.zim');
    
    const writer = new ZIMWriter(zimPath);
    
    for (let i = 0; i < 10; i++) {
      writer.addArticle({
        url: `article${i}.html`,
        title: `Article ${i}`,
        content: Buffer.from(`<html><body>Content ${i}</body></html>`),
        mimeType: 'text/html',
      });
    }
    
    writer.setMainPage('article0.html');
    writer.finalize();

    expect(fs.existsSync(zimPath)).toBe(true);
  });

  test('should add redirect', () => {
    const zimPath = path.join(tempDir, 'redirect.zim');
    
    const writer = new ZIMWriter(zimPath);
    writer.addArticle({
      url: 'index.html',
      title: 'Home',
      content: Buffer.from('<html><body>Home</body></html>'),
      mimeType: 'text/html',
    });
    writer.addRedirect({
      url: 'home',
      redirectUrl: 'index.html',
      title: 'Home Redirect',
    });
    writer.setMainPage('index.html');
    writer.finalize();

    expect(fs.existsSync(zimPath)).toBe(true);
  });
});

describe('ZIMReader', () => {
  let tempDir: string;
  let sampleZim: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zim-test-'));
    sampleZim = path.join(tempDir, 'sample.zim');

    const writer = new ZIMWriter(sampleZim);
    writer.addArticle({
      url: 'index.html',
      title: 'Test Home',
      content: Buffer.from('<html><body><h1>Welcome</h1></body></html>'),
      mimeType: 'text/html',
    });
    writer.addArticle({
      url: 'page2.html',
      title: 'Page Two',
      content: Buffer.from('<html><body><p>Second page</p></body></html>'),
      mimeType: 'text/html',
    });
    writer.addArticle({
      url: 'style.css',
      title: 'Stylesheet',
      content: Buffer.from('body { color: black; }'),
      mimeType: 'text/css',
    });
    writer.setMainPage('index.html');
    writer.finalize();
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('should read header', () => {
    const reader = new ZIMReader(sampleZim);
    const header = reader.header;

    expect(header.magicNumber).toBe(ZIM_MAGIC);
    expect(header.majorVersion).toBe(ZIM_VERSION);
    expect(header.articleCount).toBeGreaterThanOrEqual(3);

    reader.close();
  });

  test('should read article by URL', () => {
    const reader = new ZIMReader(sampleZim);
    
    const content = reader.getArticleByUrl('index.html');
    expect(content.toString()).toContain('Welcome');

    reader.close();
  });

  test('should read article by index', () => {
    const reader = new ZIMReader(sampleZim);
    
    const content = reader.getArticleByIndex(0);
    expect(content).not.toBeNull();
    expect(content.length).toBeGreaterThan(0);

    reader.close();
  });

  test('should list articles', () => {
    const reader = new ZIMReader(sampleZim);
    
    const articles = reader.listArticles();
    const urls = articles.map(a => a.url);
    
    expect(urls).toContain('index.html');
    expect(urls).toContain('page2.html');
    expect(urls).toContain('style.css');

    reader.close();
  });

  test('should get main page', () => {
    const reader = new ZIMReader(sampleZim);
    
    const mainUrl = reader.getMainPageUrl();
    expect(mainUrl).toBe('index.html');

    reader.close();
  });

  test('should search articles', () => {
    const reader = new ZIMReader(sampleZim);
    
    const results = reader.search('Page');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.title.includes('Page Two'))).toBe(true);

    reader.close();
  });
});

describe('Round Trip', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zim-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('should write and read simple content', () => {
    const zimPath = path.join(tempDir, 'roundtrip.zim');
    const originalContent = Buffer.from('<html><body>Test content here</body></html>');

    // Write
    const writer = new ZIMWriter(zimPath);
    writer.addArticle({
      url: 'test.html',
      title: 'Test',
      content: originalContent,
      mimeType: 'text/html',
    });
    writer.setMainPage('test.html');
    writer.finalize();

    // Read
    const reader = new ZIMReader(zimPath);
    const readContent = reader.getArticleByUrl('test.html');
    reader.close();

    expect(readContent).toEqual(originalContent);
  });

  test('should write and read compressed content', () => {
    const zimPath = path.join(tempDir, 'compressed.zim');
    const originalContent = Buffer.from('<p>Repeated content</p>'.repeat(1000));

    // Write with compression
    const writer = new ZIMWriter(zimPath, { compression: CompressionType.ZLIB });
    writer.addArticle({
      url: 'big.html',
      title: 'Big Page',
      content: originalContent,
      mimeType: 'text/html',
    });
    writer.setMainPage('big.html');
    writer.finalize();

    // Read
    const reader = new ZIMReader(zimPath);
    const readContent = reader.getArticleByUrl('big.html');
    reader.close();

    expect(readContent).toEqual(originalContent);
  });

  test('should write and read binary content', () => {
    const zimPath = path.join(tempDir, 'binary.zim');
    // PNG header + random bytes
    const binaryContent = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
      Buffer.from(Array.from({ length: 1000 }, () => Math.floor(Math.random() * 256)))
    ]);

    // Write
    const writer = new ZIMWriter(zimPath);
    writer.addArticle({
      url: 'image.png',
      title: 'Image',
      content: binaryContent,
      mimeType: 'image/png',
    });
    writer.addArticle({
      url: 'index.html',
      title: 'Home',
      content: Buffer.from('<img src="image.png">'),
      mimeType: 'text/html',
    });
    writer.setMainPage('index.html');
    writer.finalize();

    // Read
    const reader = new ZIMReader(zimPath);
    const readContent = reader.getArticleByUrl('image.png');
    reader.close();

    expect(readContent).toEqual(binaryContent);
  });
});

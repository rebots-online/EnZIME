// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

/**
 * Clean-room ZIM file format reader/writer for Browser/Chrome Extensions
 * 
 * Based on ZIM file format specification from openZIM
 * Adapted from zimlib.ts for browser environment
 * 
 * Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.
 */

export const CompressionType = {
  DEFAULT: 0,
  NONE: 1,
  ZLIB: 2,
  BZIP2: 3,
  LZMA: 4,
  ZSTD: 5
};

export const Namespace = {
  MAIN_ARTICLE: 'A'.charCodeAt(0),
  IMAGE: 'I'.charCodeAt(0),
  METADATA: 'M'.charCodeAt(0),
  RAW_DATA: '-'.charCodeAt(0),
  STYLE: 'S'.charCodeAt(0),
  SCRIPT: 'J'.charCodeAt(0),
  FONT: 'T'.charCodeAt(0),
  TRANSLATION: 'U'.charCodeAt(0),
  VIDEO: 'V'.charCodeAt(0),
  AUDIO: 'W'.charCodeAt(0)
};

// ZIM Magic Number
const ZIM_MAGIC = 0x4D495A5A;

/**
 * Binary reader for browser ArrayBuffer
 */
class BinaryReader {
  constructor(dataView, littleEndian = true) {
    this.dataView = dataView;
    this.position = 0;
    this.littleEndian = littleEndian;
  }

  readUInt8() {
    const value = this.dataView.getUint8(this.position);
    this.position += 1;
    return value;
  }

  readUInt16() {
    const value = this.dataView.getUint16(this.position, this.littleEndian);
    this.position += 2;
    return value;
  }

  readUInt32() {
    const value = this.dataView.getUint32(this.position, this.littleEndian);
    this.position += 4;
    return value;
  }

  readUInt64() {
    const low = this.dataView.getUint32(this.position, this.littleEndian);
    const high = this.dataView.getUint32(this.position + 4, this.littleEndian);
    this.position += 8;
    return BigInt(low) + (BigInt(high) << 32n);
  }

  readNullTerminatedString() {
    const bytes = [];
    while (this.position < this.dataView.byteLength) {
      const byte = this.dataView.getUint8(this.position++);
      if (byte === 0) break;
      bytes.push(byte);
    }
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  }

  readBytes(length) {
    const bytes = new Uint8Array(this.dataView.buffer, this.dataView.byteOffset + this.position, length);
    this.position += length;
    return bytes;
  }

  seek(position) {
    this.position = position;
  }

  getPosition() {
    return this.position;
  }
}

/**
 * Binary writer for browser ArrayBuffer
 */
class BinaryWriter {
  constructor(initialSize = 1024) {
    this.buffer = new ArrayBuffer(initialSize);
    this.dataView = new DataView(this.buffer);
    this.position = 0;
    this.littleEndian = true;
  }

  ensureCapacity(additionalBytes) {
    if (this.position + additionalBytes > this.buffer.byteLength) {
      const newSize = Math.max(this.buffer.byteLength * 2, this.position + additionalBytes);
      const newBuffer = new ArrayBuffer(newSize);
      new Uint8Array(newBuffer).set(new Uint8Array(this.buffer));
      this.buffer = newBuffer;
      this.dataView = new DataView(this.buffer);
    }
  }

  writeUInt8(value) {
    this.ensureCapacity(1);
    this.dataView.setUint8(this.position, value);
    this.position += 1;
  }

  writeUInt16(value) {
    this.ensureCapacity(2);
    this.dataView.setUint16(this.position, value, this.littleEndian);
    this.position += 2;
  }

  writeUInt32(value) {
    this.ensureCapacity(4);
    this.dataView.setUint32(this.position, value, this.littleEndian);
    this.position += 4;
  }

  writeUInt64(value) {
    this.ensureCapacity(8);
    const bigValue = BigInt(value);
    this.dataView.setUint32(this.position, Number(bigValue & 0xFFFFFFFFn), this.littleEndian);
    this.dataView.setUint32(this.position + 4, Number(bigValue >> 32n), this.littleEndian);
    this.position += 8;
  }

  writeNullTerminatedString(str) {
    const encoded = new TextEncoder().encode(str);
    this.ensureCapacity(encoded.length + 1);
    for (const byte of encoded) {
      this.dataView.setUint8(this.position++, byte);
    }
    this.dataView.setUint8(this.position++, 0);
  }

  writeBytes(bytes) {
    this.ensureCapacity(bytes.length);
    new Uint8Array(this.buffer, this.position, bytes.length).set(bytes);
    this.position += bytes.length;
  }

  getBuffer() {
    return this.buffer.slice(0, this.position);
  }

  getUint8Array() {
    return new Uint8Array(this.buffer, 0, this.position);
  }
}

/**
 * Browser-compatible ZIM Reader
 */
export class ZIMReaderBrowser {
  constructor(arrayBuffer) {
    this.arrayBuffer = arrayBuffer;
    this.header = null;
    this.mimeTypes = [];
    this.directoryEntries = [];
    this.clusterOffsets = [];
  }

  async open() {
    const dataView = new DataView(this.arrayBuffer);
    const reader = new BinaryReader(dataView);
    
    this.readHeader(reader);
    this.readMimeTypes(reader);
    this.readDirectory(reader);
    this.readClusterPointers(reader);
  }

  readHeader(reader) {
    this.header = {
      magicNumber: reader.readUInt32(),
      majorVersion: reader.readUInt16(),
      minorVersion: reader.readUInt16(),
      uuid: reader.readBytes(16),
      entryCount: reader.readUInt32(),
      clusterCount: reader.readUInt32(),
      urlPtrPos: reader.readUInt64(),
      titlePtrPos: reader.readUInt64(),
      clusterPtrPos: reader.readUInt64(),
      mimeListPos: reader.readUInt64(),
      mainPage: reader.readUInt32(),
      layoutPage: reader.readUInt32(),
      checksumPos: reader.readUInt64()
    };

    if (this.header.magicNumber !== ZIM_MAGIC) {
      throw new Error('Invalid ZIM file format');
    }
  }

  readMimeTypes(reader) {
    reader.seek(Number(this.header.mimeListPos));
    
    let prevByte = 1;
    while (reader.getPosition() < this.arrayBuffer.byteLength) {
      const mimeType = reader.readNullTerminatedString();
      if (mimeType.length === 0 && prevByte === 0) break;
      if (mimeType.length > 0) {
        this.mimeTypes.push(mimeType);
      }
      prevByte = mimeType.length === 0 ? 0 : 1;
    }
  }

  readDirectory(reader) {
    reader.seek(Number(this.header.urlPtrPos));
    
    const urlPointers = [];
    for (let i = 0; i < this.header.entryCount; i++) {
      urlPointers.push(reader.readUInt64());
    }

    for (const ptr of urlPointers) {
      reader.seek(Number(ptr));
      
      const mimetypeIndex = reader.readUInt16();
      const parameterLen = reader.readUInt8();
      const namespace = String.fromCharCode(reader.readUInt8());
      const revision = reader.readUInt32();

      if (mimetypeIndex === 0xFFFF) {
        const redirectIndex = reader.readUInt32();
        const url = reader.readNullTerminatedString();
        const title = reader.readNullTerminatedString();

        this.directoryEntries.push({
          type: 'redirect',
          mimetypeIndex,
          namespace,
          revision,
          redirectIndex,
          url,
          title
        });
      } else {
        const clusterNumber = reader.readUInt32();
        const blobNumber = reader.readUInt32();
        const url = reader.readNullTerminatedString();
        const title = reader.readNullTerminatedString();

        this.directoryEntries.push({
          type: 'article',
          mimetypeIndex,
          namespace,
          revision,
          clusterNumber,
          blobNumber,
          url,
          title,
          mimeType: this.mimeTypes[mimetypeIndex] || 'application/octet-stream'
        });
      }
    }
  }

  readClusterPointers(reader) {
    reader.seek(Number(this.header.clusterPtrPos));

    for (let i = 0; i < this.header.clusterCount; i++) {
      this.clusterOffsets.push(reader.readUInt64());
    }
  }

  getEntryByUrl(namespace, url) {
    return this.directoryEntries.find(entry => 
      entry.namespace === namespace && entry.url === url
    );
  }

  async getArticleContent(entry) {
    if (entry.type === 'redirect') {
      const target = this.directoryEntries[entry.redirectIndex];
      return this.getArticleContent(target);
    }

    const dataView = new DataView(this.arrayBuffer);
    const reader = new BinaryReader(dataView);

    const clusterOffset = Number(this.clusterOffsets[entry.clusterNumber]);
    reader.seek(clusterOffset);

    const compressionByte = reader.readUInt8();
    const isExtended = (compressionByte & 0x10) !== 0;
    const compression = compressionByte & 0x0F;

    // Read blob offsets
    const blobOffsets = [];
    const offsetSize = isExtended ? 8 : 4;
    
    // Read first offset to determine count
    const firstOffset = isExtended ? Number(reader.readUInt64()) : reader.readUInt32();
    const blobCount = firstOffset / offsetSize;
    blobOffsets.push(firstOffset);

    for (let i = 1; i < blobCount; i++) {
      blobOffsets.push(isExtended ? Number(reader.readUInt64()) : reader.readUInt32());
    }

    if (entry.blobNumber >= blobOffsets.length - 1) {
      throw new Error('Invalid blob number');
    }

    const dataStart = clusterOffset + 1; // After compression byte
    const blobStart = blobOffsets[entry.blobNumber];
    const blobEnd = blobOffsets[entry.blobNumber + 1];
    const blobSize = blobEnd - blobStart;

    reader.seek(dataStart + blobStart);
    let blobData = reader.readBytes(blobSize);

    // Decompress if needed
    if (compression === CompressionType.ZLIB) {
      blobData = await this.decompressZlib(blobData);
    }

    return blobData;
  }

  async decompressZlib(data) {
    // Use DecompressionStream API (modern browsers)
    if (typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('deflate');
      const writer = ds.writable.getWriter();
      writer.write(data);
      writer.close();
      
      const reader = ds.readable.getReader();
      const chunks = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      
      return result;
    }
    
    // Fallback: return as-is (uncompressed)
    console.warn('DecompressionStream not available, returning raw data');
    return data;
  }

  getMainPage() {
    if (this.header.mainPage < this.directoryEntries.length) {
      return this.directoryEntries[this.header.mainPage];
    }
    return null;
  }

  listArticles() {
    return this.directoryEntries.filter(entry => entry.type === 'article');
  }

  getMimeTypes() {
    return this.mimeTypes;
  }

  getHeader() {
    return this.header;
  }
}

/**
 * Browser-compatible ZIM Writer
 */
export class ZIMWriterBrowser {
  constructor() {
    this.mimeTypes = [];
    this.directoryEntries = [];
    this.clusters = [];
    this.mainPageIndex = 0xFFFFFFFF;
    this.uuid = this.generateUUID();
  }

  generateUUID() {
    const uuid = new Uint8Array(16);
    crypto.getRandomValues(uuid);
    return uuid;
  }

  addMimeType(mimeType) {
    const index = this.mimeTypes.indexOf(mimeType);
    if (index >= 0) return index;
    
    this.mimeTypes.push(mimeType);
    return this.mimeTypes.length - 1;
  }

  addArticle(namespace, url, title, mimeType, content) {
    const mimetypeIndex = this.addMimeType(mimeType);
    const clusterNumber = this.clusters.length;

    // Create cluster with single blob
    let contentBytes;
    if (typeof content === 'string') {
      contentBytes = new TextEncoder().encode(content);
    } else if (content instanceof Uint8Array) {
      contentBytes = content;
    } else if (content instanceof ArrayBuffer) {
      contentBytes = new Uint8Array(content);
    } else {
      contentBytes = new TextEncoder().encode(String(content));
    }

    const clusterData = this.createCluster([contentBytes], CompressionType.NONE);
    this.clusters.push(clusterData);

    const entry = {
      type: 'article',
      mimetypeIndex,
      namespace: namespace.charCodeAt(0),
      revision: 0,
      clusterNumber,
      blobNumber: 0,
      url,
      title: title || url
    };

    this.directoryEntries.push(entry);
    return this.directoryEntries.length - 1;
  }

  addRedirect(namespace, url, title, targetIndex) {
    const entry = {
      type: 'redirect',
      mimetypeIndex: 0xFFFF,
      namespace: namespace.charCodeAt(0),
      revision: 0,
      redirectIndex: targetIndex,
      url,
      title: title || url
    };

    this.directoryEntries.push(entry);
    return this.directoryEntries.length - 1;
  }

  setMainPage(index) {
    this.mainPageIndex = index;
  }

  createCluster(blobs, compression) {
    const writer = new BinaryWriter();
    
    // Compression byte (no extended offsets for simplicity)
    writer.writeUInt8(compression);

    // Calculate blob offsets
    let currentOffset = (blobs.length + 1) * 4; // Offset table size
    const offsets = [];
    
    for (const blob of blobs) {
      offsets.push(currentOffset);
      currentOffset += blob.length;
    }
    offsets.push(currentOffset); // End offset

    // Write offset table
    for (const offset of offsets) {
      writer.writeUInt32(offset);
    }

    // Write blob data
    for (const blob of blobs) {
      writer.writeBytes(blob);
    }

    return writer.getUint8Array();
  }

  finalize() {
    // Sort directory entries by namespace then URL
    const sortedEntries = [...this.directoryEntries].sort((a, b) => {
      if (a.namespace !== b.namespace) {
        return a.namespace - b.namespace;
      }
      return a.url.localeCompare(b.url);
    });

    const writer = new BinaryWriter();

    // Reserve space for header (80 bytes)
    const headerSize = 80;
    for (let i = 0; i < headerSize; i++) {
      writer.writeUInt8(0);
    }

    // Write MIME type list
    const mimeListPos = writer.position;
    for (const mimeType of this.mimeTypes) {
      writer.writeNullTerminatedString(mimeType);
    }
    writer.writeUInt8(0); // Empty string terminator

    // Calculate URL pointer positions
    const urlPtrPos = writer.position;
    const entryPositions = [];
    
    // Reserve space for URL pointers
    for (let i = 0; i < sortedEntries.length; i++) {
      writer.writeUInt64(0n);
    }

    // Write directory entries and track positions
    for (let i = 0; i < sortedEntries.length; i++) {
      entryPositions.push(writer.position);
      this.writeDirectoryEntry(writer, sortedEntries[i]);
    }

    // Write cluster pointers
    const clusterPtrPos = writer.position;
    let clusterDataStart = writer.position + this.clusters.length * 8;
    const clusterPositions = [];

    for (const cluster of this.clusters) {
      clusterPositions.push(clusterDataStart);
      clusterDataStart += cluster.length;
    }

    for (const pos of clusterPositions) {
      writer.writeUInt64(BigInt(pos));
    }

    // Write cluster data
    for (const cluster of this.clusters) {
      writer.writeBytes(cluster);
    }

    // Checksum position
    const checksumPos = writer.position;
    
    // Write placeholder checksum (16 bytes)
    for (let i = 0; i < 16; i++) {
      writer.writeUInt8(0);
    }

    // Now go back and write the header
    const finalBuffer = writer.getBuffer();
    const headerView = new DataView(finalBuffer);

    let pos = 0;
    
    // Magic number
    headerView.setUint32(pos, ZIM_MAGIC, true); pos += 4;
    
    // Version (major, minor)
    headerView.setUint16(pos, 5, true); pos += 2; // Major version
    headerView.setUint16(pos, 0, true); pos += 2; // Minor version
    
    // UUID
    new Uint8Array(finalBuffer, pos, 16).set(this.uuid);
    pos += 16;
    
    // Entry count
    headerView.setUint32(pos, sortedEntries.length, true); pos += 4;
    
    // Cluster count
    headerView.setUint32(pos, this.clusters.length, true); pos += 4;
    
    // URL pointer position
    this.writeUInt64ToView(headerView, pos, BigInt(urlPtrPos)); pos += 8;
    
    // Title pointer position (same as URL for now)
    this.writeUInt64ToView(headerView, pos, BigInt(urlPtrPos)); pos += 8;
    
    // Cluster pointer position
    this.writeUInt64ToView(headerView, pos, BigInt(clusterPtrPos)); pos += 8;
    
    // MIME list position
    this.writeUInt64ToView(headerView, pos, BigInt(mimeListPos)); pos += 8;
    
    // Main page
    headerView.setUint32(pos, this.mainPageIndex, true); pos += 4;
    
    // Layout page
    headerView.setUint32(pos, 0xFFFFFFFF, true); pos += 4;
    
    // Checksum position
    this.writeUInt64ToView(headerView, pos, BigInt(checksumPos)); pos += 8;

    // Go back and write URL pointers
    const ptrView = new DataView(finalBuffer, urlPtrPos);
    for (let i = 0; i < entryPositions.length; i++) {
      this.writeUInt64ToView(ptrView, i * 8, BigInt(entryPositions[i]));
    }

    return finalBuffer;
  }

  writeUInt64ToView(view, offset, value) {
    const bigValue = BigInt(value);
    view.setUint32(offset, Number(bigValue & 0xFFFFFFFFn), true);
    view.setUint32(offset + 4, Number(bigValue >> 32n), true);
  }

  writeDirectoryEntry(writer, entry) {
    writer.writeUInt16(entry.mimetypeIndex);
    writer.writeUInt8(0); // Parameter length
    writer.writeUInt8(entry.namespace);
    writer.writeUInt32(entry.revision);

    if (entry.type === 'redirect') {
      writer.writeUInt32(entry.redirectIndex);
    } else {
      writer.writeUInt32(entry.clusterNumber);
      writer.writeUInt32(entry.blobNumber);
    }

    writer.writeNullTerminatedString(entry.url);
    writer.writeNullTerminatedString(entry.title);
  }

  getBlob() {
    const buffer = this.finalize();
    return new Blob([buffer], { type: 'application/zim' });
  }
}

/**
 * Convert archive data to ZIM format
 */
export async function archiveToZim(archive) {
  const writer = new ZIMWriterBrowser();
  
  if (archive.type === 'page') {
    // Single page archive
    const content = archive.content;
    
    // Add HTML content
    const mainIndex = writer.addArticle(
      'A',
      'index.html',
      archive.title,
      'text/html',
      content.html
    );
    writer.setMainPage(mainIndex);

    // Add CSS if present
    if (content.styles) {
      writer.addArticle(
        '-',
        'styles.css',
        'Styles',
        'text/css',
        content.styles
      );
    }

  } else if (archive.type === 'site') {
    // Multi-page site archive
    const pages = archive.content.pages || [];
    
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const url = new URL(page.url);
      const path = url.pathname.replace(/^\//, '') || 'index.html';
      
      const index = writer.addArticle(
        'A',
        path,
        page.title || path,
        'text/html',
        page.html
      );
      
      if (i === 0) {
        writer.setMainPage(index);
      }
    }

  } else if (archive.type === 'selection') {
    // Text selection
    const html = `<!DOCTYPE html>
<html>
<head><title>${archive.title}</title></head>
<body>
<h1>Selection from ${archive.content.sourceTitle}</h1>
<p>Source: <a href="${archive.content.sourceUrl}">${archive.content.sourceUrl}</a></p>
<blockquote>${archive.content.text}</blockquote>
</body>
</html>`;

    const index = writer.addArticle('A', 'index.html', archive.title, 'text/html', html);
    writer.setMainPage(index);

  } else if (archive.type === 'image') {
    // Image archive
    const dataUrl = archive.content.dataUrl;
    const mimeType = archive.content.mimeType || 'image/png';
    
    // Convert data URL to binary
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    writer.addArticle('I', 'image', archive.title, mimeType, bytes);
    
    // Add wrapper HTML
    const html = `<!DOCTYPE html>
<html>
<head><title>${archive.title}</title></head>
<body>
<h1>${archive.title}</h1>
<img src="I/image" alt="${archive.title}">
</body>
</html>`;

    const index = writer.addArticle('A', 'index.html', archive.title, 'text/html', html);
    writer.setMainPage(index);

  } else if (archive.type === 'link') {
    // Link archive
    const index = writer.addArticle(
      'A',
      'index.html',
      archive.title,
      'text/html',
      archive.content.html
    );
    writer.setMainPage(index);
  }

  // Add metadata
  writer.addArticle('M', 'Title', 'Title', 'text/plain', archive.title);
  writer.addArticle('M', 'Date', 'Date', 'text/plain', archive.createdAt);
  writer.addArticle('M', 'Source', 'Source', 'text/plain', archive.url);

  return writer.getBlob();
}

/**
 * Parse ZIM file and convert to archive format
 */
export async function zimToArchive(arrayBuffer) {
  const reader = new ZIMReaderBrowser(arrayBuffer);
  await reader.open();

  const header = reader.getHeader();
  const articles = reader.listArticles();
  const mainPage = reader.getMainPage();

  // Get main page content
  let mainContent = '';
  let title = 'Imported ZIM';

  if (mainPage && mainPage.type === 'article') {
    const content = await reader.getArticleContent(mainPage);
    mainContent = new TextDecoder('utf-8').decode(content);
    title = mainPage.title || mainPage.url;
  }

  // Build archive structure
  const archive = {
    type: articles.length > 1 ? 'site' : 'page',
    title,
    url: 'zim://imported',
    createdAt: new Date().toISOString(),
    size: arrayBuffer.byteLength,
    articles: articles.length,
    content: articles.length > 1 ? { pages: [] } : { html: mainContent }
  };

  if (articles.length > 1) {
    for (const article of articles) {
      if (article.namespace === 'A') {
        try {
          const content = await reader.getArticleContent(article);
          const html = new TextDecoder('utf-8').decode(content);
          archive.content.pages.push({
            url: `zim://${article.url}`,
            title: article.title,
            html
          });
        } catch (e) {
          console.warn('Failed to read article:', article.url, e);
        }
      }
    }
  }

  return archive;
}

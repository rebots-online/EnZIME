// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { open } from '@tauri-apps/plugin-dialog';
import { readFile, stat } from '@tauri-apps/plugin-fs';

export interface ZIMHeader {
  magicNumber: number;
  majorVersion: number;
  minorVersion: number;
  entryCount: number;
  articleCount: number;
  clusterCount: number;
  redirectCount: number;
  mainPageIndex: number;
}

export interface ZIMEntry {
  mimetypeIndex: number;
  namespace: number;
  url: string;
  title: string;
  isRedirect: boolean;
  clusterNumber?: number;
  blobNumber?: number;
  redirectIndex?: number;
}

export interface ZIMArchiveInfo {
  id: string;
  name: string;
  title: string;
  description: string;
  language: string;
  articleCount: number;
  size: number;
  path: string;
  favicon?: string;
}

class BinaryReader {
  private dataView: DataView;
  private position: number = 0;

  constructor(buffer: ArrayBuffer) {
    this.dataView = new DataView(buffer);
  }

  readUInt32LE(): number {
    const value = this.dataView.getUint32(this.position, true);
    this.position += 4;
    return value;
  }

  readUInt16LE(): number {
    const value = this.dataView.getUint16(this.position, true);
    this.position += 2;
    return value;
  }

  readUInt8(): number {
    const value = this.dataView.getUint8(this.position);
    this.position += 1;
    return value;
  }

  readUInt64LE(): bigint {
    const value = this.dataView.getBigUint64(this.position, true);
    this.position += 8;
    return value;
  }

  readNullTerminatedString(): string {
    const bytes: number[] = [];
    while (this.position < this.dataView.byteLength) {
      const byte = this.dataView.getUint8(this.position);
      this.position++;
      if (byte === 0) break;
      bytes.push(byte);
    }
    return new TextDecoder().decode(new Uint8Array(bytes));
  }

  seek(position: number): void {
    this.position = position;
  }

  getPosition(): number {
    return this.position;
  }

  readBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(this.dataView.buffer, this.position, length);
    this.position += length;
    return bytes;
  }
}

export class ZIMService {
  private static instance: ZIMService;
  private openArchives: Map<string, { buffer: ArrayBuffer; header: ZIMHeader; entries: ZIMEntry[] }> = new Map();

  static getInstance(): ZIMService {
    if (!ZIMService.instance) {
      ZIMService.instance = new ZIMService();
    }
    return ZIMService.instance;
  }

  async openFileDialog(): Promise<string | null> {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'ZIM Archives',
          extensions: ['zim']
        }]
      });
      
      if (selected && typeof selected === 'string') {
        return selected;
      }
      return null;
    } catch (error) {
      console.error('Failed to open file dialog:', error);
      return null;
    }
  }

  async loadArchive(filePath: string): Promise<ZIMArchiveInfo | null> {
    try {
      const fileInfo = await stat(filePath);
      const fileData = await readFile(filePath);
      const buffer = fileData.buffer as ArrayBuffer;

      const reader = new BinaryReader(buffer);
      const header = this.readHeader(reader);

      if (header.magicNumber !== 0x4D495A5A) {
        throw new Error('Invalid ZIM file format');
      }

      const mimeTypes = this.readMimeTypes(reader, buffer);
      const entries = this.readDirectoryEntries(reader, buffer, header);

      const archiveId = this.generateArchiveId(filePath);
      this.openArchives.set(archiveId, { buffer, header, entries });

      const metadata = this.extractMetadata(entries, mimeTypes);
      const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'Unknown';

      return {
        id: archiveId,
        name: fileName,
        title: metadata.title || fileName.replace('.zim', ''),
        description: metadata.description || '',
        language: metadata.language || 'en',
        articleCount: header.articleCount,
        size: fileInfo.size,
        path: filePath,
        favicon: metadata.favicon,
      };
    } catch (error) {
      console.error('Failed to load ZIM archive:', error);
      return null;
    }
  }

  private generateArchiveId(_filePath: string): string {
    return `zim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private readHeader(reader: BinaryReader): ZIMHeader {
    return {
      magicNumber: reader.readUInt32LE(),
      majorVersion: reader.readUInt16LE(),
      minorVersion: reader.readUInt16LE(),
      entryCount: reader.readUInt32LE(),
      articleCount: reader.readUInt32LE(),
      clusterCount: reader.readUInt32LE(),
      redirectCount: reader.readUInt32LE(),
      mainPageIndex: (() => {
        reader.readUInt64LE(); // mimeTypeListPos
        reader.readUInt64LE(); // titleIndexPos
        reader.readUInt64LE(); // clusterPtrPos
        reader.readUInt64LE(); // clusterCountPos
        return reader.readUInt32LE();
      })(),
    };
  }

  private readMimeTypes(reader: BinaryReader, buffer: ArrayBuffer): string[] {
    reader.seek(80); // After header, read mimeTypeListPos
    const fullReader = new BinaryReader(buffer);
    fullReader.seek(32); // Position of mimeTypeListPos in header
    const mimeTypePos = Number(fullReader.readUInt64LE());

    reader.seek(mimeTypePos);
    const mimeTypes: string[] = [];
    let prevWasNull = false;

    while (reader.getPosition() < buffer.byteLength) {
      const str = reader.readNullTerminatedString();
      if (str.length === 0) {
        if (prevWasNull) break;
        prevWasNull = true;
      } else {
        mimeTypes.push(str);
        prevWasNull = false;
      }
    }

    return mimeTypes;
  }

  private readDirectoryEntries(reader: BinaryReader, _buffer: ArrayBuffer, header: ZIMHeader): ZIMEntry[] {
    const entries: ZIMEntry[] = [];
    
    // Read index pointers from position 80
    reader.seek(80);
    const indexPointers: bigint[] = [];
    
    for (let i = 0; i < Math.min(header.entryCount, 10000); i++) { // Limit for performance
      indexPointers.push(reader.readUInt64LE());
    }

    for (const ptr of indexPointers) {
      try {
        reader.seek(Number(ptr));
        const mimetypeIndex = reader.readUInt32LE();
        
        reader.seek(Number(ptr)); // Reset
        
        if (mimetypeIndex === 0xFFFF) {
          // Redirect entry
          reader.readUInt32LE(); // mimetype
          const namespace = reader.readUInt8();
          reader.readUInt32LE(); // revision
          const redirectIndex = reader.readUInt32LE();
          const url = reader.readNullTerminatedString();
          const title = reader.readNullTerminatedString();
          
          entries.push({
            mimetypeIndex,
            namespace,
            url,
            title: title || url,
            isRedirect: true,
            redirectIndex,
          });
        } else {
          // Regular entry
          reader.readUInt32LE(); // mimetype
          const namespace = reader.readUInt8();
          reader.readUInt32LE(); // revision
          const clusterNumber = reader.readUInt32LE();
          const blobNumber = reader.readUInt32LE();
          const url = reader.readNullTerminatedString();
          const title = reader.readNullTerminatedString();
          
          entries.push({
            mimetypeIndex,
            namespace,
            url,
            title: title || url,
            isRedirect: false,
            clusterNumber,
            blobNumber,
          });
        }
      } catch {
        // Skip malformed entries
        continue;
      }
    }

    return entries;
  }

  private extractMetadata(entries: ZIMEntry[], _mimeTypes: string[]): { title?: string; description?: string; language?: string; favicon?: string } {
    const metadata: { title?: string; description?: string; language?: string; favicon?: string } = {};
    
    const metadataNamespace = 'M'.charCodeAt(0);
    const metadataEntries = entries.filter(e => e.namespace === metadataNamespace);

    for (const entry of metadataEntries) {
      if (entry.url === 'Title') {
        metadata.title = entry.title;
      } else if (entry.url === 'Description') {
        metadata.description = entry.title;
      } else if (entry.url === 'Language') {
        metadata.language = entry.title;
      }
    }

    return metadata;
  }

  getArticles(archiveId: string): ZIMEntry[] {
    const archive = this.openArchives.get(archiveId);
    if (!archive) return [];

    const articleNamespace = 'A'.charCodeAt(0);
    return archive.entries.filter(e => e.namespace === articleNamespace && !e.isRedirect);
  }

  searchArticles(archiveId: string, query: string, limit: number = 50): ZIMEntry[] {
    const articles = this.getArticles(archiveId);
    const lowerQuery = query.toLowerCase();
    
    return articles
      .filter(a => 
        a.title.toLowerCase().includes(lowerQuery) ||
        a.url.toLowerCase().includes(lowerQuery)
      )
      .slice(0, limit);
  }

  async getArticleContent(archiveId: string, entry: ZIMEntry): Promise<string | null> {
    const archive = this.openArchives.get(archiveId);
    if (!archive || entry.isRedirect || entry.clusterNumber === undefined || entry.blobNumber === undefined) {
      return null;
    }

    try {
      const reader = new BinaryReader(archive.buffer);
      
      // Read cluster pointer position from header
      reader.seek(48); // Position of clusterPtrPos in header
      const clusterPtrPos = Number(reader.readUInt64LE());
      
      // Read cluster offset
      reader.seek(clusterPtrPos + entry.clusterNumber * 8);
      const clusterOffset = Number(reader.readUInt64LE());
      
      // Read cluster data
      reader.seek(clusterOffset);
      const compressionByte = reader.readUInt8();
      
      // Read blob offsets
      const blobOffsets: number[] = [];
      let prevOffset = 0;
      for (let i = 0; i <= entry.blobNumber + 1; i++) {
        const offset = reader.readUInt32LE();
        if (offset === 0 && i > 0) break;
        blobOffsets.push(offset);
        if (offset < prevOffset) break; // Safety check
        prevOffset = offset;
      }
      
      if (entry.blobNumber >= blobOffsets.length - 1) {
        return null;
      }
      
      const blobStart = blobOffsets[entry.blobNumber];
      const blobEnd = blobOffsets[entry.blobNumber + 1];
      const blobSize = blobEnd - blobStart;
      
      // Read blob data
      const dataStartPos = reader.getPosition();
      reader.seek(dataStartPos + blobStart - (blobOffsets.length * 4));
      const blobData = reader.readBytes(blobSize);
      
      // Handle decompression if needed (basic support for uncompressed)
      if (compressionByte === 1 || compressionByte === 0) {
        // Uncompressed
        return new TextDecoder().decode(blobData);
      } else {
        // Compressed - would need decompression library
        console.warn('Compressed content not yet supported, compression type:', compressionByte);
        return null;
      }
    } catch (error) {
      console.error('Failed to read article content:', error);
      return null;
    }
  }

  getEntryByUrl(archiveId: string, url: string): ZIMEntry | undefined {
    const archive = this.openArchives.get(archiveId);
    if (!archive) return undefined;
    
    return archive.entries.find(e => e.url === url);
  }

  closeArchive(archiveId: string): void {
    this.openArchives.delete(archiveId);
  }
}

export const zimService = ZIMService.getInstance();

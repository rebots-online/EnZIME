<?php
/**
 * Clean-room ZIM (Zeno IMproved) file format reader/writer library for PHP
 * 
 * Based on ZIM file format specification from openZIM
 * Supports reading and writing ZIM archives for offline content storage
 */

/**
 * Compression types used in ZIM files
 */
class ZIMCompressionType {
    const DEFAULT = 0;
    const NONE = 1;
    const ZLIB = 2;
    const BZIP2 = 3;
    const LZMA = 4;
    const ZSTD = 5;
}

/**
 * ZIM namespace identifiers
 */
class ZIMNamespace {
    const MAIN_ARTICLE = ord('A');
    const IMAGE = ord('I');
    const METADATA = ord('M');
    const RAW_DATA = ord('-');
    const STYLE = ord('S');
    const SCRIPT = ord('J');
    const FONT = ord('T');
    const TRANSLATION = ord('U');
    const VIDEO = ord('V');
    const AUDIO = ord('W');
}

/**
 * ZIM file header structure
 */
class ZIMHeader {
    public $magicNumber;
    public $majorVersion;
    public $minorVersion;
    public $entryCount;
    public $articleCount;
    public $clusterCount;
    public $redirectCount;
    public $mimeTypeListPos;
    public $titleIndexPos;
    public $clusterPtrPos;
    public $clusterCountPos;
    public $mainPageIndex;
    public $layoutPageIndex;
    public $checksumPos;

    public function __construct($data = null) {
        if ($data !== null) {
            $this->fromBinary($data);
        }
    }

    public function fromBinary($data) {
        $unpack = unpack('Imagic/Hmajor/Hminor/Ientry/Iarticle/Icluster/Iredirect/Qmime/Qtitle/QclusterPtr/QclusterCount/Imain/Ilayout/Qchecksum', $data);
        
        $this->magicNumber = $unpack['magic'];
        $this->majorVersion = $unpack['major'];
        $this->minorVersion = $unpack['minor'];
        $this->entryCount = $unpack['entry'];
        $this->articleCount = $unpack['article'];
        $this->clusterCount = $unpack['cluster'];
        $this->redirectCount = $unpack['redirect'];
        $this->mimeTypeListPos = $unpack['mime'];
        $this->titleIndexPos = $unpack['title'];
        $this->clusterPtrPos = $unpack['clusterPtr'];
        $this->clusterCountPos = $unpack['clusterCount'];
        $this->mainPageIndex = $unpack['main'];
        $this->layoutPageIndex = $unpack['layout'];
        $this->checksumPos = $unpack['checksum'];
    }

    public function toBinary() {
        return pack(
            'IHHIIIIIIIIIQQQ',
            $this->magicNumber,
            $this->majorVersion,
            $this->minorVersion,
            $this->entryCount,
            $this->articleCount,
            $this->clusterCount,
            $this->redirectCount,
            $this->mimeTypeListPos,
            $this->titleIndexPos,
            $this->clusterPtrPos,
            $this->clusterCountPos,
            $this->mainPageIndex,
            $this->layoutPageIndex,
            $this->checksumPos
        );
    }
}

/**
 * Directory entry for a ZIM file
 */
class ZIMDirectoryEntry {
    public $mimetypeIndex;
    public $namespace;
    public $revision;
    public $clusterNumber;
    public $blobNumber;
    public $url;
    public $title;

    public function __construct($data = null) {
        if ($data !== null) {
            $this->fromBinary($data);
        }
    }

    public function fromBinary($data) {
        $pos = 0;
        $this->mimetypeIndex = unpack('I', substr($data, $pos, 4))[1];
        $pos += 4;
        
        $this->namespace = ord($data[$pos]);
        $pos += 1;
        
        $this->revision = unpack('I', substr($data, $pos, 4))[1];
        $pos += 4;
        
        $this->clusterNumber = unpack('I', substr($data, $pos, 4))[1];
        $pos += 4;
        
        $this->blobNumber = unpack('I', substr($data, $pos, 4))[1];
        $pos += 4;
        
        // Read null-terminated URL
        $nullPos = strpos($data, "\x00", $pos);
        $this->url = substr($data, $pos, $nullPos - $pos);
        $pos = $nullPos + 1;
        
        // Read null-terminated title
        $nullPos = strpos($data, "\x00", $pos);
        if ($nullPos !== false) {
            $this->title = substr($data, $pos, $nullPos - $pos);
        } else {
            $this->title = substr($data, $pos);
        }
    }

    public function toBinary() {
        return pack('IBIII', 
            $this->mimetypeIndex,
            $this->namespace,
            $this->revision,
            $this->clusterNumber,
            $this->blobNumber
        ) . $this->url . "\x00" . $this->title . "\x00";
    }
}

/**
 * Redirect entry for a ZIM file
 */
class ZIMRedirectEntry {
    public $mimetypeIndex;
    public $namespace;
    public $revision;
    public $redirectIndex;
    public $url;
    public $title;

    public function __construct($data = null) {
        if ($data !== null) {
            $this->fromBinary($data);
        }
    }

    public function fromBinary($data) {
        $pos = 0;
        $this->mimetypeIndex = unpack('I', substr($data, $pos, 4))[1];
        $pos += 4;
        
        $this->namespace = ord($data[$pos]);
        $pos += 1;
        
        $this->revision = unpack('I', substr($data, $pos, 4))[1];
        $pos += 4;
        
        $this->redirectIndex = unpack('I', substr($data, $pos, 4))[1];
        $pos += 4;
        
        // Read null-terminated URL
        $nullPos = strpos($data, "\x00", $pos);
        $this->url = substr($data, $pos, $nullPos - $pos);
        $pos = $nullPos + 1;
        
        // Read null-terminated title
        $nullPos = strpos($data, "\x00", $pos);
        if ($nullPos !== false) {
            $this->title = substr($data, $pos, $nullPos - $pos);
        } else {
            $this->title = substr($data, $pos);
        }
    }

    public function toBinary() {
        return pack('IBIII', 
            $this->mimetypeIndex,
            $this->namespace,
            $this->revision,
            $this->redirectIndex,
            0 // Unused for redirects
        ) . $this->url . "\x00" . $this->title . "\x00";
    }
}

/**
 * Binary reader utility for ZIM files
 */
class ZIMBinaryReader {
    private $data;
    private $position;
    private $length;

    public function __construct($data) {
        $this->data = $data;
        $this->position = 0;
        $this->length = strlen($data);
    }

    public function readUInt32LE() {
        $value = unpack('I', substr($this->data, $this->position, 4))[1];
        $this->position += 4;
        return $value;
    }

    public function readUInt16LE() {
        $value = unpack('S', substr($this->data, $this->position, 2))[1];
        $this->position += 2;
        return $value;
    }

    public function readUInt8() {
        $value = ord($this->data[$this->position]);
        $this->position += 1;
        return $value;
    }

    public function readUInt64LE() {
        $value = unpack('Q', substr($this->data, $this->position, 8))[1];
        $this->position += 8;
        return $value;
    }

    public function readNullTerminatedString() {
        $start = $this->position;
        $nullPos = strpos($this->data, "\x00", $start);
        if ($nullPos === false) {
            $str = substr($this->data, $start);
            $this->position = $this->length;
        } else {
            $str = substr($this->data, $start, $nullPos - $start);
            $this->position = $nullPos + 1;
        }
        return $str;
    }

    public function seek($position) {
        $this->position = $position;
    }

    public function getPosition() {
        return $this->position;
    }

    public function readBytes($length) {
        $data = substr($this->data, $this->position, $length);
        $this->position += $length;
        return $data;
    }

    public function isEOF() {
        return $this->position >= $this->length;
    }
}

/**
 * Binary writer utility for ZIM files
 */
class ZIMBinaryWriter {
    private $data;
    private $position;

    public function __construct($initialSize = 1024) {
        $this->data = str_repeat("\x00", $initialSize);
        $this->position = 0;
    }

    private function ensureCapacity($additionalBytes) {
        if ($this->position + $additionalBytes > strlen($this->data)) {
            $newSize = max(strlen($this->data) * 2, $this->position + $additionalBytes);
            $this->data = str_pad($this->data, $newSize, "\x00");
        }
    }

    public function writeUInt32LE($value) {
        $this->ensureCapacity(4);
        $packed = pack('I', $value);
        for ($i = 0; $i < 4; $i++) {
            $this->data[$this->position + $i] = $packed[$i];
        }
        $this->position += 4;
    }

    public function writeUInt16LE($value) {
        $this->ensureCapacity(2);
        $packed = pack('S', $value);
        for ($i = 0; $i < 2; $i++) {
            $this->data[$this->position + $i] = $packed[$i];
        }
        $this->position += 2;
    }

    public function writeUInt8($value) {
        $this->ensureCapacity(1);
        $this->data[$this->position] = chr($value);
        $this->position += 1;
    }

    public function writeUInt64LE($value) {
        $this->ensureCapacity(8);
        $packed = pack('Q', $value);
        for ($i = 0; $i < 8; $i++) {
            $this->data[$this->position + $i] = $packed[$i];
        }
        $this->position += 8;
    }

    public function writeNullTerminatedString($str) {
        $strBytes = $str . "\x00";
        $this->ensureCapacity(strlen($strBytes));
        for ($i = 0; $i < strlen($strBytes); $i++) {
            $this->data[$this->position + $i] = $strBytes[$i];
        }
        $this->position += strlen($strBytes);
    }

    public function writeBytes($bytes) {
        $this->ensureCapacity(strlen($bytes));
        for ($i = 0; $i < strlen($bytes); $i++) {
            $this->data[$this->position + $i] = $bytes[$i];
        }
        $this->position += strlen($bytes);
    }

    public function seek($position) {
        $this->position = $position;
    }

    public function getPosition() {
        return $this->position;
    }

    public function getBuffer() {
        return substr($this->data, 0, $this->position);
    }
}

/**
 * ZIM file reader class
 */
class ZIMReader {
    private $filePath;
    private $fileHandle;
    private $header;
    private $mimeTypes = array();
    private $directoryEntries = array();
    private $clusterOffsets = array();

    public function __construct($filePath) {
        $this->filePath = $filePath;
    }

    public function open() {
        $this->fileHandle = fopen($this->filePath, 'rb');
        if (!$this->fileHandle) {
            throw new Exception("Cannot open ZIM file: " . $this->filePath);
        }

        $this->readHeader();
        $this->readMimeTypes();
        $this->readDirectory();
        $this->readClusterPointers();
    }

    public function close() {
        if ($this->fileHandle) {
            fclose($this->fileHandle);
            $this->fileHandle = null;
        }
    }

    private function readHeader() {
        fseek($this->fileHandle, 0);
        $headerData = fread($this->fileHandle, 80);
        $this->header = new ZIMHeader($headerData);

        // Verify magic number
        if ($this->header->magicNumber !== 0x4D495A5A) { // "ZZIM" in little endian
            throw new Exception("Invalid ZIM file format");
        }
    }

    private function readMimeTypes() {
        fseek($this->fileHandle, $this->header->mimeTypeListPos);
        
        $mimeTypesData = '';
        while (true) {
            $chunk = fread($this->fileHandle, 1024);
            if ($chunk === false || strlen($chunk) === 0) {
                break;
            }
            $mimeTypesData .= $chunk;
            
            // Look for double null terminator
            if (strpos($mimeTypesData, "\x00\x00") !== false) {
                break;
            }
        }

        // Split by null terminator and remove empty strings
        $mimeTypesArray = explode("\x00", $mimeTypesData);
        $this->mimeTypes = array_filter($mimeTypesArray, function($mt) {
            return strlen($mt) > 0;
        });
    }

    private function readDirectory() {
        // Read index pointer list (starts after header at offset 80)
        fseek($this->fileHandle, 80);
        
        $indexPointers = array();
        for ($i = 0; $i < $this->header->entryCount; $i++) {
            $ptrData = fread($this->fileHandle, 8);
            $ptr = unpack('Q', $ptrData)[1];
            $indexPointers[] = $ptr;
        }

        // Read directory entries
        foreach ($indexPointers as $ptr) {
            fseek($this->fileHandle, $ptr);
            
            // Read first 5 bytes to determine entry type
            $firstBytes = fread($this->fileHandle, 5);
            $mimetype = unpack('I', substr($firstBytes, 0, 4))[1];
            
            fseek($this->fileHandle, $ptr); // Reset position
            
            // Read full entry (estimate size)
            $entryData = fread($this->fileHandle, 1000);
            
            if ($mimetype === 0xFFFF) { // Redirect entry
                $entry = new ZIMRedirectEntry($entryData);
                $this->directoryEntries[] = $entry;
            } else { // Article entry
                $entry = new ZIMDirectoryEntry($entryData);
                $this->directoryEntries[] = $entry;
            }
        }
    }

    private function readClusterPointers() {
        fseek($this->fileHandle, $this->header->clusterPtrPos);
        
        for ($i = 0; $i < $this->header->clusterCount; $i++) {
            $ptrData = fread($this->fileHandle, 8);
            $ptr = unpack('Q', $ptrData)[1];
            $this->clusterOffsets[] = $ptr;
        }
    }

    public function getEntryByPath($path) {
        $namespace = ord($path[0]);
        $url = strlen($path) > 2 ? substr($path, 2) : '';

        foreach ($this->directoryEntries as $entry) {
            if ($entry->namespace === $namespace && $entry->url === $url) {
                return $entry;
            }
        }
        
        return null;
    }

    public function getArticleContent($entry) {
        if (!($entry instanceof ZIMDirectoryEntry)) {
            throw new Exception("Entry must be a directory entry");
        }

        // Get cluster offset
        $clusterOffset = $this->clusterOffsets[$entry->clusterNumber];
        fseek($this->fileHandle, $clusterOffset);
        
        // Read cluster header (compression type)
        $compressionByte = ord(fread($this->fileHandle, 1));
        
        // Read blob offsets
        $blobOffsets = array();
        while (true) {
            $offsetData = fread($this->fileHandle, 4);
            $offset = unpack('I', $offsetData)[1];
            $blobOffsets[] = $offset;
            if ($offset === 0) break; // Last offset
        }
        
        // Calculate blob size and position
        if ($entry->blobNumber >= count($blobOffsets) - 1) {
            throw new Exception("Invalid blob number");
        }
        
        $blobStart = $blobOffsets[$entry->blobNumber];
        $blobEnd = $blobOffsets[$entry->blobNumber + 1];
        $blobSize = $blobEnd - $blobStart;
        
        // Read blob data
        $currentPos = ftell($this->fileHandle);
        fseek($this->fileHandle, $currentPos + $blobStart);
        $blobData = fread($this->fileHandle, $blobSize);
        
        // Decompress if needed
        if ($compressionByte === ZIMCompressionType::ZLIB) {
            $blobData = gzuncompress($blobData);
        } elseif ($compressionByte === ZIMCompressionType::LZMA) {
            throw new Exception("LZMA compression not implemented in this clean-room version");
        }
        
        return $blobData;
    }

    public function getMainPage() {
        if ($this->header->mainPageIndex < count($this->directoryEntries)) {
            return $this->directoryEntries[$this->header->mainPageIndex];
        }
        
        return null;
    }

    public function listArticles() {
        $articles = array();
        foreach ($this->directoryEntries as $entry) {
            if ($entry instanceof ZIMDirectoryEntry) {
                $articles[] = $entry;
            }
        }
        return $articles;
    }

    public function getMimeTypes() {
        return $this->mimeTypes;
    }

    public function getHeader() {
        return $this->header;
    }
}

/**
 * ZIM file writer class
 */
class ZIMWriter {
    private $filePath;
    private $mimeTypes = array();
    private $directoryEntries = array();
    private $clusters = array();
    private $mainPageIndex = 0;

    public function __construct($filePath) {
        $this->filePath = $filePath;
    }

    public function create() {
        $fileHandle = fopen($this->filePath, 'wb');
        if (!$fileHandle) {
            throw new Exception("Cannot create ZIM file: " . $this->filePath);
        }

        // Write placeholder header
        $header = new ZIMHeader();
        $header->magicNumber = 0x4D495A5A;
        $header->majorVersion = 4;
        $header->minorVersion = 0;
        fwrite($fileHandle, $header->toBinary());
        fclose($fileHandle);
    }

    public function addMimeType($mimeType) {
        if (!in_array($mimeType, $this->mimeTypes)) {
            $this->mimeTypes[] = $mimeType;
        }
        return array_search($mimeType, $this->mimeTypes);
    }

    public function addArticle($namespace, $url, $title, $content, $mimeType = 'text/html') {
        $mimetypeIndex = $this->addMimeType($mimeType);
        
        // Create cluster with content (for simplicity, one blob per cluster)
        $clusterData = $this->createCluster(array($content), ZIMCompressionType::DEFAULT);
        $clusterNumber = count($this->clusters);
        $this->clusters[] = $clusterData;
        
        $entry = new ZIMDirectoryEntry();
        $entry->mimetypeIndex = $mimetypeIndex;
        $entry->namespace = $namespace;
        $entry->revision = 0;
        $entry->clusterNumber = $clusterNumber;
        $entry->blobNumber = 0;
        $entry->url = $url;
        $entry->title = $title;
        
        $this->directoryEntries[] = $entry;
    }

    public function addRedirect($namespace, $url, $title, $redirectIndex) {
        $entry = new ZIMRedirectEntry();
        $entry->mimetypeIndex = 0xFFFF; // Redirect marker
        $entry->namespace = $namespace;
        $entry->revision = 0;
        $entry->redirectIndex = $redirectIndex;
        $entry->url = $url;
        $entry->title = $title;
        
        $this->directoryEntries[] = $entry;
    }

    private function createCluster($blobs, $compression) {
        // Calculate blob offsets
        $offsets = array(0);
        $currentOffset = 0;
        foreach ($blobs as $blob) {
            $currentOffset += strlen($blob);
            $offsets[] = $currentOffset;
        }
        
        $writer = new ZIMBinaryWriter();
        $writer->writeUInt8($compression);
        
        // Add offsets
        foreach ($offsets as $offset) {
            $writer->writeUInt32LE($offset);
        }
        
        // Add blob data
        foreach ($blobs as $blob) {
            if ($compression === ZIMCompressionType::ZLIB) {
                $blob = gzcompress($blob);
            }
            $writer->writeBytes($blob);
        }
        
        return $writer->getBuffer();
    }

    public function finalize() {
        // Calculate positions
        $currentPos = 80; // After header
        
        // Write MIME type list
        $mimeTypePos = $currentPos;
        $mimeTypeData = implode("\x00", $this->mimeTypes) . "\x00\x00";
        $currentPos += strlen($mimeTypeData);
        
        // Write directory entries
        $directoryPos = $currentPos;
        $indexPointers = array();
        
        foreach ($this->directoryEntries as $entry) {
            $indexPointers[] = $currentPos;
            if ($entry instanceof ZIMRedirectEntry) {
                $entryData = $entry->toBinary();
            } else {
                $entryData = $entry->toBinary();
            }
            $currentPos += strlen($entryData);
        }
        
        // Write index pointer list
        $indexPtrPos = $currentPos;
        $currentPos += count($indexPointers) * 8;
        
        // Write cluster pointer list
        $clusterPtrPos = $currentPos;
        $clusterOffsets = array();
        
        foreach ($this->clusters as $cluster) {
            $clusterOffsets[] = $currentPos;
            $currentPos += strlen($cluster);
        }
        
        // Update header with real values
        $articleCount = 0;
        $redirectCount = 0;
        
        foreach ($this->directoryEntries as $entry) {
            if ($entry instanceof ZIMDirectoryEntry) {
                $articleCount++;
            } else {
                $redirectCount++;
            }
        }
        
        $header = new ZIMHeader();
        $header->magicNumber = 0x4D495A5A;
        $header->majorVersion = 4;
        $header->minorVersion = 0;
        $header->entryCount = count($this->directoryEntries);
        $header->articleCount = $articleCount;
        $header->clusterCount = count($this->clusters);
        $header->redirectCount = $redirectCount;
        $header->mimeTypeListPos = $mimeTypePos;
        $header->titleIndexPos = 0; // Not implemented
        $header->clusterPtrPos = $clusterPtrPos;
        $header->clusterCountPos = 0; // Not implemented
        $header->mainPageIndex = $this->mainPageIndex;
        $header->layoutPageIndex = 0; // Not implemented
        $header->checksumPos = $currentPos; // Checksum at end
        
        // Write all data to file
        $fileHandle = fopen($this->filePath, 'wb');
        
        fwrite($fileHandle, $header->toBinary());
        fwrite($fileHandle, $mimeTypeData);
        
        // Write directory entries
        foreach ($this->directoryEntries as $entry) {
            if ($entry instanceof ZIMRedirectEntry) {
                fwrite($fileHandle, $entry->toBinary());
            } else {
                fwrite($fileHandle, $entry->toBinary());
            }
        }
        
        // Write index pointer list
        foreach ($indexPointers as $ptr) {
            fwrite($fileHandle, pack('Q', $ptr));
        }
        
        // Write cluster pointer list
        foreach ($clusterOffsets as $offset) {
            fwrite($fileHandle, pack('Q', $offset));
        }
        
        // Write clusters
        foreach ($this->clusters as $cluster) {
            fwrite($fileHandle, $cluster);
        }
        
        // Write placeholder checksum
        fwrite($fileHandle, str_repeat("\x00", 16)); // 16-byte checksum placeholder
        
        fclose($fileHandle);
    }

    public function close() {
        // Nothing to do for file-based writer
    }
}

// Utility functions
function readZIMFile($filePath) {
    return new ZIMReader($filePath);
}

function createZIMFile($filePath) {
    return new ZIMWriter($filePath);
}

?>

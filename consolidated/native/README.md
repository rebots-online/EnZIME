# ZIM adapter and compatibility evidence

`../zim.mjs` implements the Node-facing AnZimmerman reader contract over mounted
ZIM files. It uses positional reads, bounded directory/pointer/decompression
caches, exact namespace-qualified keys, canonical redirect resolution, binary
blobs, optional streamed integrity verification, and paged title/path search.
It does not extract an archive or build a second permanent content store.

This is **not** a Rust FFI binding. The original AnZimmerman source is preserved
at `src-tauri/anzimmermanlib/rust`. Inspection found the wrong file magic
(`0x0444495A`), incorrect directory layout and compression mapping, an unfinished
URL listing, and fixture tests which logged parse failures instead of failing.
The committed 605-byte `wiki-mini.zim` contains that invalid development format.
An unchanged copy is retained here as `fixtures/legacy-invalid-wiki-mini.zim`
so the same rejection test also works from the standalone application package.
Its provenance is the original repository file
`src-tauri/anzimmermanlib/rust/tests/fixtures/wiki-mini.zim`, not OpenZIM's
official test suite. The regression test asserts rejection; this file is not
presented as a valid archive or rewritten to conceal the finding.

The adapter corrects those issues using the actual OpenZIM layout. The sources
consulted were OpenZIM's `libzim` `src/dirent.cpp`, `src/cluster.cpp`, and
`include/zim/zim.h`, and the Zstandard frame-format specification:

- <https://github.com/openzim/libzim/blob/main/src/dirent.cpp>
- <https://github.com/openzim/libzim/blob/main/src/cluster.cpp>
- <https://github.com/openzim/libzim/blob/main/include/zim/zim.h>
- <https://github.com/facebook/zstd/blob/dev/doc/zstd_compression_format.md>

The implementation is original JavaScript using those public format definitions;
it does not copy the C++ implementation. The API concepts and product integration
come from AnZimmerman.

## Dependencies and limits

- Node 24 or newer: native Zstandard and zlib; no additional npm dependencies.
- Legacy XZ/LZMA clusters use `xz` on PATH, invoked without a shell with a 128 MiB
  decoder-memory limit, 128 MiB output limit and 30-second timeout. Very old bzip2
  clusters need `bzip2`. These executables must be installed on the host where
  those archive formats are required; they are not bundled into this application.
- Supported archive major versions: 5 and 6; genuine fixtures cover 5.0, 6.1 and
  6.3 (including missing legacy title index). Standard 32-bit and extended 64-bit
  blob offset tables are understood. Multipart `.zimaa` archives are not supported.
- Modern Zstandard clusters, raw clusters, binary assets and redirects are tested.
  Legacy XZ is tested; legacy zlib and bzip2 code paths are not release evidence.
- 128 MiB compressed/decompressed cluster limit; 32 MiB per requested article or
  binary asset; 64 MiB retained cluster cache; 2 MiB directory cache; 1 MiB pointer
  cache. Reads are serialized per mounted archive, preventing concurrent decoder
  allocations from multiplying those working limits. Uncompressed clusters are
  read by requested blob, regardless of the size of the remaining cluster.
- `list()` performs title/path matching, not Xapian full-text search. `offset` is
  a raw directory cursor; each call scans at most 20,000 entries and emits at most
  200 matches. The array's `nextOffset` and `complete` properties must be copied
  into explicit response fields when serializing to JSON. Callers can continue
  a query without accumulating the whole directory. `includeAssets: true` emits
  metadata/asset entries as well as text articles.
- `metadata().entryCount` is the exact directory count, including assets,
  metadata, indexes and redirects. `articleCount` is `null` because it is not
  calculated through a whole-archive scan. `mainPage` is the resolved canonical
  key. `read()` retains `requestedKey` separately from the resolved `key`.
- Opening performs structural checks but is not a full integrity audit. MD5
  verification is explicit via `verify()` and streams the archive. MD5 detects
  accidental changes; it does not prove signer identity or authenticity.
- Cache data is ephemeral. Returned blob buffers are copied, so a small article
  cannot retain an entire decompressed cluster or modify cached source bytes.

## Official fixture provenance

The unchanged small fixtures below were copied from the official
[openzim/zim-testing-suite](https://github.com/openzim/zim-testing-suite) at commit
`2edf72096208e60c82b6ebbe313baa552cc6af52` on 2026-09-11. The fixture repository
documents that these files are used by libzim and should not be regenerated.
They are test artifacts, not bundled user-facing knowledge content.

| Local fixture | Upstream path | SHA-256 |
| --- | --- | --- |
| `fixtures/openzim-v5-small.zim` | `data/withns/small.zim` | `64e67613388b0fc7d86c289d55f8d2f3a378d7e8ac107297325d1370cebfb478` |
| `fixtures/openzim-v6-small.zim` | `data/nons/small.zim` | `a4f516011116090ce96cff0767e3c9cfd74a00552b932038a5c5050fbf13db6b` |
| `fixtures/openzim-v6.3-small.zim` | `data/noTitleListingV0/small.zim` | `5ce75d0ac511dce286418d81216ea8cfce20280248200aaa737b8f2c73730aaa` |

Run `node --test test/zim.test.mjs` from `consolidated`. The tests check genuine
HTML and PNG retrieval, version compatibility, redirects, checksum validation,
unaltered source bytes, byte budgets, malformed offsets and cycles, and the
DynDon writer's UTF-8 and binary roundtrip. They do not swallow failures.

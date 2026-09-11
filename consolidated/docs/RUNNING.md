# Run EnZIME locally

The consolidated application serves the reader, Knowledge Mesh and assistant interface from a local Node process. Its Linux portable package includes Node, JavaScript dependencies and browser assets, so reading installed sources does not require an internet connection. It opens in your browser at **http://127.0.0.1:4173**.

## Linux portable package

1. Extract `enzime-<version>-linux-x64.tar.gz` into a writable folder.
2. Open a terminal in the extracted folder and run `./launch.sh`.
3. Open the printed local address. Keep the terminal running; press **Ctrl+C** to stop.

The included runtime targets **Linux x86-64 with glibc**. It still uses the system's C/C++ runtime libraries; its recorded shared-library dependencies appear in `BUILD-INFO.json`. It is not an Android binary or an Alpine/musl build. A host with Node 24+ can run an application-only package through the same launcher.

For a removable-drive setup that keeps the shared data beside the application:

```sh
MBA_ROBIN_PORTABLE=1 ./launch.sh
```

For an existing shared `mba.robin` directory and a different port:

```sh
MBA_ROBIN_HOME=/mnt/shared/mba.robin PORT=4174 ./launch.sh
```

By default the application uses `$XDG_DATA_HOME/mba.robin`, or `$HOME/.local/share/mba.robin`. Moving the application folder does not move that default data directory. `MBA_ROBIN_HOME` takes precedence over the portable setting.

## Windows with installed Node 24+

Use the consolidated source/application files with Node 24 or newer installed on `PATH`. From Command Prompt in that folder:

```bat
npm ci
npm run build
launch.cmd
```

Dependencies must be installed on Windows, because the Linux archive can contain optional Linux native packages. The launcher detects dependencies marked for another operating system and explains how to replace them. `npm ci` requires connectivity once; the installed application and built assets subsequently run locally.

An explicit shared location can be selected before launching:

```bat
set "MBA_ROBIN_HOME=D:\mba.robin"
launch.cmd
```

Otherwise Windows uses `%LOCALAPPDATA%\mba.robin`. For a portable data directory beside the launcher, set `MBA_ROBIN_PORTABLE=1`. This is the browser-based local application running on Node; it is not a Windows MSI/MSIX or a compiled Tauri installer.

## Sources, models and local inference

Import knowledge sources through the Library. Mounting an existing file preserves a reference to that file and avoids copying large ZIMs or model weights. Keep mounted files at their chosen location. If their contents, size or modification time change, remount the new edition; old annotations retain their original source identities.

The CPU reference package can include a verified llama.cpp engine. The Linux launcher automatically exposes its `llama-server` path to EnZIME's managed runtime. Select or download a supported model in the assistant settings, then start the local model; the application starts the engine on loopback. The included engine is the pinned official **llama.cpp b10809 Ubuntu x86-64 CPU build**, with its MIT license and source references retained. It requires the host's OpenSSL 3, OpenMP (`libgomp`) and standard C/C++ libraries. It does not include GPU backends or TurboQuant kernels.

Application-only packages and packages built without `--llama-runtime` require a separately installed engine. You can also use a separately running local inference service by configuring its OpenAI-compatible endpoint in Settings, or launching with:

```sh
ENZIME_LLM_ENDPOINT=http://127.0.0.1:8080/v1 ./launch.sh
```

Model weights are **not included** in the release archive. Download the offered LFM 2.5 edition or select your own supported shared model before disconnecting. The bundled runtime can use the app's managed model workflow; a separately configured engine can point at your shared models, such as those under `mba.robin/models`. LFM 2.5 is the leading default model choice; stronger or differently quantized models remain selectable when the engine and hardware support them. Choosing a TurboQuant option cannot add TurboQuant kernels to an engine that does not implement them. The UI reports the actual inference connection and capabilities; install and verify the intended runtime/model before relying on offline generation.

The Knowledge Mesh is the local semantic graph used by navigation and retrieval. It does not require peer networking. Sharing and personal backups are separate operations.

## Archive codec support

Node provides the standard Zstandard and zlib paths used by the implemented ZIM reader. Older XZ/LZMA2 and bzip2 ZIM clusters additionally need `xz` and `bzip2` on the host's `PATH`. The portable package does not bundle those tools or operating-system libraries. If an old archive reports a missing codec, install the matching host tool or use a supported modern edition. Unsupported/corrupt archives produce an error rather than a successful readiness claim.

Sources: [XZ Utils](https://github.com/tukaani-project/xz), [bzip2](https://sourceware.org/bzip2/), [Node.js](https://github.com/nodejs/node).

## Persistence and backups

The shared data directory holds content-addressed source objects, a SQLite catalog, private drafts, annotations, final revision references, conversations and settings. A single writer owns a directory at a time. Stop the running instance before opening another instance against the same directory.

Personal backups include private drafts and conversations. A metadata-only backup preserves those records and source identities, while missing source payloads remain explicitly unavailable until their bytes are restored or remounted. An embedded backup includes payload bytes up to its configured limit; keep large archives and models alongside a metadata backup or transfer them separately. Mounted files live outside the managed object store and must be included in your own file backup plan.

Use verification after copying or restoring sources. Managed-object quotas do not include external mounted bytes. Temporary imports, archive generation and backup exports also need filesystem headroom. Check the storage and DynDon allocation information before large operations.

## Build a release package

From the consolidated source directory:

```sh
npm ci
npm run build
npm test
node scripts/package.mjs --node-license /path/to/node-release-LICENSE --llama-runtime /path/to/llama-b10809 --out /path/to/releases
```

Supply the **complete license for the exact Node runtime being bundled**. The script defaults to the running Linux Node executable; `--node-binary` selects another. It can discover `LICENSE` beside a standard Node distribution. The full release license includes Node's third-party notices and is available from the corresponding version tag in the [Node.js repository](https://github.com/nodejs/node).

The optional `--llama-runtime` directory must contain the official extracted `llama-b10809` CPU release. Keep `llama-b10809-bin-ubuntu-x64.tar.gz` beside it. The script checks the archive against the release SHA-256 and compares every bundled engine/library file with that verified archive. It copies only the server, shared libraries and license notices; model weights and unrelated files are excluded. Runtime metadata, source commit, archive hash and file hashes are recorded in `BUILD-INFO.json`. Omit the flag for a package that uses an independently installed inference engine.

For an application-only archive that expects Node to be installed:

```sh
node scripts/package.mjs --without-runtime --out /path/to/releases
```

Packaging makes no network requests and does not reinstall dependencies. It requires browser assets to have been built first. The explicit packaging allowlist includes application sources, installed dependencies, browser assets, tests, documented fixtures and notices. It excludes user storage, downloaded archives, models, prior releases and the repository's native application trees.

Each release includes `BUILD-INFO.json`, `THIRD_PARTY_NOTICES.md` and per-file `SHA256SUMS`. A separate `.sha256` file identifies the compressed archive. On Linux, verify the archive before extracting and verify extracted regular files from the extracted root:

```sh
sha256sum -c enzime-<version>-linux-x64.tar.gz.sha256
cd enzime-<version>-linux-x64
sha256sum -c SHA256SUMS
```

The archive records the source commit and whether packaging included uncommitted changes; it does not claim a clean release when the working tree is dirty. A generated package does not by itself satisfy native desktop/mobile, real-model performance, accessibility, production billing or external catalogue acceptance gates. Consult the release checklist and verification report for tested behavior and remaining work.

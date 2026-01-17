# ZIM Downloader

A cross-platform TUI (Terminal User Interface) application for browsing and downloading ZIM files from public repositories like Kiwix.

## Features

- 📚 **Browse Repositories**: Connect to Kiwix and other public ZIM repositories
- 🔍 **Search**: Find ZIM files by name, language, or content type
- ⬇️ **Download Manager**: Download with progress tracking, pause/resume support
- 💾 **Configurable Storage**: Set custom download directories
- 🎨 **Beautiful TUI**: Modern terminal interface with keyboard navigation
- 🖥️ **Cross-Platform**: Works on Windows, macOS, and Linux

## Screenshot

```
┌─────────────────────────── ZIM Downloader ───────────────────────────┐
│ 📚 Browse │ ⬇️ Downloads │ 📜 History │ ⚙️ Settings                  │
├──────────────────┬───────────────────────────────────────────────────┤
│  Repositories    │  ZIM Files                                        │
│ ─────────────────│──────────────────────────────────────────────────│
│ ▶ 📚 Kiwix       │ ▶ Wikipedia (English) - Complete [EN] 95.0 GiB   │
│   📦 Other       │   Wikipedia (English) - No Pics [EN] 12.0 GiB    │
│   🌐 Wikipedia   │   Wikipedia (English) - Top 100k [EN] 2.0 GiB    │
│   📖 Wikimedia   │   Wikipedia (French) - Complete [FR] 38.0 GiB    │
│   🏛️ Archive     │   Wiktionary (English) [EN] 5.5 GiB              │
│                  │   Stack Exchange - All Sites [EN] 85.0 GiB       │
│                  │   TED Talks (English) [EN] 25.0 GiB              │
├──────────────────┴───────────────────────────────────────────────────┤
│ q: Quit | Tab: Switch Tab | ↑↓: Navigate | Enter: Select | ?: Help   │
└──────────────────────────────────────────────────────────────────────┘
```

## Installation

### Pre-built Binaries

Download the latest release for your platform from the [Releases](https://github.com/yourproject/zim-downloader/releases) page.

### Build from Source

#### Prerequisites

- [Rust](https://rustup.rs/) 1.70 or later
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)

#### Build Steps

```bash
# Clone the repository
cd TOOLS/zim-downloader

# Build in release mode
cargo build --release

# Or build with Tauri for all platforms
cargo tauri build
```

## Usage

### TUI Mode (Terminal)

Run the application in terminal mode:

```bash
# Run directly
./zim-downloader --tui

# Or with cargo
cargo run -- --tui
```

### Tauri Mode (Background Service)

Run as a background service with system tray:

```bash
./zim-downloader
```

## Keyboard Shortcuts

### Navigation
| Key | Action |
|-----|--------|
| `Tab` | Switch between tabs |
| `↑` / `k` | Move up |
| `↓` / `j` | Move down |
| `Enter` | Select item |

### Actions
| Key | Action |
|-----|--------|
| `d` | Download selected ZIM |
| `p` | Pause download |
| `r` | Resume download |
| `c` | Cancel download |
| `/` | Search |
| `s` | Settings |

### General
| Key | Action |
|-----|--------|
| `?` / `F1` | Toggle help |
| `Esc` | Close popup |
| `q` | Quit application |

## Configuration

Configuration is stored in:
- **Linux/macOS**: `~/.config/zim-downloader/config.toml`
- **Windows**: `%APPDATA%\zim-downloader\config.toml`

### Example Configuration

```toml
# Download directory
download_dir = "/home/user/ZIM"

# Maximum concurrent downloads
max_concurrent_downloads = 2

# Enable resume capability
enable_resume = true

# Verify checksums after download
verify_checksums = true

# Preferred repositories (in order)
preferred_repositories = ["kiwix", "archive"]

# Auto-update repository list
auto_update_repos = true

# Theme (dark/light)
theme = "dark"

# Show human-readable sizes
human_readable_sizes = true

# Speed limit in bytes/sec (0 = unlimited)
speed_limit = 0

# Proxy configuration (optional)
# [proxy]
# url = "http://proxy.example.com:8080"
# username = "user"
# password = "pass"
```

## Supported Repositories

| Repository | Description | URL |
|------------|-------------|-----|
| Kiwix Library | Official ZIM library | download.kiwix.org |
| Kiwix Other | Stack Exchange, TED, etc. | download.kiwix.org/zim/other |
| Wikipedia | Wikipedia by language | download.kiwix.org/zim/wikipedia |
| Wikimedia | Other Wikimedia projects | download.kiwix.org/zim |
| Internet Archive | Archive.org ZIM files | archive.org |

## ZIM Content Types

- **Wikipedia**: Full encyclopedia by language
- **Wiktionary**: Dictionary and thesaurus
- **Wikiquote**: Collection of quotations
- **Wikibooks**: Free textbooks
- **Wikivoyage**: Travel guides
- **Stack Exchange**: Q&A communities
- **TED Talks**: Educational videos
- **Project Gutenberg**: Free eBooks

## Development

### Project Structure

```
zim-downloader/
├── Cargo.toml          # Rust dependencies
├── tauri.conf.json     # Tauri configuration
├── build.rs            # Build script
└── src/
    ├── main.rs         # Entry point
    ├── app.rs          # Application state
    ├── app/
    │   └── commands.rs # Tauri commands
    ├── config.rs       # Configuration
    ├── repository.rs   # Repository client
    ├── download.rs     # Download manager
    ├── tui.rs          # TUI main loop
    └── ui.rs           # UI rendering
```

### Building for Different Platforms

```bash
# Linux (AppImage, deb)
cargo tauri build --target x86_64-unknown-linux-gnu

# macOS (dmg, app)
cargo tauri build --target x86_64-apple-darwin
cargo tauri build --target aarch64-apple-darwin

# Windows (exe, msi)
cargo tauri build --target x86_64-pc-windows-msvc
```

## License

MIT License - See [LICENSE](LICENSE) for details.

## Related Projects

- [ZIM Library](../..) - Clean-room ZIM reader/writer libraries
- [Kiwix](https://kiwix.org) - Offline Wikipedia reader
- [openZIM](https://openzim.org) - ZIM file format specification

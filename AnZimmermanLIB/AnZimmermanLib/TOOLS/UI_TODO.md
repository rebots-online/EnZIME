Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
All rights reserved.
Unauthorized use without prior written consent is strictly prohibited.

# ZIM Downloader & Zimmer Extension - UI Development TODO

**Status: ACTIVE FOCUS**  
**Last Updated: 2026-01-04**  
**Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.**

---

## Overview

This document tracks UI development for:
1. **Zimmer Chrome Extension** - Page archiving and offline viewing
2. **ZIM Downloader Desktop** - Windows/Linux Tauri application
3. **ZIM Downloader Android** - Mobile Tauri application

TUI development is **PAUSED** - see `zim-downloader/TUI_TODO.md`

---

## ✅ Completed Features

### Chrome Extension (zimmer-extension)

- [x] Manifest v3 structure
- [x] Background service worker with page capture
- [x] Popup UI with archives/annotations tabs
- [x] Context menu integration (save page/selection/link/image)
- [x] Site crawling with depth control
- [x] Local storage for archives
- [x] 9-theme system with CSS variables
- [x] Light/Dark/System mode toggle
- [x] Version/build display in footer
- [x] Copyright notice

### Desktop UI (zim-downloader/ui)

- [x] React + Vite + TypeScript setup
- [x] Tailwind CSS styling
- [x] Tab navigation (Browse, Downloads, History, Settings)
- [x] Annotation panel (voice, ink, sticky notes)
- [x] Status bar with version/build
- [x] Dark mode toggle
- [x] Lucide icons

### Android (zim-downloader/android)

- [x] Tauri v2 Android configuration
- [x] Build instructions in README.md
- [x] Rust target setup documentation

---

## 🔲 Chrome Extension TODOs

### High Priority

#### 1. Real ZIM Export/Import
```javascript
// Location: src/background.js, lines 400-434
// Currently exports as JSON, needs actual ZIM format

async function exportZim(archiveId) {
  // TODO: Use ZIMWriterBrowser to create actual ZIM file
  // - Convert archive content to ZIM articles
  // - Add proper MIME types and compression
  // - Use blob download with .zim extension
}

async function importZim(data) {
  // TODO: Use ZIMReaderBrowser to parse ZIM file
  // - Extract articles and metadata
  // - Store in chrome.storage.local
}
```

#### 2. Content Diff for Compare Feature
```javascript
// Location: src/background.js, line 371
// TODO: Implement content diff
async function compareVersions(archiveId1, archiveId2) {
  // - Use diff algorithm (e.g., diff-match-patch)
  // - Highlight additions/deletions
  // - Show side-by-side comparison in viewer
}
```

#### 3. Options Page Theming
```
// Location: src/options/options.html, src/options/options.js
// TODO: Add theme selection to options page
// - Grid of theme previews
// - Mode toggle
// - Save preferences
```

#### 4. Viewer Page Enhancement
```
// Location: src/viewer/viewer.html
// TODO: Enhance offline viewer
// - Apply current theme
// - Add navigation between pages (for site archives)
// - Annotation overlay
// - Zoom controls
// - Print support
```

### Medium Priority

#### 5. Annotation Types
```javascript
// TODO: Add more annotation types
// - Voice notes (MediaRecorder API)
// - Ink/drawing (Canvas API)
// - Highlight (selection-based)
// - Bookmark (page position)
```

#### 6. Archive Organization
```
// TODO: Add organization features
// - Folders/tags for archives
// - Sort options (date, size, name)
// - Filter by type
// - Bulk actions (delete, export)
```

#### 7. Sync/Backup
```
// TODO: Optional cloud sync
// - Google Drive integration
// - Local backup/restore
// - Import from other extensions
```

### Low Priority

#### 8. Keyboard Shortcuts
```
// TODO: Extension keyboard shortcuts
// - Ctrl+Shift+S: Save page
// - Ctrl+Shift+A: Open archives
// - Ctrl+Shift+N: New annotation
```

#### 9. Badge Updates
```javascript
// TODO: Show archive count on extension icon
chrome.action.setBadgeText({ text: archives.length.toString() });
chrome.action.setBadgeBackgroundColor({ color: '#f97316' });
```

---

## 🔲 Desktop UI TODOs (Tauri)

### High Priority

#### 1. Multi-Theme Support
```typescript
// Location: ui/src/App.tsx
// Currently has dark mode toggle only
// TODO: Add full 9-theme support matching TUI themes

// Create: ui/src/lib/themes.ts
// - Same theme definitions as extension
// - CSS variable application
// - Theme picker component
```

#### 2. Download Progress UI
```typescript
// Location: ui/src/components/DownloadsTab.tsx
// TODO: Enhanced progress display
// - Animated progress bars
// - Speed graph
// - ETA calculation
// - Pause/resume controls
```

#### 3. File Browser Integration
```typescript
// Location: ui/src/components/SettingsTab.tsx
// TODO: Native file dialogs
// - Use Tauri dialog API for download directory
// - Show disk space
// - Recent folders
```

#### 4. System Tray
```rust
// Location: src-tauri/src/main.rs
// TODO: System tray with:
// - Download status
// - Quick actions
// - Notification on complete
```

### Medium Priority

#### 5. Drag & Drop
```typescript
// TODO: Drag and drop support
// - Drop ZIM files to open
// - Drag downloads to reorder
// - Export by dragging
```

#### 6. ZIM Viewer
```typescript
// TODO: Built-in ZIM viewer
// - WebView-based article display
// - Search within ZIM
// - Bookmark pages
// - Reading history
```

#### 7. Settings Persistence
```typescript
// TODO: Save all settings via Tauri
// - Theme preference
// - Window size/position
// - Download preferences
```

### Low Priority

#### 8. Menu Bar
```
// TODO: Standard menu bar per global_rules.md
// File | Edit | View | Help
// - About dialog with version/copyright
// - Preferences
// - Check for updates
```

#### 9. Accessibility
```
// TODO: Accessibility improvements
// - Keyboard navigation
// - Screen reader support
// - High contrast themes
```

---

## 🔲 Android UI TODOs

### High Priority

#### 1. Initialize Android Project
```bash
# Location: TOOLS/zim-downloader/
# TODO: Run initialization
cd TOOLS/zim-downloader
cargo tauri android init
```

#### 2. Touch-Optimized UI
```typescript
// TODO: Mobile-responsive layouts
// - Larger touch targets
// - Swipe gestures
// - Bottom navigation
// - Pull to refresh
```

#### 3. Background Downloads
```rust
// TODO: Android background service
// - Foreground service for downloads
// - Notification progress
// - Download queue
```

### Medium Priority

#### 4. Storage Management
```
// TODO: Android storage handling
// - Scoped storage compliance
// - External storage option
// - Storage usage display
```

#### 5. Share Intent
```
// TODO: Handle share intents
// - Receive URLs to download
// - Share ZIM files
```

---

## File Locations Reference

| Component | Path |
|-----------|------|
| Extension manifest | TOOLS/zimmer-extension/manifest.json |
| Extension popup | TOOLS/zimmer-extension/src/popup/ |
| Extension themes | TOOLS/zimmer-extension/src/lib/themes.js |
| Desktop UI | TOOLS/zim-downloader/ui/src/ |
| Tauri config | TOOLS/zim-downloader/src-tauri/tauri.conf.json |
| Android README | TOOLS/zim-downloader/android/README.md |
| TUI TODO | TOOLS/zim-downloader/TUI_TODO.md |

---

## Theme System Status

| Platform | 9 Themes | Light/Dark | System Mode | CSS Vars |
|----------|----------|------------|-------------|----------|
| TUI (Rust) | ✅ | ✅ | ✅ | N/A |
| Extension | ✅ | ✅ | ✅ | ✅ |
| Desktop | 🔲 | ✅ | 🔲 | 🔲 |
| Android | 🔲 | ✅ | 🔲 | 🔲 |

---

## Build Commands

### Chrome Extension
```bash
cd TOOLS/zimmer-extension
# Load unpacked in chrome://extensions
```

### Desktop (Windows/Linux/macOS)
```bash
cd TOOLS/zim-downloader
cargo tauri build
```

### Android
```bash
cd TOOLS/zim-downloader
cargo tauri android build --debug
```

---

## Resume Checklist

When resuming UI development:

1. [ ] Review this TODO document
2. [ ] Check for dependency updates (npm/cargo)
3. [ ] Pick highest priority TODO for target platform
4. [ ] Test on target platform
5. [ ] Update CHECKLIST.md with progress
6. [ ] Write Pieces memory on session end

---

*End of UI TODO document*

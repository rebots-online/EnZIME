# ZIM Downloader TUI - Development TODO

**Status: PAUSED**  
**Last Updated: 2026-01-04**  
**Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.**

---

## Overview

TUI development is paused to focus on Chrome extension and desktop/mobile UI.
This document comprehensively tracks remaining work for resumption.

---

## ✅ Completed Features

### Core Infrastructure
- [x] Terminal setup with crossterm backend
- [x] Ratatui-based rendering framework
- [x] Tab navigation (Browse, Downloads, History, Settings)
- [x] Keyboard input handling (Normal, Search, Settings modes)
- [x] Async runtime integration with tokio

### Theming System
- [x] 9 themes implemented (Kinetic, Brutalist, Retro, Neumorphism, Glassmorphism, Y2K, Cyberpunk, Minimal, Nordic)
- [x] Light/Dark/System mode toggle
- [x] Theme colors applied to all UI components
- [x] Theme cycling with 't' key
- [x] Mode toggle with 'm' key

### UI Components
- [x] Header with themed tabs
- [x] Browse tab with repository and ZIM file lists
- [x] Downloads tab with status display
- [x] History tab placeholder
- [x] Settings tab with config display
- [x] Footer with help text and version (bottom right)
- [x] Help popup with keyboard shortcuts
- [x] Settings popup

### Version/Build System
- [x] Copyright display on startup
- [x] Epoch-based 5-digit build numbers
- [x] Version string in footer

---

## 🔲 Remaining TODOs

### High Priority

#### 1. Download Management (src/ui.rs, src/download.rs)
```rust
// Location: src/ui.rs, lines 235-245
pub async fn pause_download(&mut self) {
    // TODO: Implement pause functionality
    // - Get selected download from download_list_state
    // - Call download_manager.pause(task_id)
    // - Update status_message
}

pub async fn resume_download(&mut self) {
    // TODO: Implement resume functionality
    // - Get selected download from download_list_state
    // - Call download_manager.resume(task_id)
    // - Update status_message
}

pub async fn cancel_download(&mut self) {
    // TODO: Implement cancel functionality
    // - Get selected download from download_list_state
    // - Call download_manager.cancel(task_id)
    // - Remove from active list
    // - Update status_message
}
```

#### 2. Settings Editing (src/ui.rs, lines 259-265)
```rust
// Location: src/ui.rs
pub fn edit_setting(&mut self, _c: char) {
    // TODO: Implement setting editing
    // - Based on settings_index, determine which setting
    // - For string settings: append character
    // - For bool settings: toggle on any key
    // - For number settings: parse digit input
}

pub fn backspace_setting(&mut self) {
    // TODO: Remove character from current setting
    // - Get current setting value
    // - Remove last character
    // - Update display
}
```

#### 3. Download History (src/ui.rs, draw_history_tab)
```rust
// Location: src/ui.rs, line 476
fn draw_history_tab(f: &mut Frame, app: &mut App, area: Rect) {
    // TODO: Implement history display
    // - Load history from config/history.json
    // - Display completed downloads with:
    //   - File name
    //   - Download date
    //   - File size
    //   - Source repository
    // - Allow deletion of history entries
    // - Allow re-download from history
}
```

### Medium Priority

#### 4. Progress Bar Widget
```rust
// TODO: Add progress bar for active downloads
// Location: src/ui.rs, draw_downloads_tab
// - Use ratatui::widgets::Gauge for progress
// - Show percentage, speed, ETA
// - Color based on status (green=active, yellow=paused, red=error)
```

#### 5. Search Improvements
```rust
// TODO: Enhance search functionality
// Location: src/ui.rs, search method
// - Add fuzzy matching
// - Highlight matching text in results
// - Search history (recent searches)
// - Category/language filters
```

#### 6. Repository Selection UI
```rust
// TODO: Improve repository switching
// Location: src/ui.rs, draw_browse_tab
// - Visual indicator of selected repository
// - Repository info popup (total ZIMs, categories, size)
// - Refresh button to reload ZIM list
```

### Low Priority

#### 7. Keyboard Shortcuts
```rust
// TODO: Additional keyboard shortcuts
// - Page Up/Down for fast scrolling
// - Home/End for jump to start/end
// - Ctrl+F for search focus
// - Ctrl+D for quick download
// - Number keys for tab switching (1-4)
```

#### 8. Status Bar Enhancements
```rust
// TODO: Richer status bar
// - Show active download count
// - Show total download speed
// - Network status indicator
// - Disk space remaining
```

#### 9. Confirmation Dialogs
```rust
// TODO: Add confirmation popups
// - Before canceling download
// - Before deleting history
// - Before overwriting existing file
```

#### 10. Error Handling UI
```rust
// TODO: Better error display
// - Error popup with details
// - Retry button for failed downloads
// - Error log viewer
```

---

## File Locations Reference

| Feature | File | Lines |
|---------|------|-------|
| App state | src/ui.rs | 39-67 |
| Theme system | src/theme.rs | 1-507 |
| TUI main loop | src/tui.rs | 49-194 |
| Download manager | src/download.rs | - |
| Repository client | src/repository.rs | - |
| Config | src/config.rs | - |

---

## Dependencies Status

```toml
# Cargo.toml - TUI dependencies
ratatui = "0.26"      # ✅ Working
crossterm = "0.27"    # ✅ Working
tokio = "1.36"        # ✅ Working
humansize = "2.1"     # ✅ Working
serde = "1.0"         # ✅ Working
```

---

## Testing Notes

### Manual Test Cases Needed
1. [ ] Theme switching through all 9 themes
2. [ ] Light/Dark/System mode in each theme
3. [ ] Download start/pause/resume/cancel flow
4. [ ] Search with special characters
5. [ ] Large ZIM list scrolling performance
6. [ ] Terminal resize handling
7. [ ] Multiple concurrent downloads
8. [ ] Network disconnect recovery

### Terminal Compatibility
- [ ] Test on xterm-256color
- [ ] Test on screen/tmux
- [ ] Test on Windows Terminal
- [ ] Test on macOS Terminal.app
- [ ] Test on Linux TTY (no true color)

---

## Resume Checklist

When resuming TUI development:

1. [ ] Review this TODO document
2. [ ] Check for ratatui/crossterm updates
3. [ ] Run existing TUI to verify current state
4. [ ] Pick highest priority TODO
5. [ ] Update CHECKLIST.md with new timeline
6. [ ] Write Pieces memory on resumption

---

*End of TUI TODO document*

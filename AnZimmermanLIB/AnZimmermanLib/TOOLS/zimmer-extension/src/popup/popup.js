// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

/**
 * Zimmer Popup Script
 * Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.
 */

import { 
  applyTheme, 
  loadThemePrefs, 
  saveThemePrefs, 
  nextTheme, 
  nextMode, 
  getVersionString,
  themeInfo,
  ThemeMode 
} from '../lib/themes.js';

// DOM Elements
const savePageBtn = document.getElementById('savePageBtn');
const saveSiteBtn = document.getElementById('saveSiteBtn');
const compareBtn = document.getElementById('compareBtn');
const settingsBtn = document.getElementById('settingsBtn');
const searchInput = document.getElementById('searchInput');
const archivesList = document.getElementById('archivesList');
const annotationsList = document.getElementById('annotationsList');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const themeBtn = document.getElementById('themeBtn');
const modeBtn = document.getElementById('modeBtn');
const versionDisplay = document.getElementById('versionDisplay');

// State
let archives = [];
let annotations = [];
let selectedForCompare = [];
let currentTheme = 'kinetic';
let currentMode = 'dark';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Load and apply theme
  const prefs = await loadThemePrefs();
  currentTheme = prefs.theme;
  currentMode = prefs.mode;
  applyTheme(currentTheme, currentMode);
  updateThemeUI();
  
  // Display version
  if (versionDisplay) {
    versionDisplay.textContent = getVersionString();
  }
  
  await loadArchives();
  await loadAnnotations();
  setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
  savePageBtn.addEventListener('click', handleSavePage);
  saveSiteBtn.addEventListener('click', handleSaveSite);
  compareBtn.addEventListener('click', handleCompare);
  settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
  searchInput.addEventListener('input', handleSearch);
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  
  // Theme controls
  if (themeBtn) {
    themeBtn.addEventListener('click', handleThemeChange);
  }
  if (modeBtn) {
    modeBtn.addEventListener('click', handleModeChange);
  }
}

// Theme Handlers
async function handleThemeChange() {
  currentTheme = nextTheme(currentTheme);
  applyTheme(currentTheme, currentMode);
  await saveThemePrefs(currentTheme, currentMode);
  updateThemeUI();
}

async function handleModeChange() {
  currentMode = nextMode(currentMode);
  applyTheme(currentTheme, currentMode);
  await saveThemePrefs(currentTheme, currentMode);
  updateThemeUI();
}

function updateThemeUI() {
  if (themeBtn) {
    const info = themeInfo[currentTheme];
    themeBtn.textContent = info?.icon || '🎨';
    themeBtn.title = `Theme: ${info?.name || currentTheme}`;
  }
  if (modeBtn) {
    const modeIcons = { light: '☀️', dark: '🌙', system: '🌓' };
    modeBtn.textContent = modeIcons[currentMode] || '🌓';
    modeBtn.title = `Mode: ${currentMode}`;
  }
}

// Handlers
async function handleSavePage() {
  savePageBtn.disabled = true;
  savePageBtn.textContent = 'Saving...';
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'savePage' });
    if (response.error) {
      alert('Error: ' + response.error);
    } else {
      await loadArchives();
    }
  } catch (error) {
    console.error('Save page error:', error);
    alert('Failed to save page');
  }
  
  savePageBtn.disabled = false;
  savePageBtn.innerHTML = '<span class="btn-icon">📄</span> Save This Page';
}

async function handleSaveSite() {
  const tab = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab[0].url;
  
  const depth = prompt('Crawl depth (1-3):', '1');
  if (!depth) return;
  
  const maxPages = prompt('Max pages to save:', '20');
  if (!maxPages) return;
  
  saveSiteBtn.disabled = true;
  saveSiteBtn.textContent = 'Crawling...';
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'saveSite',
      options: {
        url,
        depth: parseInt(depth),
        maxPages: parseInt(maxPages),
      },
    });
    
    if (response.error) {
      alert('Error: ' + response.error);
    } else {
      await loadArchives();
      alert(`Saved ${response.pageCount} pages!`);
    }
  } catch (error) {
    console.error('Save site error:', error);
    alert('Failed to save site');
  }
  
  saveSiteBtn.disabled = false;
  saveSiteBtn.innerHTML = '<span class="btn-icon">🌐</span> Save Site';
}

function handleCompare() {
  if (selectedForCompare.length !== 2) {
    alert('Select exactly 2 archives to compare (click and hold)');
    return;
  }
  
  chrome.runtime.sendMessage({
    action: 'compareVersions',
    archiveId1: selectedForCompare[0],
    archiveId2: selectedForCompare[1],
  }).then(response => {
    if (response.error) {
      alert('Error: ' + response.error);
    } else {
      const diff = response.diff;
      alert(`Size change: ${formatSize(diff.sizeChange)}\nTime difference: ${Math.round(diff.dateChange / 1000 / 60)} minutes`);
    }
  });
}

function handleSearch(e) {
  const query = e.target.value.toLowerCase();
  renderArchives(archives.filter(a => 
    a.title.toLowerCase().includes(query) ||
    a.url.toLowerCase().includes(query)
  ));
}

function switchTab(tabId) {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
  tabContents.forEach(c => c.classList.toggle('active', c.id === `${tabId}Tab`));
}

// Data Loading
async function loadArchives() {
  const response = await chrome.runtime.sendMessage({ action: 'getArchives' });
  archives = Array.isArray(response) ? response : [];
  renderArchives(archives);
}

async function loadAnnotations() {
  const response = await chrome.runtime.sendMessage({ action: 'getAnnotations' });
  annotations = Array.isArray(response) ? response : [];
  renderAnnotations(annotations);
}

// Rendering
function renderArchives(list) {
  if (list.length === 0) {
    archivesList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📭</span>
        <p>No archives yet</p>
        <p class="hint">Save a page to get started</p>
      </div>
    `;
    return;
  }
  
  archivesList.innerHTML = list.map(archive => `
    <div class="archive-item" data-id="${archive.id}">
      <span class="archive-icon">${getTypeIcon(archive.type)}</span>
      <div class="archive-info">
        <div class="archive-title">${escapeHtml(archive.title)}</div>
        <div class="archive-meta">
          ${formatDate(archive.createdAt)} • ${formatSize(archive.size)}
        </div>
      </div>
      <div class="archive-actions">
        <button class="open" title="Open">📖</button>
        <button class="export" title="Export">💾</button>
        <button class="delete" title="Delete">🗑️</button>
      </div>
    </div>
  `).join('');
  
  // Add event listeners to archive items
  archivesList.querySelectorAll('.archive-item').forEach(item => {
    const id = item.dataset.id;
    
    item.addEventListener('click', (e) => {
      if (!e.target.closest('.archive-actions')) {
        openArchive(id);
      }
    });
    
    item.querySelector('.open').addEventListener('click', (e) => {
      e.stopPropagation();
      openArchive(id);
    });
    
    item.querySelector('.export').addEventListener('click', (e) => {
      e.stopPropagation();
      exportArchive(id);
    });
    
    item.querySelector('.delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteArchive(id);
    });
  });
}

function renderAnnotations(list) {
  if (list.length === 0) {
    annotationsList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📝</span>
        <p>No annotations yet</p>
      </div>
    `;
    return;
  }
  
  annotationsList.innerHTML = list.map(ann => `
    <div class="annotation-item ${ann.color || ''}">
      <div class="annotation-text">${escapeHtml(ann.content)}</div>
      <div class="annotation-meta">${formatDate(ann.createdAt)}</div>
    </div>
  `).join('');
}

// Actions
async function openArchive(id) {
  await chrome.runtime.sendMessage({ action: 'openArchive', archiveId: id });
}

async function exportArchive(id) {
  await chrome.runtime.sendMessage({ action: 'exportZim', archiveId: id });
}

async function deleteArchive(id) {
  if (!confirm('Delete this archive?')) return;
  
  await chrome.runtime.sendMessage({ action: 'deleteArchive', archiveId: id });
  await loadArchives();
}

// Utilities
function getTypeIcon(type) {
  const icons = {
    page: '📄',
    site: '🌐',
    selection: '✂️',
    link: '🔗',
    image: '🖼️',
  };
  return icons[type] || '📄';
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  
  return date.toLocaleDateString();
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

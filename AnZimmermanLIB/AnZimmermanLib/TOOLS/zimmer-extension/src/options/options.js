// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

/**
 * Zimmer Options Page Script
 * Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.
 */

const SETTINGS_KEY = 'zimmer_settings';

const defaults = {
  storageQuota: 500,
  autoDelete: false,
  includeImages: true,
  includeStyles: true,
  crawlDepth: 1,
  noteColor: 'yellow',
  autoSaveAnnotations: true,
};

// Load settings on page load
document.addEventListener('DOMContentLoaded', async () => {
  const settings = await loadSettings();
  populateForm(settings);
  setupEventListeners();
});

async function loadSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...defaults, ...result[SETTINGS_KEY] };
}

function populateForm(settings) {
  document.getElementById('storageQuota').value = settings.storageQuota;
  document.getElementById('autoDelete').checked = settings.autoDelete;
  document.getElementById('includeImages').checked = settings.includeImages;
  document.getElementById('includeStyles').checked = settings.includeStyles;
  document.getElementById('crawlDepth').value = settings.crawlDepth;
  document.getElementById('noteColor').value = settings.noteColor;
  document.getElementById('autoSaveAnnotations').checked = settings.autoSaveAnnotations;
}

function setupEventListeners() {
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  document.getElementById('exportAllBtn').addEventListener('click', exportAllArchives);
  document.getElementById('clearAllBtn').addEventListener('click', clearAllData);
}

async function saveSettings() {
  const settings = {
    storageQuota: parseInt(document.getElementById('storageQuota').value),
    autoDelete: document.getElementById('autoDelete').checked,
    includeImages: document.getElementById('includeImages').checked,
    includeStyles: document.getElementById('includeStyles').checked,
    crawlDepth: parseInt(document.getElementById('crawlDepth').value),
    noteColor: document.getElementById('noteColor').value,
    autoSaveAnnotations: document.getElementById('autoSaveAnnotations').checked,
  };

  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  showToast('Settings saved!');
}

async function exportAllArchives() {
  const result = await chrome.storage.local.get('zimmer_archives');
  const archives = result.zimmer_archives || [];
  
  const blob = new Blob([JSON.stringify(archives, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `zimmer-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
  showToast('Archives exported!');
}

async function clearAllData() {
  if (!confirm('Are you sure you want to delete ALL archives and annotations? This cannot be undone.')) {
    return;
  }
  
  await chrome.storage.local.clear();
  showToast('All data cleared!');
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    padding: 12px 24px; background: #16213e; color: white; border-radius: 8px;
    font-size: 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  `;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 2000);
}

/**
 * Zimmer Viewer Script
 * Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.
 */

// DOM Elements
const archiveTitle = document.getElementById('archiveTitle');
const archiveMeta = document.getElementById('archiveMeta');
const pageList = document.getElementById('pageList');
const content = document.getElementById('content');
const searchInput = document.getElementById('searchInput');
const annotateBtn = document.getElementById('annotateBtn');
const exportBtn = document.getElementById('exportBtn');
const closeBtn = document.getElementById('closeBtn');

// State
let archive = null;
let pages = [];
let currentPage = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const archiveId = params.get('id');
  
  if (archiveId) {
    await loadArchive(archiveId);
  }
  
  setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
  searchInput.addEventListener('input', handleSearch);
  annotateBtn.addEventListener('click', toggleAnnotations);
  exportBtn.addEventListener('click', handleExport);
  closeBtn.addEventListener('click', () => window.close());
}

// Load archive from storage
async function loadArchive(archiveId) {
  const response = await chrome.runtime.sendMessage({ action: 'getArchives' });
  archive = response.find(a => a.id === archiveId);
  
  if (!archive) {
    archiveTitle.textContent = 'Archive not found';
    return;
  }
  
  archiveTitle.textContent = archive.title;
  archiveMeta.textContent = `${formatDate(archive.createdAt)} • ${archive.articles || 1} page(s) • ${formatSize(archive.size)}`;
  
  // Extract pages based on archive type
  switch (archive.type) {
    case 'site':
      pages = archive.content.pages || [];
      break;
    case 'page':
      pages = [{
        title: archive.title,
        url: archive.url,
        html: archive.content.html,
      }];
      break;
    case 'selection':
      pages = [{
        title: archive.title,
        url: archive.url,
        html: `<html><body style="padding: 40px; font-family: Georgia, serif;">
          <h2>Selection from ${archive.content.sourceTitle}</h2>
          <p style="margin-top: 20px; font-size: 18px; line-height: 1.6;">${archive.content.text}</p>
          <p style="margin-top: 20px; color: #888; font-size: 14px;">Source: <a href="${archive.content.sourceUrl}">${archive.content.sourceUrl}</a></p>
        </body></html>`,
      }];
      break;
    case 'image':
      pages = [{
        title: archive.title,
        url: archive.url,
        html: `<html><body style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #1a1a2e;">
          <img src="${archive.content.dataUrl}" style="max-width: 100%; max-height: 100vh;">
        </body></html>`,
      }];
      break;
    case 'link':
      pages = [{
        title: archive.title,
        url: archive.url,
        html: archive.content.html,
      }];
      break;
  }
  
  renderPageList(pages);
  
  // Auto-select first page
  if (pages.length > 0) {
    selectPage(pages[0]);
  }
}

// Render page list
function renderPageList(pagesToRender) {
  if (pagesToRender.length === 0) {
    pageList.innerHTML = '<div class="empty-state">No pages found</div>';
    return;
  }
  
  pageList.innerHTML = pagesToRender.map((page, index) => `
    <div class="page-item ${currentPage === page ? 'active' : ''}" data-index="${index}">
      <div class="page-item-title">${escapeHtml(page.title || 'Untitled')}</div>
      <div class="page-item-url">${escapeHtml(page.url || '')}</div>
    </div>
  `).join('');
  
  // Add click listeners
  pageList.querySelectorAll('.page-item').forEach((item, index) => {
    item.addEventListener('click', () => selectPage(pagesToRender[index]));
  });
}

// Select and display a page
function selectPage(page) {
  currentPage = page;
  
  // Update active state in list
  pageList.querySelectorAll('.page-item').forEach(item => {
    item.classList.toggle('active', pages[parseInt(item.dataset.index)] === page);
  });
  
  // Display content in iframe
  const iframe = document.createElement('iframe');
  iframe.sandbox = 'allow-same-origin';
  content.innerHTML = '';
  content.appendChild(iframe);
  
  // Write content to iframe
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(page.html);
  doc.close();
}

// Search handler
function handleSearch(e) {
  const query = e.target.value.toLowerCase();
  const filtered = pages.filter(p => 
    (p.title || '').toLowerCase().includes(query) ||
    (p.url || '').toLowerCase().includes(query)
  );
  renderPageList(filtered);
}

// Toggle annotations
let annotationsEnabled = false;
function toggleAnnotations() {
  annotationsEnabled = !annotationsEnabled;
  annotateBtn.classList.toggle('active', annotationsEnabled);
  
  // TODO: Implement annotation overlay on iframe content
  if (annotationsEnabled) {
    annotateBtn.innerHTML = '📝 Annotations ON';
  } else {
    annotateBtn.innerHTML = '📝 Annotate';
  }
}

// Export handler
async function handleExport() {
  if (!archive) return;
  
  await chrome.runtime.sendMessage({
    action: 'exportZim',
    archiveId: archive.id,
  });
}

// Utilities
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString();
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

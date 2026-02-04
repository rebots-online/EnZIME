// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

/**
 * Zimmer Chrome Extension - Background Service Worker
 * Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.
 */

import { ZIMReaderBrowser, ZIMWriterBrowser, archiveToZim, zimToArchive } from './lib/zimlib-browser.js';

// Storage keys
const STORAGE_KEYS = {
  ARCHIVES: 'zimmer_archives',
  SETTINGS: 'zimmer_settings',
  ANNOTATIONS: 'zimmer_annotations',
};

// Initialize context menus
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu items
  chrome.contextMenus.create({
    id: 'zimmer-save-page',
    title: 'Save Page to Zimmer',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: 'zimmer-save-selection',
    title: 'Save Selection to Zimmer',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'zimmer-save-link',
    title: 'Save Link Target to Zimmer',
    contexts: ['link'],
  });

  chrome.contextMenus.create({
    id: 'zimmer-save-image',
    title: 'Save Image to Zimmer',
    contexts: ['image'],
  });

  console.log('Zimmer extension installed');
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case 'zimmer-save-page':
      await savePage(tab);
      break;
    case 'zimmer-save-selection':
      await saveSelection(tab, info.selectionText);
      break;
    case 'zimmer-save-link':
      await saveLink(info.linkUrl);
      break;
    case 'zimmer-save-image':
      await saveImage(info.srcUrl);
      break;
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.action) {
    case 'savePage':
      return await savePage(await getCurrentTab());
    
    case 'saveSite':
      return await saveSite(message.options);
    
    case 'getArchives':
      return await getArchives();
    
    case 'openArchive':
      return await openArchive(message.archiveId);
    
    case 'deleteArchive':
      return await deleteArchive(message.archiveId);
    
    case 'compareVersions':
      return await compareVersions(message.archiveId1, message.archiveId2);
    
    case 'addAnnotation':
      return await addAnnotation(message.annotation);
    
    case 'getAnnotations':
      return await getAnnotations(message.archiveId, message.pageUrl);
    
    case 'exportZim':
      return await exportZim(message.archiveId);
    
    case 'importZim':
      return await importZim(message.data);
    
    default:
      console.warn('Unknown message action:', message.action);
      return { error: 'Unknown action' };
  }
}

// Get current active tab
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Save current page
async function savePage(tab) {
  try {
    // Inject content script to capture page
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: capturePageContent,
    });

    const pageData = results[0].result;
    
    // Create archive entry
    const archive = {
      id: generateId(),
      type: 'page',
      title: tab.title,
      url: tab.url,
      favicon: tab.favIconUrl,
      createdAt: new Date().toISOString(),
      size: 0,
      articles: 1,
      content: pageData,
    };

    // Save to storage
    await saveArchive(archive);

    // Notify success
    await showNotification('Page Saved', `"${tab.title}" saved to Zimmer`);

    return { success: true, archiveId: archive.id };
  } catch (error) {
    console.error('Failed to save page:', error);
    return { error: error.message };
  }
}

// Capture page content (injected into page)
function capturePageContent() {
  const html = document.documentElement.outerHTML;
  const styles = Array.from(document.styleSheets).map(sheet => {
    try {
      return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
    } catch {
      return '';
    }
  }).join('\n');

  // Get inline images as data URLs
  const images = {};
  document.querySelectorAll('img').forEach(img => {
    if (img.src.startsWith('data:')) {
      images[img.src] = img.src;
    }
  });

  return {
    html,
    styles,
    images,
    title: document.title,
    url: window.location.href,
  };
}

// Save selection
async function saveSelection(tab, selectionText) {
  try {
    const archive = {
      id: generateId(),
      type: 'selection',
      title: `Selection from ${tab.title}`,
      url: tab.url,
      favicon: tab.favIconUrl,
      createdAt: new Date().toISOString(),
      size: selectionText.length,
      articles: 1,
      content: {
        text: selectionText,
        sourceUrl: tab.url,
        sourceTitle: tab.title,
      },
    };

    await saveArchive(archive);
    await showNotification('Selection Saved', 'Text selection saved to Zimmer');

    return { success: true, archiveId: archive.id };
  } catch (error) {
    console.error('Failed to save selection:', error);
    return { error: error.message };
  }
}

// Save link target
async function saveLink(url) {
  try {
    const response = await fetch(url);
    const html = await response.text();

    const archive = {
      id: generateId(),
      type: 'link',
      title: url,
      url: url,
      createdAt: new Date().toISOString(),
      size: html.length,
      articles: 1,
      content: { html, url },
    };

    await saveArchive(archive);
    await showNotification('Link Saved', `Link saved to Zimmer`);

    return { success: true, archiveId: archive.id };
  } catch (error) {
    console.error('Failed to save link:', error);
    return { error: error.message };
  }
}

// Save image
async function saveImage(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);

    const archive = {
      id: generateId(),
      type: 'image',
      title: url.split('/').pop() || 'Image',
      url: url,
      createdAt: new Date().toISOString(),
      size: blob.size,
      articles: 1,
      content: { dataUrl, mimeType: blob.type },
    };

    await saveArchive(archive);
    await showNotification('Image Saved', 'Image saved to Zimmer');

    return { success: true, archiveId: archive.id };
  } catch (error) {
    console.error('Failed to save image:', error);
    return { error: error.message };
  }
}

// Save entire site (crawl)
async function saveSite(options) {
  const { url, depth = 1, maxPages = 50 } = options;
  
  try {
    const pages = [];
    const visited = new Set();
    const queue = [{ url, depth: 0 }];

    while (queue.length > 0 && pages.length < maxPages) {
      const { url: currentUrl, depth: currentDepth } = queue.shift();
      
      if (visited.has(currentUrl) || currentDepth > depth) continue;
      visited.add(currentUrl);

      try {
        const response = await fetch(currentUrl);
        const html = await response.text();
        
        pages.push({
          url: currentUrl,
          html,
          title: html.match(/<title>(.*?)<\/title>/i)?.[1] || currentUrl,
        });

        // Find links for crawling
        if (currentDepth < depth) {
          const linkRegex = /href=["']([^"']+)["']/g;
          let match;
          while ((match = linkRegex.exec(html)) !== null) {
            const href = match[1];
            if (href.startsWith('http') && new URL(href).origin === new URL(url).origin) {
              queue.push({ url: href, depth: currentDepth + 1 });
            }
          }
        }
      } catch (e) {
        console.warn('Failed to fetch:', currentUrl, e);
      }
    }

    const archive = {
      id: generateId(),
      type: 'site',
      title: `Site: ${new URL(url).hostname}`,
      url: url,
      createdAt: new Date().toISOString(),
      size: pages.reduce((sum, p) => sum + p.html.length, 0),
      articles: pages.length,
      content: { pages },
    };

    await saveArchive(archive);
    await showNotification('Site Saved', `${pages.length} pages saved to Zimmer`);

    return { success: true, archiveId: archive.id, pageCount: pages.length };
  } catch (error) {
    console.error('Failed to save site:', error);
    return { error: error.message };
  }
}

// Storage functions
async function getArchives() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.ARCHIVES);
  return result[STORAGE_KEYS.ARCHIVES] || [];
}

async function saveArchive(archive) {
  const archives = await getArchives();
  archives.unshift(archive);
  await chrome.storage.local.set({ [STORAGE_KEYS.ARCHIVES]: archives });
}

async function openArchive(archiveId) {
  const archives = await getArchives();
  const archive = archives.find(a => a.id === archiveId);
  if (!archive) {
    return { error: 'Archive not found' };
  }

  // Open viewer with archive
  const viewerUrl = chrome.runtime.getURL(`src/viewer/viewer.html?id=${archiveId}`);
  await chrome.tabs.create({ url: viewerUrl });

  return { success: true };
}

async function deleteArchive(archiveId) {
  const archives = await getArchives();
  const filtered = archives.filter(a => a.id !== archiveId);
  await chrome.storage.local.set({ [STORAGE_KEYS.ARCHIVES]: filtered });
  return { success: true };
}

// Compare two versions of an archive
async function compareVersions(archiveId1, archiveId2) {
  const archives = await getArchives();
  const archive1 = archives.find(a => a.id === archiveId1);
  const archive2 = archives.find(a => a.id === archiveId2);

  if (!archive1 || !archive2) {
    return { error: 'One or both archives not found' };
  }

  // Get content for comparison
  const content1 = extractTextContent(archive1);
  const content2 = extractTextContent(archive2);

  // Compute diff using simple line-based algorithm
  const textDiff = computeTextDiff(content1, content2);

  const diff = {
    sizeChange: archive2.size - archive1.size,
    dateChange: new Date(archive2.createdAt) - new Date(archive1.createdAt),
    contentDiff: textDiff,
    similarity: calculateSimilarity(content1, content2),
    archive1: { title: archive1.title, createdAt: archive1.createdAt, size: archive1.size },
    archive2: { title: archive2.title, createdAt: archive2.createdAt, size: archive2.size },
  };

  return { success: true, diff };
}

// Extract text content from archive for comparison
function extractTextContent(archive) {
  if (!archive.content) return '';

  if (archive.type === 'page' || archive.type === 'link') {
    const html = archive.content.html || '';
    return stripHtmlTags(html);
  } else if (archive.type === 'selection') {
    return archive.content.text || '';
  } else if (archive.type === 'site') {
    const pages = archive.content.pages || [];
    return pages.map(p => stripHtmlTags(p.html || '')).join('\n\n');
  }

  return '';
}

// Strip HTML tags to get plain text
function stripHtmlTags(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Simple line-based diff algorithm
function computeTextDiff(text1, text2) {
  const lines1 = text1.split(/[.!?]\s+/).filter(l => l.trim().length > 0);
  const lines2 = text2.split(/[.!?]\s+/).filter(l => l.trim().length > 0);

  const set1 = new Set(lines1.map(l => l.toLowerCase().trim()));
  const set2 = new Set(lines2.map(l => l.toLowerCase().trim()));

  const added = [];
  const removed = [];
  const unchanged = [];

  for (const line of lines1) {
    const normalized = line.toLowerCase().trim();
    if (!set2.has(normalized)) {
      removed.push(line);
    } else {
      unchanged.push(line);
    }
  }

  for (const line of lines2) {
    const normalized = line.toLowerCase().trim();
    if (!set1.has(normalized)) {
      added.push(line);
    }
  }

  return {
    added: added.slice(0, 20), // Limit for display
    removed: removed.slice(0, 20),
    unchanged: unchanged.length,
    totalAdded: added.length,
    totalRemoved: removed.length,
  };
}

// Calculate similarity percentage using Jaccard index
function calculateSimilarity(text1, text2) {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  if (words1.size === 0 && words2.size === 0) return 100;
  if (words1.size === 0 || words2.size === 0) return 0;

  let intersection = 0;
  for (const word of words1) {
    if (words2.has(word)) intersection++;
  }

  const union = words1.size + words2.size - intersection;
  return Math.round((intersection / union) * 100);
}

// Annotation functions
async function addAnnotation(annotation) {
  const result = await chrome.storage.local.get(STORAGE_KEYS.ANNOTATIONS);
  const annotations = result[STORAGE_KEYS.ANNOTATIONS] || [];
  
  annotation.id = generateId();
  annotation.createdAt = new Date().toISOString();
  annotations.push(annotation);
  
  await chrome.storage.local.set({ [STORAGE_KEYS.ANNOTATIONS]: annotations });
  return { success: true, annotationId: annotation.id };
}

async function getAnnotations(archiveId, pageUrl) {
  const result = await chrome.storage.local.get(STORAGE_KEYS.ANNOTATIONS);
  const annotations = result[STORAGE_KEYS.ANNOTATIONS] || [];
  
  return annotations.filter(a => 
    (!archiveId || a.archiveId === archiveId) &&
    (!pageUrl || a.pageUrl === pageUrl)
  );
}

// Export/Import ZIM
async function exportZim(archiveId) {
  const archives = await getArchives();
  const archive = archives.find(a => a.id === archiveId);
  
  if (!archive) {
    return { error: 'Archive not found' };
  }

  try {
    // Convert to actual ZIM format using our clean-room library
    const zimBlob = await archiveToZim(archive);
    const url = URL.createObjectURL(zimBlob);
    
    // Sanitize filename
    const safeTitle = archive.title
      .replace(/[^a-z0-9]/gi, '_')
      .substring(0, 50);
    
    await chrome.downloads.download({
      url,
      filename: `${safeTitle}.zim`,
      saveAs: true,
    });

    // Cleanup blob URL after download starts
    setTimeout(() => URL.revokeObjectURL(url), 60000);

    return { success: true };
  } catch (error) {
    console.error('ZIM export error:', error);
    
    // Fallback to JSON export
    const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    await chrome.downloads.download({
      url,
      filename: `${archive.title.replace(/[^a-z0-9]/gi, '_')}.zimmer.json`,
      saveAs: true,
    });

    return { success: true, format: 'json', note: 'Exported as JSON (ZIM conversion failed)' };
  }
}

async function importZim(data) {
  try {
    // Check if data is ArrayBuffer (ZIM file) or string (JSON)
    if (data instanceof ArrayBuffer) {
      // Parse ZIM file using our clean-room library
      const archive = await zimToArchive(data);
      archive.id = generateId();
      archive.createdAt = new Date().toISOString();
      
      await saveArchive(archive);
      return { success: true, archiveId: archive.id, format: 'zim' };
    } else if (typeof data === 'string') {
      // Try parsing as JSON
      const archive = JSON.parse(data);
      archive.id = generateId();
      archive.createdAt = new Date().toISOString();
      
      await saveArchive(archive);
      return { success: true, archiveId: archive.id, format: 'json' };
    } else {
      return { error: 'Unsupported import format' };
    }
  } catch (error) {
    console.error('Import error:', error);
    return { error: 'Invalid archive data: ' + error.message };
  }
}

// Utility functions
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function showNotification(title, message) {
  // Use chrome notifications API if available
  if (chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title,
      message,
    });
  }
}

console.log('Zimmer background service worker started');

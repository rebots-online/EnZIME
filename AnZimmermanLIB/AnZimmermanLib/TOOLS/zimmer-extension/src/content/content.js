// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

/**
 * Zimmer Content Script - Page Interaction and Annotation Overlay
 * Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.
 */

// State
let annotationMode = false;
let annotations = [];
let overlay = null;
let canvas = null;
let ctx = null;
let isDrawing = false;
let currentTool = 'highlight'; // highlight, ink, note

// Initialize
function init() {
  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'toggleAnnotationMode':
        toggleAnnotationMode(message.enabled);
        sendResponse({ success: true });
        break;
      case 'setTool':
        currentTool = message.tool;
        sendResponse({ success: true });
        break;
      case 'getPageContent':
        sendResponse(capturePageContent());
        break;
      case 'loadAnnotations':
        loadAnnotations(message.annotations);
        sendResponse({ success: true });
        break;
    }
    return true;
  });

  // Check if we should restore annotations for this page
  loadSavedAnnotations();
}

// Toggle annotation mode
function toggleAnnotationMode(enabled) {
  annotationMode = enabled;
  
  if (enabled) {
    createOverlay();
  } else {
    removeOverlay();
  }
}

// Create annotation overlay
function createOverlay() {
  if (overlay) return;

  // Create overlay container
  overlay = document.createElement('div');
  overlay.id = 'zimmer-overlay';
  overlay.innerHTML = `
    <div class="zimmer-toolbar">
      <button data-tool="highlight" class="active" title="Highlight">🖍️</button>
      <button data-tool="ink" title="Draw">✏️</button>
      <button data-tool="note" title="Add Note">📝</button>
      <button data-tool="voice" title="Voice Note">🎤</button>
      <div class="zimmer-divider"></div>
      <button data-action="clear" title="Clear All">🗑️</button>
      <button data-action="save" title="Save">💾</button>
      <button data-action="close" title="Close">✖️</button>
    </div>
    <canvas id="zimmer-canvas"></canvas>
  `;
  document.body.appendChild(overlay);

  // Setup canvas
  canvas = document.getElementById('zimmer-canvas');
  ctx = canvas.getContext('2d');
  resizeCanvas();

  // Event listeners
  window.addEventListener('resize', resizeCanvas);
  
  // Toolbar events
  overlay.querySelectorAll('[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTool = btn.dataset.tool;
      canvas.style.pointerEvents = currentTool === 'ink' ? 'auto' : 'none';
    });
  });

  overlay.querySelector('[data-action="clear"]').addEventListener('click', clearAnnotations);
  overlay.querySelector('[data-action="save"]').addEventListener('click', saveAnnotations);
  overlay.querySelector('[data-action="close"]').addEventListener('click', () => toggleAnnotationMode(false));

  // Canvas drawing events
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);

  // Document events for highlights and notes
  document.addEventListener('mouseup', handleTextSelection);
  document.addEventListener('click', handleClick);

  // Render existing annotations
  renderAnnotations();
}

// Remove overlay
function removeOverlay() {
  if (!overlay) return;
  
  window.removeEventListener('resize', resizeCanvas);
  document.removeEventListener('mouseup', handleTextSelection);
  document.removeEventListener('click', handleClick);
  
  overlay.remove();
  overlay = null;
  canvas = null;
  ctx = null;
}

// Resize canvas to match viewport
function resizeCanvas() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  renderAnnotations();
}

// Drawing functions
function startDrawing(e) {
  if (currentTool !== 'ink') return;
  isDrawing = true;
  ctx.beginPath();
  ctx.moveTo(e.clientX, e.clientY);
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function draw(e) {
  if (!isDrawing || currentTool !== 'ink') return;
  ctx.lineTo(e.clientX, e.clientY);
  ctx.stroke();
}

function stopDrawing() {
  if (!isDrawing) return;
  isDrawing = false;
  
  // Save ink annotation
  const dataUrl = canvas.toDataURL('image/png');
  annotations.push({
    type: 'ink',
    content: dataUrl,
    timestamp: Date.now(),
  });
}

// Handle text selection for highlights
function handleTextSelection() {
  if (!annotationMode || currentTool !== 'highlight') return;
  
  const selection = window.getSelection();
  if (selection.isCollapsed) return;
  
  const text = selection.toString().trim();
  if (!text) return;
  
  const range = selection.getRangeAt(0);
  const rects = range.getClientRects();
  
  // Create highlight
  const highlight = document.createElement('span');
  highlight.className = 'zimmer-highlight';
  highlight.dataset.annotationId = Date.now().toString();
  
  try {
    range.surroundContents(highlight);
    
    annotations.push({
      type: 'highlight',
      text: text,
      xpath: getXPath(highlight),
      timestamp: Date.now(),
    });
    
    selection.removeAllRanges();
  } catch (e) {
    console.warn('Could not highlight selection:', e);
  }
}

// Handle click for note placement
function handleClick(e) {
  if (!annotationMode || currentTool !== 'note') return;
  if (e.target.closest('.zimmer-overlay, .zimmer-toolbar, .zimmer-note')) return;
  
  const note = prompt('Enter your note:');
  if (!note) return;
  
  createNote(e.clientX, e.clientY, note);
  
  annotations.push({
    type: 'note',
    content: note,
    x: e.clientX + window.scrollX,
    y: e.clientY + window.scrollY,
    timestamp: Date.now(),
  });
}

// Create visual note element
function createNote(x, y, content) {
  const note = document.createElement('div');
  note.className = 'zimmer-note';
  note.style.left = `${x}px`;
  note.style.top = `${y}px`;
  note.innerHTML = `
    <div class="zimmer-note-content">${escapeHtml(content)}</div>
    <button class="zimmer-note-delete">×</button>
  `;
  
  note.querySelector('.zimmer-note-delete').addEventListener('click', () => {
    note.remove();
    annotations = annotations.filter(a => 
      !(a.type === 'note' && a.x === x + window.scrollX && a.y === y + window.scrollY)
    );
  });
  
  document.body.appendChild(note);
}

// Render all annotations
function renderAnnotations() {
  // Redraw ink annotations
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    annotations.filter(a => a.type === 'ink').forEach(a => {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = a.content;
    });
  }
  
  // Render notes
  document.querySelectorAll('.zimmer-note').forEach(n => n.remove());
  annotations.filter(a => a.type === 'note').forEach(a => {
    createNote(a.x - window.scrollX, a.y - window.scrollY, a.content);
  });
}

// Clear all annotations
function clearAnnotations() {
  if (!confirm('Clear all annotations on this page?')) return;
  
  annotations = [];
  
  // Clear canvas
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  
  // Remove highlights
  document.querySelectorAll('.zimmer-highlight').forEach(h => {
    const text = document.createTextNode(h.textContent);
    h.parentNode.replaceChild(text, h);
  });
  
  // Remove notes
  document.querySelectorAll('.zimmer-note').forEach(n => n.remove());
}

// Save annotations to storage
function saveAnnotations() {
  chrome.runtime.sendMessage({
    action: 'addAnnotation',
    annotation: {
      pageUrl: window.location.href,
      pageTitle: document.title,
      annotations: annotations,
    }
  }, response => {
    if (response.success) {
      showToast('Annotations saved!');
    }
  });
}

// Load saved annotations for current page
async function loadSavedAnnotations() {
  const response = await chrome.runtime.sendMessage({
    action: 'getAnnotations',
    pageUrl: window.location.href,
  });
  
  if (response && response.length > 0) {
    const pageAnnotations = response.find(a => a.pageUrl === window.location.href);
    if (pageAnnotations) {
      annotations = pageAnnotations.annotations || [];
    }
  }
}

// Load annotations from message
function loadAnnotations(newAnnotations) {
  annotations = newAnnotations;
  if (annotationMode) {
    renderAnnotations();
  }
}

// Capture page content
function capturePageContent() {
  return {
    html: document.documentElement.outerHTML,
    title: document.title,
    url: window.location.href,
    timestamp: Date.now(),
  };
}

// Utility: Get XPath for element
function getXPath(element) {
  if (!element) return '';
  if (element.id) return `//*[@id="${element.id}"]`;
  
  const parts = [];
  while (element && element.nodeType === Node.ELEMENT_NODE) {
    let index = 1;
    let sibling = element.previousSibling;
    while (sibling) {
      if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === element.tagName) {
        index++;
      }
      sibling = sibling.previousSibling;
    }
    parts.unshift(`${element.tagName.toLowerCase()}[${index}]`);
    element = element.parentNode;
  }
  return '/' + parts.join('/');
}

// Utility: Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Utility: Show toast notification
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'zimmer-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// Initialize on load
init();

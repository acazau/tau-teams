/**
 * Lightweight Markdown renderer — no dependencies.
 * Handles: headings, bold, italic, inline code, code blocks with language,
 * links, unordered/ordered lists, blockquotes, horizontal rules, paragraphs.
 */

export function renderMarkdown(text) {
  if (!text) return '';

  // Normalize line endings
  text = text.replace(/\r\n/g, '\n');

  // Extract code blocks first to protect them
  const codeBlocks = [];
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ lang, code: code.replace(/\n$/, '') });
    return `\x00CODEBLOCK_${idx}\x00`;
  });

  // Split into lines and process block-level elements
  const lines = text.split('\n');
  let html = '';
  let inList = false;
  let listType = '';
  let inBlockquote = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Code block placeholder
    const codeMatch = line.match(/^\x00CODEBLOCK_(\d+)\x00$/);
    if (codeMatch) {
      if (inList) { html += `</${listType}>`; inList = false; }
      if (inBlockquote) { html += '</blockquote>'; inBlockquote = false; }
      const block = codeBlocks[parseInt(codeMatch[1])];
      // Mermaid diagrams get rendered as interactive SVG with share toolbar
      if (block.lang === 'mermaid') {
        const mermaidId = 'mermaid-src-' + (window._mermaidSourceCounter = (window._mermaidSourceCounter || 0) + 1);
        // Store raw source in a global map — avoids data-attribute escaping issues
        window._mermaidSources = window._mermaidSources || {};
        window._mermaidSources[mermaidId] = block.code;
        html += `<div class="mermaid-wrapper">`;
        html += `<div class="mermaid-toolbar">`;
        html += `<button class="mermaid-btn" onclick="copyMermaidSource('${mermaidId}')" title="Copy Mermaid source"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</button>`;
        html += `<button class="mermaid-btn" onclick="openMermaidLive('${mermaidId}')" title="Open in mermaid.live"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Share</button>`;
        html += `</div>`;
        html += `<div class="mermaid">${escapeHtml(block.code)}</div></div>`;
        continue;
      }
      const langLabel = block.lang || 'code';
      html += `<div class="code-block-wrapper">`;
      html += `<div class="code-block-header"><span>${escapeHtml(langLabel)}</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>`;
      html += `<pre><code>${escapeHtml(block.code)}</code></pre></div>`;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      if (inList) { html += `</${listType}>`; inList = false; }
      if (inBlockquote) { html += '</blockquote>'; inBlockquote = false; }
      html += '<hr>';
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (inList) { html += `</${listType}>`; inList = false; }
      if (inBlockquote) { html += '</blockquote>'; inBlockquote = false; }
      const level = headingMatch[1].length;
      html += `<h${level}>${renderInline(headingMatch[2])}</h${level}>`;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      if (inList) { html += `</${listType}>`; inList = false; }
      if (!inBlockquote) { html += '<blockquote>'; inBlockquote = true; }
      html += renderInline(line.slice(2)) + '<br>';
      continue;
    } else if (inBlockquote) {
      html += '</blockquote>';
      inBlockquote = false;
    }

    // Unordered list
    const ulMatch = line.match(/^(\s*)[*\-+]\s+(.+)$/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) html += `</${listType}>`;
        html += '<ul>';
        inList = true;
        listType = 'ul';
      }
      html += `<li>${renderInline(ulMatch[2])}</li>`;
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) html += `</${listType}>`;
        html += '<ol>';
        inList = true;
        listType = 'ol';
      }
      html += `<li>${renderInline(olMatch[2])}</li>`;
      continue;
    }

    // Close list if we're out of list items
    if (inList) {
      html += `</${listType}>`;
      inList = false;
    }

    // Empty line
    if (line.trim() === '') {
      continue;
    }

    // Regular paragraph
    html += `<p>${renderInline(line)}</p>`;
  }

  // Close any open blocks
  if (inList) html += `</${listType}>`;
  if (inBlockquote) html += '</blockquote>';

  return html;
}

function renderInline(text) {
  // Inline code (must come first to protect content)
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold + italic
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');

  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/_(.+?)_/g, '<em>$1</em>');

  // Strikethrough
  text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Auto-link bare URLs
  text = text.replace(/(^|[^"'])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');

  return text;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Global copy Mermaid source — accepts a source ID key
window.copyMermaidSource = function(idOrBtn) {
  const source = window._mermaidSources?.[idOrBtn] || '';
  if (!source) return;
  const btn = document.querySelector(`[onclick*="${idOrBtn}"]`);
  const doCopy = (t) => {
    if (navigator.clipboard) return navigator.clipboard.writeText(t);
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return Promise.resolve();
  };
  doCopy(source).then(() => {
    if (!btn) return;
    const orig = btn.innerHTML;
    btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('copied'); }, 1500);
  });
};

// Global open in mermaid.live — accepts a source ID key
window.openMermaidLive = function(id) {
  const source = window._mermaidSources?.[id] || '';
  if (!source) return;
  try {
    const state = { code: source, mermaid: { theme: 'dark' } };
    const json = JSON.stringify(state);
    const compressed = window.pako.deflate(new TextEncoder().encode(json));
    // Convert Uint8Array to base64 safely (handles large diagrams)
    let binary = '';
    for (let i = 0; i < compressed.length; i++) {
      binary += String.fromCharCode(compressed[i]);
    }
    const base64 = btoa(binary);
    const url = 'https://mermaid.live/edit#pako:' + base64;
    window.open(url, '_blank');
  } catch (e) {
    console.error('Failed to encode mermaid.live URL:', e);
    // Fallback: copy source and open mermaid.live empty
    window.copyMermaidSource(id);
    window.open('https://mermaid.live/edit', '_blank');
  }
};

// Global copy function for code blocks
window.copyCode = function(btn) {
  const codeBlock = btn.closest('.code-block-wrapper').querySelector('code');
  const text = codeBlock.textContent;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Copy';
      btn.classList.remove('copied');
    }, 2000);
  });
};

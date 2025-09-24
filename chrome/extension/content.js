// Content script to extract page content
let lastExtractedContent = '';

console.log('[MCP Content Script] Loaded on:', window.location.href);

// Skip content extraction on Spotify and music streaming sites
function shouldSkipContentExtraction() {
  const url = window.location.href;
  const skipDomains = [
    'open.spotify.com',
    'music.youtube.com',
    'soundcloud.com',
    'music.apple.com',
    'tidal.com'
  ];
  
  const shouldSkip = skipDomains.some(domain => url.includes(domain));
  if (shouldSkip) {
    console.log('[MCP Content Script] Skipping content extraction on music site:', url);
  }
  return shouldSkip;
}

function extractPageContent() {
  // Try to extract key content elements
  const extractors = [
    // Page title
    () => document.title,
    
    // Meta description
    () => {
      const meta = document.querySelector('meta[name="description"]');
      return meta ? meta.content : '';
    },
    
    // Article title
    () => {
      const selectors = ['h1', 'article h1', '.article-title', '.post-title', '#title'];
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          return element.textContent.trim();
        }
      }
      return '';
    },
    
    // Main content
    () => {
      const selectors = [
        'main', 'article', '[role="main"]', '.content', '#content', 
        '.post-content', '.article-content', '.entry-content'
      ];
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          // Clone element to avoid modifying original
          const clone = element.cloneNode(true);
          
          // Remove script, style, and navigation elements
          const unwantedElements = clone.querySelectorAll('script, style, nav, .navigation, .nav, .menu, .sidebar, .ad, .advertisement, .social, .share');
          unwantedElements.forEach(el => el.remove());
          
          // Get clean text content
          let text = clone.textContent.trim();
          
          // Clean up the text
          text = text
            .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
            .replace(/\n\s*\n/g, '\n')  // Replace multiple newlines with single newline
            .trim();
          
          return text.substring(0, 1000);
        }
      }
      return '';
    },
    
    // Fallback: get some body text
    () => {
      // Clone body to avoid modifying original
      const bodyClone = document.body.cloneNode(true);
      
      // Remove unwanted elements
      const unwantedElements = bodyClone.querySelectorAll('script, style, nav, .navigation, .nav, .menu, .sidebar, .ad, .advertisement, .social, .share, header, footer');
      unwantedElements.forEach(el => el.remove());
      
      let bodyText = bodyClone.textContent.trim();
      
      // Clean up the text more thoroughly
      bodyText = bodyText
        .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
        .replace(/[^\w\s가-힣.,!?-]/g, '')  // Keep only letters, numbers, Korean chars, basic punctuation
        .trim();
      
      return bodyText.substring(0, 500);
    }
  ];

  const contentParts = [];
  for (const extractor of extractors) {
    try {
      const content = extractor();
      if (content && content.trim()) {
        contentParts.push(content.trim());
      }
    } catch (e) {
      console.error('Content extraction error:', e);
    }
  }

  return contentParts.join('\n\n');
}

// Send content to background script
function sendContentUpdate() {
  // Skip content extraction on music sites
  if (shouldSkipContentExtraction()) {
    console.log('[MCP Content Script] Content extraction skipped for music site');
    return;
  }
  
  try {
    const content = extractPageContent();
    console.log('[MCP Content Script] Extracted content length:', content.length);
    
    // Always send the update, even if content is the same
    lastExtractedContent = content;
    chrome.runtime.sendMessage({
      type: 'contentExtracted',
      content: content || 'Unable to extract meaningful content from this page',
      url: window.location.href
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[MCP Content Script] Error sending message:', chrome.runtime.lastError);
      } else {
        console.log('[MCP Content Script] Message sent successfully');
      }
    });
  } catch (error) {
    console.error('[MCP Content Script] Error in sendContentUpdate:', error);
    chrome.runtime.sendMessage({
      type: 'contentExtracted',
      content: 'Error extracting content: ' + error.message,
      url: window.location.href
    });
  }
}

// Initial extraction - try immediately and after a delay (only if not music site)
if (!shouldSkipContentExtraction()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sendContentUpdate);
  } else {
    // DOM is already loaded, extract content immediately
    sendContentUpdate();
  }
  
  // Also try after a delay to catch dynamic content
  setTimeout(sendContentUpdate, 1000);
}

// Listen for requests from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[MCP Content Script] Received message:', request.type);
  if (request.type === 'extractContent') {
    sendContentUpdate();
    sendResponse({ success: true });
  }
  return true; // Keep the message channel open for async response
});
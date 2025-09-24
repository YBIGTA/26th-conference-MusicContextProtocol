// Spotify Web Player content script
console.log('[MCP Spotify Web] Loaded on:', window.location.href);

let trackEndCheckInterval;
let lastTrackInfo = null;

// Listen for auto-play commands
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[MCP Spotify Web] Received message:', request.type);
  
  if (request.type === 'setupSpotifyEndListener') {
    setupSpotifyEndListener();
    sendResponse({ success: true });
  } else if (request.type === 'triggerAutoPlay') {
    console.log('[MCP Spotify Web] Triggering auto-play...');
    
    // First check if we need to handle login/premium prompts
    handleSpotifyRestrictions();
    
    // Then try auto-play
    setTimeout(() => {
      tryAutoPlayFirstResult();
    }, 1000);
    
    sendResponse({ success: true });
  }
  
  return true;
});

function handleSpotifyRestrictions() {
  console.log('[MCP Spotify Web] Checking for Spotify restrictions...');
  
  // Check for login prompts and dismiss them
  const loginPrompts = [
    'button[data-testid="login-button"]',
    '.connect-device-list-item',
    '.connect-device-picker',
    '[data-testid="web-player-error"]'
  ];
  
  loginPrompts.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
      if (element.offsetParent !== null) {
        console.log('[MCP Spotify Web] Found login/restriction element:', selector);
        // Try to close or dismiss it
        const closeButton = element.querySelector('button[aria-label*="Close"], button[aria-label*="close"], .close');
        if (closeButton) {
          closeButton.click();
        }
      }
    });
  });
  
  // Handle premium prompts
  const premiumPrompts = document.querySelectorAll('.upgrade-button, [data-testid="upgrade-button"], .premium-upsell');
  premiumPrompts.forEach(prompt => {
    if (prompt.offsetParent !== null) {
      console.log('[MCP Spotify Web] Found premium prompt, attempting to dismiss...');
      const dismissButton = prompt.querySelector('button[aria-label*="dismiss"], button[aria-label*="close"], .dismiss, .close');
      if (dismissButton) {
        dismissButton.click();
      }
    }
  });
  
  // Check for "can't play this song" messages
  const errorMessages = document.querySelectorAll('[data-testid="web-player-error"], .error-message, .playback-error');
  errorMessages.forEach(error => {
    if (error.offsetParent !== null && error.textContent) {
      console.log('[MCP Spotify Web] Found error message:', error.textContent);
      // If it's a premium or login error, try to find and play a different track
      if (error.textContent.includes('Premium') || error.textContent.includes('log in') || error.textContent.includes('can\'t play')) {
        console.log('[MCP Spotify Web] Attempting to find alternative track...');
        setTimeout(() => {
          tryAlternativeTrack();
        }, 2000);
      }
    }
  });
}

function tryAlternativeTrack() {
  console.log('[MCP Spotify Web] Trying to find alternative tracks...');
  
  // Look for other tracks in search results
  const tracks = document.querySelectorAll('[data-testid="tracklist-row"]:not(:first-child)');
  
  if (tracks.length > 0) {
    console.log(`[MCP Spotify Web] Found ${tracks.length} alternative tracks`);
    
    // Try the second track
    const secondTrack = tracks[0];
    if (secondTrack.offsetParent !== null) {
      console.log('[MCP Spotify Web] Trying second track...');
      secondTrack.click();
      
      setTimeout(() => {
        tryClickMainPlayButton();
      }, 1000);
    }
  } else {
    console.log('[MCP Spotify Web] No alternative tracks found');
  }
}

function setupSpotifyEndListener() {
  console.log('[MCP Spotify Web] Setting up Spotify end listener...');
  
  // Wait for Spotify web player to load
  setTimeout(() => {
    startTrackMonitoring();
  }, 3000);
}

function startTrackMonitoring() {
  // Clear any existing interval
  if (trackEndCheckInterval) {
    clearInterval(trackEndCheckInterval);
  }
  
  console.log('[MCP Spotify Web] Starting track monitoring...');
  
  // Check track status every 2 seconds
  trackEndCheckInterval = setInterval(() => {
    checkTrackStatus();
  }, 2000);
}

function checkTrackStatus() {
  try {
    // Method 1: Try to get current track info from DOM
    const trackInfo = getCurrentTrackInfo();
    
    if (trackInfo) {
      // Check if track changed or ended
      if (lastTrackInfo && lastTrackInfo.name !== trackInfo.name) {
        console.log('[MCP Spotify Web] Track changed from', lastTrackInfo.name, 'to', trackInfo.name);
        chrome.runtime.sendMessage({ type: 'audioEnded' });
      }
      
      lastTrackInfo = trackInfo;
    }
    
    // Method 2: Check for play/pause button state
    const playButton = document.querySelector('[data-testid="control-button-playpause"]');
    if (playButton) {
      const isPlaying = playButton.getAttribute('aria-label')?.includes('Pause');
      
      // If not playing and we had a track, it might have ended
      if (!isPlaying && lastTrackInfo) {
        const currentTime = getCurrentTime();
        const duration = getDuration();
        
        // If we're at the end or very close to it
        if (currentTime > 0 && duration > 0 && (currentTime / duration) > 0.95) {
          console.log('[MCP Spotify Web] Track appears to have ended');
          chrome.runtime.sendMessage({ type: 'audioEnded' });
          lastTrackInfo = null;
        }
      }
    }
    
  } catch (error) {
    console.error('[MCP Spotify Web] Error checking track status:', error);
  }
}

function getCurrentTrackInfo() {
  try {
    // Try to get track name from various selectors
    const trackSelectors = [
      '[data-testid="now-playing-widget"] a[href*="/track/"]',
      '.now-playing-bar__left a[href*="/track/"]',
      '.player-bar a[href*="/track/"]'
    ];
    
    for (const selector of trackSelectors) {
      const trackElement = document.querySelector(selector);
      if (trackElement) {
        return {
          name: trackElement.textContent?.trim() || 'Unknown',
          url: trackElement.href
        };
      }
    }
    
    // Fallback: try to get from title or other elements
    const title = document.title;
    if (title && title !== 'Spotify') {
      return {
        name: title.replace(' | Spotify', ''),
        url: window.location.href
      };
    }
    
    return null;
  } catch (error) {
    console.error('[MCP Spotify Web] Error getting track info:', error);
    return null;
  }
}

function getCurrentTime() {
  try {
    const timeElement = document.querySelector('[data-testid="playback-position"]');
    if (timeElement) {
      const timeText = timeElement.textContent;
      return parseTimeToSeconds(timeText);
    }
    return 0;
  } catch (error) {
    return 0;
  }
}

function getDuration() {
  try {
    const durationElement = document.querySelector('[data-testid="playback-duration"]');
    if (durationElement) {
      const timeText = durationElement.textContent;
      return parseTimeToSeconds(timeText);
    }
    return 0;
  } catch (error) {
    return 0;
  }
}

function parseTimeToSeconds(timeString) {
  try {
    const parts = timeString.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return 0;
  } catch (error) {
    return 0;
  }
}

// Auto-start monitoring if we're on a track page
if (window.location.href.includes('open.spotify.com')) {
  console.log('[MCP Spotify Web] Page loaded, setting up auto-play...');
  
  // Try auto-play immediately for search pages
  if (window.location.href.includes('/search/')) {
    setTimeout(() => {
      tryAutoPlayFirstResult();
    }, 2000);
  }
  
  // Also try when tab becomes visible
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.location.href.includes('/search/')) {
      console.log('[MCP Spotify Web] Tab became visible, trying auto-play...');
      setTimeout(() => {
        tryAutoPlayFirstResult();
      }, 1000);
    }
  });
  
  // Start monitoring
  setTimeout(() => {
    setupSpotifyEndListener();
  }, 3000);
}

function tryAutoPlayFirstResult() {
  console.log('[MCP Spotify Web] Trying to auto-play first search result...');
  
  // Try multiple times with increasing delays and more attempts
  const attempts = [1500, 3000, 5000, 8000, 12000];
  
  attempts.forEach((delay, index) => {
    setTimeout(() => {
      console.log(`[MCP Spotify Web] Auto-play attempt ${index + 1}/${attempts.length}`);
      
      // Method 1: Try clicking on first track to select it
      const trackSelectors = [
        '[data-testid="tracklist-row"] button[data-testid="play-button"]', // Direct play button on track
        '[data-testid="tracklist-row"]', // Track row itself
        '.track-row',
        '[role="row"]',
        'div[data-testid="search-category-card"]', // Search result cards
        '.searchResult'
      ];
      
      let trackFound = false;
      for (const selector of trackSelectors) {
        const tracks = document.querySelectorAll(selector);
        console.log(`[MCP Spotify Web] Found ${tracks.length} tracks with selector: ${selector}`);
        
        if (tracks.length > 0) {
          const firstTrack = tracks[0];
          if (firstTrack.offsetParent !== null) {
            console.log('[MCP Spotify Web] Clicking first track element:', firstTrack);
            
            // Scroll into view first
            firstTrack.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Wait a bit then click
            setTimeout(() => {
              firstTrack.click();
              trackFound = true;
              
              // After clicking track, wait and try to click play
              setTimeout(() => {
                tryClickMainPlayButton();
              }, 1000);
              
            }, 300);
            break;
          }
        }
      }
      
      // Method 2: If no track found, try direct play buttons
      if (!trackFound) {
        console.log('[MCP Spotify Web] No tracks found, trying direct play buttons...');
        tryClickMainPlayButton();
      }
      
      // Method 3: Try navigating to first track URL if we're still on search
      if (window.location.href.includes('/search/') && index >= 2) {
        console.log('[MCP Spotify Web] Trying to find direct track links...');
        const trackLinks = document.querySelectorAll('a[href*="/track/"]:not([href*="#"])');
        if (trackLinks.length > 0) {
          console.log('[MCP Spotify Web] Found track link, navigating:', trackLinks[0].href);
          window.location.href = trackLinks[0].href;
        }
      }
      
    }, delay);
  });
}

function tryClickMainPlayButton() {
  console.log('[MCP Spotify Web] Trying to click main play button...');
  
  // First try: Spacebar to play (most reliable for Spotify web)
  console.log('[MCP Spotify Web] Trying spacebar to play...');
  simulateKeyPress(' '); // Spacebar
  
  // Wait and check if it worked
  setTimeout(() => {
    const playButton = document.querySelector('[data-testid="control-button-playpause"]');
    if (playButton && playButton.getAttribute('aria-label')?.includes('Pause')) {
      console.log('[MCP Spotify Web] Spacebar worked! Music is playing.');
      return true;
    }
    
    // If spacebar didn't work, try clicking buttons
    tryClickPlayButtons();
  }, 1000);
  
  return false;
}

function simulateKeyPress(key) {
  // Simulate keydown and keyup events
  const keydownEvent = new KeyboardEvent('keydown', {
    key: key,
    code: key === ' ' ? 'Space' : key,
    which: key === ' ' ? 32 : key.charCodeAt(0),
    keyCode: key === ' ' ? 32 : key.charCodeAt(0),
    bubbles: true,
    cancelable: true
  });
  
  const keyupEvent = new KeyboardEvent('keyup', {
    key: key,
    code: key === ' ' ? 'Space' : key,
    which: key === ' ' ? 32 : key.charCodeAt(0),
    keyCode: key === ' ' ? 32 : key.charCodeAt(0),
    bubbles: true,
    cancelable: true
  });
  
  document.dispatchEvent(keydownEvent);
  setTimeout(() => document.dispatchEvent(keyupEvent), 50);
  console.log('[MCP Spotify Web] Simulated key press:', key);
}

function tryClickPlayButtons() {
  console.log('[MCP Spotify Web] Trying to click play buttons...');
  
  // Look for various play button selectors
  const playButtonSelectors = [
    '[data-testid="control-button-playpause"]', // Main player control
    '[data-testid="play-button"]', // General play button
    'button[aria-label*="Play"]', // Any button with "Play" in aria-label
    '.player-controls button[title*="Play"]',
    '.control-button[aria-label*="Play"]',
    '[data-ca-target-id="play-button"]'
  ];
  
  for (const selector of playButtonSelectors) {
    const playButtons = document.querySelectorAll(selector);
    console.log(`[MCP Spotify Web] Found ${playButtons.length} play buttons with selector: ${selector}`);
    
    for (const button of playButtons) {
      if (button.offsetParent !== null && !button.disabled) {
        const ariaLabel = button.getAttribute('aria-label') || '';
        const title = button.getAttribute('title') || '';
        
        // Check if it's actually a play button (not pause)
        if (ariaLabel.includes('Play') || title.includes('Play') || 
            (!ariaLabel.includes('Pause') && !title.includes('Pause'))) {
          console.log('[MCP Spotify Web] Clicking play button:', button, 'aria-label:', ariaLabel);
          
          // Simulate proper mouse click events
          simulateMouseClick(button);
          return true;
        }
      }
    }
  }
  
  console.log('[MCP Spotify Web] No suitable play button found');
  return false;
}

function simulateMouseClick(element) {
  // Create more realistic mouse events
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  
  // Scroll element into view
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  setTimeout(() => {
    // Create mouse events
    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 0
    });
    
    const mouseUpEvent = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 0
    });
    
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 0
    });
    
    // Focus the element first
    element.focus();
    
    // Dispatch events in sequence
    element.dispatchEvent(mouseDownEvent);
    setTimeout(() => {
      element.dispatchEvent(mouseUpEvent);
      setTimeout(() => {
        element.dispatchEvent(clickEvent);
        // Also try the direct click method
        element.click();
      }, 50);
    }, 50);
    
    console.log('[MCP Spotify Web] Simulated complete mouse click on element');
  }, 200);
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (trackEndCheckInterval) {
    clearInterval(trackEndCheckInterval);
  }
});
// YouTube Player content script for auto-play functionality
console.log('[MCP YouTube] Loaded on:', window.location.href);

let videoEndCheckInterval;
let currentVideoId = null;
let playAttempts = 0;
const MAX_PLAY_ATTEMPTS = 5;
let isProcessingPlayRequest = false;
let lastPlayRequestTime = 0;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[MCP YouTube] Received message:', request.type);
  
  if (request.type === 'findAndPlayFirstVideo') {
    const now = Date.now();
    
    // Prevent multiple rapid play requests
    if (isProcessingPlayRequest) {
      console.log('[MCP YouTube] Already processing play request, ignoring...');
      sendResponse({ success: false, reason: 'already_processing' });
      return;
    }
    
    if (now - lastPlayRequestTime < 1000) {
      console.log('[MCP YouTube] Play request too soon, ignoring...');
      sendResponse({ success: false, reason: 'too_soon' });
      return;
    }
    
    isProcessingPlayRequest = true;
    lastPlayRequestTime = now;
    
    console.log('[MCP YouTube] Finding and playing first video...');
    findAndPlayFirstVideo(request.trackInfo);
    
    // Reset flag after processing
    setTimeout(() => {
      isProcessingPlayRequest = false;
    }, 3000);
    
    sendResponse({ success: true });
  } else if (request.type === 'findAndClickFirstVideo') {
    console.log('[MCP YouTube] Finding and clicking first video only...');
    const success = findAndClickFirstVideoOnly(request.trackInfo);
    sendResponse({ success: success });
  } else if (request.type === 'tryPlayVideo') {
    console.log('[MCP YouTube] Trying to play current video...');
    tryPlayCurrentVideo();
    sendResponse({ success: true });
  } else if (request.type === 'setupVideoEndListener') {
    setupVideoEndListener();
    sendResponse({ success: true });
  }
  
  return true;
});

async function findAndPlayFirstVideo(trackInfo) {
  console.log('[MCP YouTube] === STARTING VIDEO SEARCH ===');
  console.log('[MCP YouTube] Searching for:', trackInfo.track_name, 'by', trackInfo.artist_name);
  console.log('[MCP YouTube] Current URL:', window.location.href);
  
  // Reset play attempts
  playAttempts = 0;
  
  // Try multiple times with faster delays for quicker response
  const attempts = [500, 1200, 2000, 3500, 5000];
  console.log('[MCP YouTube] Will attempt', attempts.length, 'times with delays:', attempts);
  
  attempts.forEach((delay, index) => {
    setTimeout(() => {
      console.log(`[MCP YouTube] Auto-play attempt ${index + 1}/${attempts.length}`);
      console.log('[MCP YouTube] Document ready state:', document.readyState);
      console.log('[MCP YouTube] Current URL:', window.location.href);
      
      // Check if page is loaded enough
      if (document.readyState === 'loading') {
        console.log('[MCP YouTube] Page still loading, waiting...');
        return;
      }
      
      if (window.location.href.includes('/results')) {
        // We're on search results page
        console.log('[MCP YouTube] On search results page, looking for videos...');
        const success = tryPlayFromSearchResults();
        if (success) {
          console.log('[MCP YouTube] Successfully found and clicked video');
        }
      } else if (window.location.href.includes('/watch')) {
        // We're already on a video page
        console.log('[MCP YouTube] On video page, trying to play...');
        tryPlayCurrentVideo();
      } else {
        console.log('[MCP YouTube] Unknown page type, URL:', window.location.href);
      }
      
    }, delay);
  });
}

function findAndClickFirstVideoOnly(trackInfo) {
  console.log('[MCP YouTube] === FINDING FIRST VIDEO TO CLICK ===');
  console.log('[MCP YouTube] Track:', trackInfo.track_name, 'by', trackInfo.artist_name);
  console.log('[MCP YouTube] Current URL:', window.location.href);
  
  if (!window.location.href.includes('/results')) {
    console.log('[MCP YouTube] Not on search results page');
    return false;
  }
  
  // Look for video thumbnails/links
  const videoSelectors = [
    'a#video-title', // Main video title links
    'a.ytd-video-renderer', // Video renderer links
    'ytd-video-renderer a', // Any link in video renderer
    '.ytd-compact-video-renderer a', // Compact video links
    'a[href*="/watch?v="]' // Any watch links
  ];
  
  for (const selector of videoSelectors) {
    const videos = document.querySelectorAll(selector);
    console.log(`[MCP YouTube] Selector "${selector}": found ${videos.length} elements`);
    
    if (videos.length > 0) {
      const firstVideo = videos[0];
      if (firstVideo.href && firstVideo.href.includes('/watch?v=')) {
        console.log('[MCP YouTube] ✅ Clicking first video:', firstVideo.href);
        
        // Extract video ID for tracking
        const videoId = firstVideo.href.match(/v=([^&]+)/)?.[1];
        currentVideoId = videoId;
        
        // Click the video
        firstVideo.click();
        return true;
      }
    }
  }
  
  console.log('[MCP YouTube] ❌ No suitable videos found');
  return false;
}

function tryPlayFromSearchResults() {
  console.log('[MCP YouTube] === SEARCHING FOR VIDEOS ===');
  console.log('[MCP YouTube] Page title:', document.title);
  console.log('[MCP YouTube] Page ready state:', document.readyState);
  
  // Look for video thumbnails/links
  const videoSelectors = [
    'a#video-title', // Main video title links
    'a.ytd-video-renderer', // Video renderer links
    'ytd-video-renderer a', // Any link in video renderer
    '.ytd-compact-video-renderer a', // Compact video links
    'a[href*="/watch?v="]' // Any watch links
  ];
  
  console.log('[MCP YouTube] Checking', videoSelectors.length, 'selectors...');
  
  for (const selector of videoSelectors) {
    const videos = document.querySelectorAll(selector);
    console.log(`[MCP YouTube] Selector "${selector}": found ${videos.length} elements`);
    
    if (videos.length > 0) {
      // Log details about found videos
      videos.forEach((video, index) => {
        if (index < 3) { // Log first 3 videos
          console.log(`[MCP YouTube] Video ${index + 1}: href="${video.href}", text="${video.textContent?.trim().substring(0, 50)}"`);
        }
      });
      
      const firstVideo = videos[0];
      if (firstVideo.href && firstVideo.href.includes('/watch?v=')) {
        console.log('[MCP YouTube] ✅ Clicking first video:', firstVideo.href);
        
        // Extract video ID for tracking
        const videoId = firstVideo.href.match(/v=([^&]+)/)?.[1];
        currentVideoId = videoId;
        console.log('[MCP YouTube] Video ID:', videoId);
        
        // Click the video
        firstVideo.click();
        
        // Set up monitoring for the new page
        setTimeout(() => {
          setupVideoEndListener();
        }, 3000);
        
        return true;
      } else {
        console.log('[MCP YouTube] ❌ First video has no valid href:', firstVideo.href);
      }
    }
  }
  
  console.log('[MCP YouTube] ❌ No suitable videos found in search results');
  
  // Debug: show what's actually on the page
  const allLinks = document.querySelectorAll('a');
  const watchLinks = Array.from(allLinks).filter(a => a.href && a.href.includes('/watch?v='));
  console.log('[MCP YouTube] Debug: Found', watchLinks.length, 'total watch links on page');
  
  return false;
}

function tryPlayCurrentVideo() {
  console.log('[MCP YouTube] === TRYING TO PLAY CURRENT VIDEO ===');
  console.log('[MCP YouTube] Current URL:', window.location.href);
  
  // Method 1: Try direct video.play() first (works even in background)
  const video = document.querySelector('video');
  if (video) {
    console.log('[MCP YouTube] ✅ Found video element');
    console.log('[MCP YouTube] Video paused:', video.paused);
    console.log('[MCP YouTube] Video ready state:', video.readyState);
    console.log('[MCP YouTube] Video src:', video.src?.substring(0, 100) + '...');
    
    console.log('[MCP YouTube] Trying direct video.play()...');
    video.play().then(() => {
      console.log('[MCP YouTube] ✅ Direct video.play() succeeded!');
      setupVideoEndListener();
      return;
    }).catch((error) => {
      console.log('[MCP YouTube] ❌ Direct video.play() failed:', error.message);
      tryOtherPlayMethods();
    });
  } else {
    console.log('[MCP YouTube] ❌ No video element found');
    tryOtherPlayMethods();
  }
}

function tryOtherPlayMethods() {
  // Method 2: Try spacebar (most reliable for user interaction)
  console.log('[MCP YouTube] Trying spacebar to play...');
  simulateKeyPress(' ');
  
  // Method 3: Try clicking play button after a short delay
  setTimeout(() => {
    if (!isVideoPlaying()) {
      console.log('[MCP YouTube] Spacebar failed, trying play button...');
      tryClickPlayButton();
    } else {
      console.log('[MCP YouTube] Video is playing after spacebar!');
      setupVideoEndListener();
    }
  }, 800); // Reduced delay
  
  // Method 4: Try more aggressive approaches
  setTimeout(() => {
    if (!isVideoPlaying()) {
      console.log('[MCP YouTube] Play button failed, trying aggressive methods...');
      tryAggressiveAutoPlay();
    }
  }, 2000); // Reduced delay
}

function simulateKeyPress(key) {
  // Focus on the video player first
  const videoPlayer = document.querySelector('video, #movie_player, .html5-video-player');
  if (videoPlayer) {
    videoPlayer.focus();
  }
  
  // Create and dispatch keyboard events
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
  console.log('[MCP YouTube] Simulated key press:', key);
}

function tryClickPlayButton() {
  // Look for YouTube play button
  const playButtonSelectors = [
    '.ytp-play-button', // Main play button
    '.ytp-large-play-button', // Large play button overlay
    'button.ytp-play-button',
    '[aria-label="Play"]',
    '[title="Play"]',
    '.html5-play-button'
  ];
  
  for (const selector of playButtonSelectors) {
    const buttons = document.querySelectorAll(selector);
    console.log(`[MCP YouTube] Found ${buttons.length} play buttons with selector: ${selector}`);
    
    for (const button of buttons) {
      if (button.offsetParent !== null && !button.disabled) {
        console.log('[MCP YouTube] Clicking play button:', button);
        
        // Simulate realistic click
        simulateMouseClick(button);
        return true;
      }
    }
  }
  
  console.log('[MCP YouTube] No play button found');
  return false;
}

function simulateMouseClick(element) {
  // Scroll into view
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  setTimeout(() => {
    // Focus first
    element.focus();
    
    // Create mouse events
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    
    const mouseEvents = ['mousedown', 'mouseup', 'click'];
    
    mouseEvents.forEach((eventType, index) => {
      setTimeout(() => {
        const event = new MouseEvent(eventType, {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          button: 0
        });
        element.dispatchEvent(event);
      }, index * 50);
    });
    
    // Also try direct click
    setTimeout(() => {
      element.click();
    }, 200);
    
    console.log('[MCP YouTube] Simulated mouse click on play button');
  }, 300);
}

function tryAggressiveAutoPlay() {
  console.log('[MCP YouTube] Trying aggressive auto-play methods...');
  
  // Method 1: Try to trigger video play directly
  const video = document.querySelector('video');
  if (video) {
    console.log('[MCP YouTube] Found video element, trying direct play...');
    video.play().then(() => {
      console.log('[MCP YouTube] Direct video.play() succeeded!');
      setupVideoEndListener();
    }).catch(error => {
      console.log('[MCP YouTube] Direct video.play() failed:', error.message);
      // Try clicking on video itself
      video.click();
    });
  }
  
  // Method 2: Try YouTube API if available
  if (window.ytplayer && window.ytplayer.config) {
    console.log('[MCP YouTube] Trying YouTube player API...');
    try {
      // Try to get player instance
      const player = document.querySelector('#movie_player');
      if (player && player.playVideo) {
        player.playVideo();
        console.log('[MCP YouTube] YouTube API play succeeded!');
      }
    } catch (error) {
      console.log('[MCP YouTube] YouTube API failed:', error.message);
    }
  }
  
  // Method 3: Try multiple clicks with delays
  setTimeout(() => {
    if (!isVideoPlaying()) {
      console.log('[MCP YouTube] Trying multiple click attempts...');
      const video = document.querySelector('video');
      if (video) {
        // Try clicking multiple times
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            video.click();
            simulateKeyPress(' ');
          }, i * 500);
        }
      }
    }
  }, 1000);
}

function isVideoPlaying() {
  const video = document.querySelector('video');
  if (video) {
    const isPlaying = !video.paused && !video.ended && video.readyState > 2;
    console.log('[MCP YouTube] Video playing status:', isPlaying);
    return isPlaying;
  }
  return false;
}

function setupVideoEndListener() {
  console.log('[MCP YouTube] Setting up video end listener...');
  
  // Clear any existing interval
  if (videoEndCheckInterval) {
    clearInterval(videoEndCheckInterval);
  }
  
  const video = document.querySelector('video');
  if (video) {
    // Method 1: Use ended event
    video.addEventListener('ended', () => {
      console.log('[MCP YouTube] Video ended event fired');
      chrome.runtime.sendMessage({ type: 'videoEnded' });
    });
    
    // Method 2: Polling fallback
    videoEndCheckInterval = setInterval(() => {
      if (video.ended) {
        console.log('[MCP YouTube] Video ended (polling detected)');
        chrome.runtime.sendMessage({ type: 'videoEnded' });
        clearInterval(videoEndCheckInterval);
      }
    }, 5000);
    
    console.log('[MCP YouTube] Video end listener set up successfully');
  }
}

// Auto-setup if we're on YouTube
if (window.location.href.includes('youtube.com')) {
  // If we're on a video page, set up end listener
  if (window.location.href.includes('/watch')) {
    setTimeout(() => {
      setupVideoEndListener();
    }, 2000);
  }
  
  // Listen for page navigation (YouTube is SPA)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log('[MCP YouTube] Page navigated to:', url);
      
      if (url.includes('/watch')) {
        setTimeout(() => {
          setupVideoEndListener();
        }, 2000);
      }
    }
  }).observe(document, { subtree: true, childList: true });
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (videoEndCheckInterval) {
    clearInterval(videoEndCheckInterval);
  }
});
// Background service worker
const API_URL = 'http://localhost:8000';

let enabled = false;
let currentContext = '';
let lastContent = '';
let checkInterval;
let currentMusicTabs = new Set(); // Track music tabs
let lastPlayedTrack = null;
let lastAPICall = 0; // Track last API call time
let apiCallCount = 0; // Track API calls per hour
let currentPlaylist = []; // Store current playlist
let currentPlayIndex = 0; // Track current playing song index
let playlistContext = ''; // Track which context the playlist belongs to
let isCreatingMusicTab = false; // Prevent multiple tab creation
let lastTabCreationTime = 0; // Track when last tab was created

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    enabled: false,
    service: 'spotify',
    currentContext: '',
    recommendations: []
  });
});

// Load initial state
chrome.storage.local.get(['enabled'], (result) => {
  enabled = result.enabled || false;
  console.log('Initial state loaded, enabled:', enabled);
  if (enabled) {
    startMonitoring();
  }
});

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'toggleEnabled') {
    enabled = request.enabled;
    if (enabled) {
      startMonitoring();
    } else {
      stopMonitoring();
    }
  } else if (request.type === 'contentExtracted') {
    handleContentUpdate(request.content, request.url);
  } else if (request.type === 'stopMusic') {
    stopAllMusic();
  } else if (request.type === 'videoEnded' || request.type === 'audioEnded') {
    console.log('Media ended, playing next track...');
    playNextTrack();
  } else if (request.type === 'playNextTrack') {
    console.log('[MCP] Next track requested');
    playNextTrack();
  } else if (request.type === 'requestContentExtraction') {
    console.log('[MCP] Content extraction requested from popup');
    if (enabled) {
      // Trigger immediate content extraction
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && 
            !currentMusicTabs.has(tabs[0].id) &&
            !isMusicStreamingSite(tabs[0].url) &&
            !isRestrictedUrl(tabs[0].url)) {
          
          console.log('[MCP] Extracting content from popup request:', tabs[0].url);
          chrome.tabs.sendMessage(tabs[0].id, { type: 'extractContent' }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Failed to send message to tab:', chrome.runtime.lastError);
              injectContentScript(tabs[0].id);
            }
          });
        } else {
          console.log('[MCP] Skipping content extraction - music streaming site or restricted URL');
        }
      });
    }
  } else if (request.type === 'forceExtractContext') {
    console.log('[MCP] Force extract context requested from popup');
    if (enabled) {
      // Force immediate content extraction and processing
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && 
            !currentMusicTabs.has(tabs[0].id) &&
            !isMusicStreamingSite(tabs[0].url) &&
            !isRestrictedUrl(tabs[0].url)) {
          
          console.log('[MCP] Force extracting content from:', tabs[0].url);
          chrome.tabs.sendMessage(tabs[0].id, { type: 'extractContent' }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Failed to send message to tab:', chrome.runtime.lastError);
              injectContentScript(tabs[0].id);
            } else {
              // Reset lastContent to force processing
              lastContent = '';
              console.log('[MCP] Force extract: Content script triggered');
            }
          });
        } else {
          console.log('[MCP] Cannot force extract from music streaming site or restricted tab');
        }
      });
    }
  } else if (request.type === 'playSpecificTrack') {
    console.log('[MCP] Play specific track requested:', request.track.track_name);
    if (enabled && request.track) {
      // Update current playlist position
      currentPlayIndex = request.index || 0;
      // Play the specific track
      autoPlayMusic(request.track, currentPlayIndex);
    }
  }
});

function startMonitoring() {
  console.log('[MCP] Starting monitoring...');
  // Extract content from current tab immediately
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      console.log('[MCP] Current tab URL:', tabs[0].url);
      
      // Skip if this is a music tab
      if (currentMusicTabs.has(tabs[0].id)) {
        console.log('[MCP] Skipping monitoring start from music tab');
        return;
      }
      
      // Skip all music streaming sites
      if (isMusicStreamingSite(tabs[0].url)) {
        console.log('[MCP] Skipping monitoring start from music streaming site:', tabs[0].url);
        return;
      }
      
      // Check if the tab URL is accessible
      if (!isRestrictedUrl(tabs[0].url)) {
        console.log('[MCP] URL is not restricted, sending message to content script...');
        chrome.tabs.sendMessage(tabs[0].id, { type: 'extractContent' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Failed to send message to tab:', chrome.runtime.lastError);
            // Try injecting the content script
            injectContentScript(tabs[0].id);
          } else {
            console.log('Message sent successfully to content script');
          }
        });
      } else {
        console.log('Cannot access restricted URL:', tabs[0].url);
        const restrictedMessage = 'Cannot extract context from this page';
        chrome.storage.local.set({ currentContext: restrictedMessage });
        chrome.runtime.sendMessage({ type: 'contextUpdate', context: restrictedMessage });
      }
    } else {
      console.log('No active tab found');
    }
  });

  // Set up periodic checking (every 1 minute)
  checkInterval = setInterval(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && 
          !currentMusicTabs.has(tabs[0].id) && 
          !isMusicStreamingSite(tabs[0].url) &&
          !isRestrictedUrl(tabs[0].url)) {
        
        chrome.tabs.sendMessage(tabs[0].id, { type: 'extractContent' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Failed to send message to tab:', chrome.runtime.lastError);
          }
        });
      }
    });
  }, 60000); // 1 minute = 60000ms
}

function stopMonitoring() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

// Simple context extraction for testing
function extractSimpleContext(content) {
  if (!content || content.length < 10) {
    return '의미 있는 내용이 감지되지 않음';
  }
  
  // Extract first meaningful sentence or first 100 characters
  const sentences = content.split(/[.!?。！？]+/);
  const firstSentence = sentences[0]?.trim();
  
  if (firstSentence && firstSentence.length > 5) {
    return firstSentence.substring(0, 50) + (firstSentence.length > 50 ? '...' : '');
  }
  
  return content.substring(0, 50) + (content.length > 50 ? '...' : '');
}

// Check if URL is restricted
function isRestrictedUrl(url) {
  if (!url) {
    console.log('URL is empty or undefined');
    return true;
  }
  const restrictedProtocols = ['chrome:', 'chrome-extension:', 'edge:', 'about:', 'data:'];
  const isRestricted = restrictedProtocols.some(protocol => url.startsWith(protocol));
  console.log(`URL "${url}" is ${isRestricted ? 'restricted' : 'allowed'}`);
  return isRestricted;
}

// Inject content script dynamically
function injectContentScript(tabId) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['content.js']
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('Failed to inject content script:', chrome.runtime.lastError);
    } else {
      console.log('Content script injected successfully');
      // After injection, try to extract content
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { type: 'extractContent' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Still failed after injection:', chrome.runtime.lastError);
          }
        });
      }, 100);
    }
  });
}

async function handleContentUpdate(content, url) {
  if (!enabled) return;

  console.log('handleContentUpdate called with:', { content: content?.substring(0, 100), url });

  // Rate limiting: Don't make API calls too frequently  
  const now = Date.now();
  const timeSinceLastCall = now - lastAPICall;
  
  console.log(`Rate limiting check: ${timeSinceLastCall}ms since last call, ${apiCallCount} calls this hour`);
  
  if (timeSinceLastCall < 10000) { // Reduced to 10 seconds minimum between API calls
    console.log('Rate limiting: Too soon since last API call, skipping API call...');
    // Don't update context display with raw content during rate limiting
    return;
  }

  // Reset hourly counter
  if (timeSinceLastCall > 3600000) { // 1 hour
    apiCallCount = 0;
  }

  // Limit to 20 API calls per hour (increased from 10)
  if (apiCallCount >= 20) {
    console.log('Rate limiting: Maximum API calls per hour reached');
    // Don't update context display with raw content during rate limiting
    return;
  }

  try {
    // Handle empty or error content
    if (!content || content.startsWith('Unable to extract') || content.startsWith('Error extracting') || content.startsWith('Cannot extract')) {
      console.log('Content extraction issue:', content);
      const displayContext = content || 'No content detected';
      chrome.storage.local.set({ currentContext: displayContext });
      chrome.runtime.sendMessage({ type: 'contextUpdate', context: displayContext });
      return;
    }
    
    // Don't update UI with raw content - wait for summary

    // Update API call tracking
    lastAPICall = now;
    apiCallCount++;
    console.log(`API call ${apiCallCount}/10 this hour`);

    // Check if content has significantly changed
    const hasChanged = hasSignificantContentChange(content, lastContent);
    console.log('[MCP] Content changed:', hasChanged, 'Previous length:', lastContent?.length, 'New length:', content.length);
    
    // TEMPORARY: Force change detection for testing
    const forceChange = !lastContent || (Date.now() - lastAPICall > 120000); // Force every 2 minutes
    if (forceChange && !hasChanged) {
      console.log('[MCP] TEMPORARY: Forcing content change for testing');
    }
    
    if (hasChanged || forceChange) {
      lastContent = content;
      
      console.log('[MCP] Content significantly changed, extracting context...');
      // Extract context using Upstage API
      const context = await extractContextWithUpstage(content);
      
      // Check if context has significantly changed
      const contextChanged = hasSignificantContextChange(context, currentContext);
      console.log('[MCP] Context changed:', contextChanged, 'Previous:', currentContext, 'New:', context);
      
      if (context && contextChanged) {
        console.log('[MCP] Significant context change detected:', currentContext, '->', context);
        currentContext = context;
        
        // Update storage and notify popup
        chrome.storage.local.set({ currentContext: context });
        chrome.runtime.sendMessage({ type: 'contextUpdate', context });
        
        // Get new music recommendations
        const recommendations = await getMusicRecommendationsWithRetry(context);
        
        if (recommendations && recommendations.length > 0) {
          console.log('[MCP] New recommendations received, stopping current music first');
          
          // Force stop current music before starting new playlist
          await stopAllMusic();
          
          // Update playlist
          currentPlaylist = recommendations;
          currentPlayIndex = 0;
          playlistContext = context;
          
          chrome.storage.local.set({ recommendations });
          chrome.runtime.sendMessage({ type: 'recommendationsUpdate', recommendations });
          
          // Wait a moment for cleanup, then auto-play the first recommendation
          setTimeout(async () => {
            await autoPlayMusic(recommendations[0], 0);
          }, 1000);
        }
      } else if (context && !contextChanged) {
        console.log('[MCP] Context similar, keeping current playlist. Context:', context);
        // Update context but keep playlist
        currentContext = context;
        chrome.storage.local.set({ currentContext: context });
        chrome.runtime.sendMessage({ type: 'contextUpdate', context });
      } else {
        console.log('[MCP] No context extracted or invalid context');
      }
    } else {
      console.log('[MCP] Content has not significantly changed, skipping context extraction');
    }
  } catch (error) {
    console.error('Error handling content update:', error);
    chrome.runtime.sendMessage({ type: 'error', message: error.message });
  }
}

// Check if content has significantly changed
function hasSignificantContentChange(newContent, oldContent) {
  if (!oldContent) {
    console.log('[MCP] No previous content, considering as changed');
    return true;
  }
  if (newContent === oldContent) {
    console.log('[MCP] Content identical, no change');
    return false;
  }
  
  // Check if length differs significantly (more than 10% - reduced threshold)
  const lengthDiff = Math.abs(newContent.length - oldContent.length) / oldContent.length;
  console.log('[MCP] Length difference:', lengthDiff.toFixed(3));
  if (lengthDiff > 0.1) {
    console.log('[MCP] Length changed significantly');
    return true;
  }
  
  // Check if key words are different
  const getKeyWords = (text) => {
    return text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 15); // Increased from 10 to 15
  };
  
  const oldWords = new Set(getKeyWords(oldContent));
  const newWords = new Set(getKeyWords(newContent));
  
  console.log('[MCP] Old keywords:', Array.from(oldWords).slice(0, 5));
  console.log('[MCP] New keywords:', Array.from(newWords).slice(0, 5));
  
  // Calculate word overlap
  const intersection = new Set([...oldWords].filter(word => newWords.has(word)));
  const union = new Set([...oldWords, ...newWords]);
  const similarity = intersection.size / union.size;
  
  console.log('[MCP] Word similarity:', similarity.toFixed(3));
  
  // Consider changed if less than 70% similarity (increased from 60%)
  const hasChanged = similarity < 0.7;
  console.log('[MCP] Content changed based on words:', hasChanged);
  return hasChanged;
}

// Check if context has significantly changed
function hasSignificantContextChange(newContext, oldContext) {
  if (!oldContext) return true;
  if (newContext === oldContext) return false;
  
  // Simple keyword-based similarity check
  const getWords = (text) => text.toLowerCase().split(/\s+/);
  const oldWords = new Set(getWords(oldContext));
  const newWords = new Set(getWords(newContext));
  
  const intersection = new Set([...oldWords].filter(word => newWords.has(word)));
  const union = new Set([...oldWords, ...newWords]);
  const similarity = intersection.size / union.size;
  
  // Consider changed if less than 70% similarity
  return similarity < 0.7;
}

async function extractContextWithUpstage(content) {
  try {
    console.log('[MCP] Calling Upstage API for context extraction...');
    console.log('[MCP] Content to summarize (first 200 chars):', content.substring(0, 200));
    
    const requestContent = content.substring(0, 2000); // Send first 2000 characters
    console.log('[MCP] Sending', requestContent.length, 'characters to Upstage API');
    
    const response = await fetch(`${API_URL}/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: requestContent
      })
    });

    console.log('[MCP] Upstage API response status:', response.status);

    if (!response.ok) {
      console.error('[MCP] Upstage API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('[MCP] Error details:', errorText);
      console.log('[MCP] Falling back to simple context extraction...');
      return extractSimpleContext(content);
    }

    const data = await response.json();
    console.log('[MCP] Upstage context extraction response:', data);
    
    const summary = data.summary || extractSimpleContext(content);
    console.log('[MCP] Final extracted context:', summary);
    
    return summary;
  } catch (error) {
    console.error('[MCP] Error extracting context with Upstage:', error);
    console.log('[MCP] Falling back to simple context extraction...');
    const fallback = extractSimpleContext(content);
    console.log('[MCP] Fallback context:', fallback);
    return fallback;
  }
}

async function getMusicRecommendations(context) {
  try {
    console.log('Getting recommendations for context:', context);
    console.log('Making request to:', `${API_URL}/recommend`);
    
    const response = await fetch(`${API_URL}/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: context
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', [...response.headers.entries()]);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error response:', errorText);
      throw new Error(`API returned ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const recommendations = await response.json();
    console.log('Received recommendations:', recommendations.length);
    return recommendations;
  } catch (error) {
    console.error('Error getting recommendations:', error);
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    
    // Check if it's a connection error
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      chrome.runtime.sendMessage({ 
        type: 'error', 
        message: 'Cannot connect to API server. Make sure docker-compose is running on http://localhost:8000' 
      });
    } else {
      chrome.runtime.sendMessage({ 
        type: 'error', 
        message: `API Error: ${error.message}` 
      });
    }
    throw error; // Re-throw for retry logic
  }
}

async function getMusicRecommendationsWithRetry(context, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await getMusicRecommendations(context);
    } catch (error) {
      console.log(`Music API attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (attempt === maxRetries) {
        console.error('All music API retry attempts failed');
        chrome.runtime.sendMessage({ 
          type: 'error', 
          message: `Music API failed after ${maxRetries} attempts` 
        });
        return [];
      }
      
      // Wait before retry (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function autoPlayMusic(track, playIndex = 0) {
  // Prevent multiple simultaneous tab creation
  const now = Date.now();
  if (isCreatingMusicTab) {
    console.log('[MCP] Already creating music tab, skipping...');
    return;
  }
  
  if (now - lastTabCreationTime < 1000) {
    console.log('[MCP] Tab created too recently, preventing rapid creation...');
    return;
  }
  
  // Don't play the same track twice in a row unless it's part of playlist progression
  if (lastPlayedTrack && 
      lastPlayedTrack.track_name === track.track_name && 
      lastPlayedTrack.artist_name === track.artist_name &&
      playIndex === currentPlayIndex) {
    console.log('Same track, skipping replay');
    return;
  }

  // Set flag to prevent multiple creations
  isCreatingMusicTab = true;
  lastTabCreationTime = now;
  
  try {
    // Close existing music tabs first - FORCE close regardless of flags
    console.log('[MCP] Force closing existing music tabs...');
    await forceCloseMusicTabs();
    
    console.log(`Auto-playing (${playIndex + 1}/${currentPlaylist.length}): ${track.track_name} by ${track.artist_name}`);
    
    lastPlayedTrack = track;
    currentPlayIndex = playIndex;
    
    // Try YouTube approach
    const youtubeSuccess = await tryYouTubeAutoPlay(track);
    
    if (!youtubeSuccess) {
      console.log('[MCP] YouTube auto-play failed, trying fallback...');
      // Fallback to background audio player
      await tryBackgroundAudioPlayer(track);
    }
    
  } catch (error) {
    console.error('Error auto-playing music:', error);
  } finally {
    // Reset flag after a delay
    setTimeout(() => {
      isCreatingMusicTab = false;
    }, 1000);
  }
}

// Try to play music using YouTube with autoplay workarounds
async function tryYouTubeAutoPlay(track) {
  try {
    console.log('[MCP] === STARTING YOUTUBE AUTO-PLAY ===');
    console.log('[MCP] Track:', track.track_name, 'by', track.artist_name);
    
    // Close existing music tabs first
    await closeMusicTabs();
    console.log('[MCP] Existing tabs closed');
    
    // Create search query
    const query = encodeURIComponent(`${track.track_name} ${track.artist_name}`);
    
    // Method 1: Try direct video URL with autoplay (most likely to work)
    const searchUrl = `https://www.youtube.com/results?search_query=${query}`;
    
    console.log('[MCP] Opening YouTube search:', searchUrl);
    
    // Get the current active tab to return to later
    const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const originalTab = currentTabs[0];
    
    // Create YouTube tab - start active briefly, then immediately switch back
    console.log('[MCP] Creating YouTube tab...');
    const tab = await chrome.tabs.create({ 
      url: searchUrl,
      active: true 
    });
    
    currentMusicTabs.add(tab.id);
    console.log('[MCP] ✅ Created new YouTube tab:', tab.id);
    console.log('[MCP] Current music tabs:', Array.from(currentMusicTabs));
    
    // Step 1: Wait for search page to load, then switch back
    setTimeout(() => {
      if (originalTab && originalTab.id !== tab.id) {
        chrome.tabs.update(originalTab.id, { active: true }).catch(console.error);
        console.log('[MCP] Step 1: Switched back after search page load');
      }
    }, 1500);
    
    // Step 2: Find and click first video (in background)
    setTimeout(async () => {
      console.log('[MCP] Step 2: Attempting to find and click first video');
      
      try {
        chrome.tabs.sendMessage(tab.id, { 
          type: 'findAndClickFirstVideo',
          trackInfo: {
            track_name: track.track_name,
            artist_name: track.artist_name
          }
        }, async (response) => {
          if (chrome.runtime.lastError) {
            console.log('[MCP] Step 2 failed:', chrome.runtime.lastError.message);
          } else if (response && response.success) {
            console.log('[MCP] Step 2: Successfully clicked video, proceeding to step 3');
            
            // Step 3: Switch to video tab briefly to enable autoplay
            setTimeout(() => {
              chrome.tabs.update(tab.id, { active: true }).then(() => {
                console.log('[MCP] Step 3: Switched to video tab for autoplay');
                
                // Step 4: Try to play video
                setTimeout(() => {
                  chrome.tabs.sendMessage(tab.id, { type: 'tryPlayVideo' }, (playResponse) => {
                    console.log('[MCP] Step 4: Play attempt completed');
                    
                    // Step 5: Switch back to original tab
                    setTimeout(() => {
                      if (originalTab && originalTab.id !== tab.id) {
                        chrome.tabs.update(originalTab.id, { active: true }).catch(console.error);
                        console.log('[MCP] Step 5: Final switch back to original tab');
                      }
                    }, 1000);
                  });
                }, 1500); // Wait for video page to load
              });
            }, 3000); // Wait for navigation to complete
            
          } else {
            console.log('[MCP] Step 2: No video found, keeping background');
          }
        });
        
      } catch (error) {
        console.error('[MCP] Error in step 2:', error);
      }
      
    }, 2500); // Wait for search page to be ready
    
    return true;
    
  } catch (error) {
    console.error('[MCP] YouTube auto-play error:', error);
    return false;
  }
}

// Try to play music using Spotify web link
async function trySpotifyWebLink(track) {
  try {
    console.log('[MCP] Trying Spotify web link for:', track.track_name, 'by', track.artist_name);
    
    // Search for track on Spotify and open web player
    const spotifyUrl = await searchSpotifyWebTrack(track.track_name, track.artist_name);
    
    if (spotifyUrl) {
      console.log('[MCP] Found Spotify track:', spotifyUrl);
      
      // Close existing music tabs first and wait for completion
      await closeMusicTabs();
      console.log('[MCP] All existing music tabs closed');
      
      // Double-check: close any Spotify tabs that might still be open
      await closeSpotifyTabs();
      
      // Open Spotify web player - make it active briefly to enable autoplay
      const tab = await chrome.tabs.create({ 
        url: spotifyUrl,
        active: true  // Start as active to enable autoplay permissions
      });
      
      currentMusicTabs.add(tab.id);
      console.log('[MCP] Created new Spotify tab:', tab.id);
      
      // Get the current active tab to return to later
      const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const originalTab = currentTabs[0];
      
      // Wait for page to load, then try auto-play
      setTimeout(async () => {
        console.log('[MCP] Attempting to trigger auto-play on Spotify tab');
        
        // First, try to enable autoplay by simulating user interaction
        try {
          await chrome.tabs.update(tab.id, { active: true });
          console.log('[MCP] Activated Spotify tab for autoplay permissions');
          
          // Wait a moment for the tab to be fully active
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { type: 'triggerAutoPlay' }, async (response) => {
              if (chrome.runtime.lastError) {
                console.log('[MCP] Auto-play trigger failed:', chrome.runtime.lastError.message);
              } else {
                console.log('[MCP] Auto-play trigger sent successfully');
              }
              
              // Return to original tab after a short delay
              if (originalTab && originalTab.id !== tab.id) {
                setTimeout(() => {
                  chrome.tabs.update(originalTab.id, { active: true }).catch(console.error);
                }, 2000);
              }
            });
          }, 1000);
          
        } catch (error) {
          console.error('[MCP] Error activating Spotify tab:', error);
        }
        
        // Retry auto-play after more time
        setTimeout(() => {
          console.log('[MCP] Retrying auto-play trigger...');
          chrome.tabs.sendMessage(tab.id, { type: 'triggerAutoPlay' }, () => {
            if (chrome.runtime.lastError) {
              console.log('[MCP] Second auto-play attempt also failed');
              // Send user notification
              chrome.runtime.sendMessage({ 
                type: 'info', 
                message: 'Spotify tab opened. Click the Spotify tab and press play if music doesn\'t start automatically.' 
              });
            }
          });
        }, 8000);
        
      }, 3000);
      
      // Setup track end detection (optional, may fail safely)
      setTimeout(() => {
        try {
          setupSpotifyTrackEndDetection(tab.id);
        } catch (error) {
          console.log('[MCP] Track end detection setup failed, continuing anyway:', error.message);
        }
      }, 8000);
      
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error('[MCP] Spotify web link error:', error);
    return false;
  }
}

// Search for track on Spotify and return web player URL
async function searchSpotifyWebTrack(trackName, artistName) {
  try {
    console.log('[MCP] Searching for:', trackName, 'by', artistName);
    
    // First try to get a Spotify access token (optional for search)
    const accessToken = await getSpotifyAccessToken();
    
    if (accessToken) {
      console.log('[MCP] Using Spotify API with access token');
      // Use Spotify API for accurate search
      const query = encodeURIComponent(`track:"${trackName}" artist:"${artistName}"`);
      const response = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.tracks.items.length > 0) {
          const track = data.tracks.items[0];
          const trackUrl = `https://open.spotify.com/track/${track.id}`;
          console.log('[MCP] Found exact track:', trackUrl);
          return trackUrl;
        } else {
          console.log('[MCP] No tracks found via API, falling back to search');
        }
      } else {
        console.log('[MCP] API search failed:', response.status);
      }
    } else {
      console.log('[MCP] No access token, using search URL');
    }
    
    // Fallback: construct search URL for Spotify web player
    const query = encodeURIComponent(`${trackName} ${artistName}`);
    const searchUrl = `https://open.spotify.com/search/${query}`;
    console.log('[MCP] Using search URL:', searchUrl);
    return searchUrl;
    
  } catch (error) {
    console.error('[MCP] Spotify search error:', error);
    // Fallback to search URL
    const query = encodeURIComponent(`${trackName} ${artistName}`);
    const fallbackUrl = `https://open.spotify.com/search/${query}`;
    console.log('[MCP] Error fallback URL:', fallbackUrl);
    return fallbackUrl;
  }
}

// Get Spotify access token (if available)
async function getSpotifyAccessToken() {
  try {
    const result = await chrome.storage.local.get(['spotify_access_token']);
    return result.spotify_access_token || null;
  } catch (error) {
    console.error('[MCP] Error getting Spotify token:', error);
    return null;
  }
}

// Setup track end detection for Spotify
function setupSpotifyTrackEndDetection(tabId) {
  console.log('[MCP] Setting up Spotify end detection for tab:', tabId);
  
  // Wait for Spotify page to load
  setTimeout(() => {
    // Check if tab still exists
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        console.log('[MCP] Tab no longer exists:', chrome.runtime.lastError.message);
        return;
      }
      
      // Send message with error handling
      chrome.tabs.sendMessage(tabId, { type: 'setupSpotifyEndListener' }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('[MCP] Could not setup Spotify end listener:', chrome.runtime.lastError.message);
          console.log('[MCP] This is normal - setting up fallback timer instead');
          
          // Set up fallback timer for next track (3 minutes)
          setTimeout(() => {
            console.log('[MCP] Fallback: Playing next track after 3 minutes');
            playNextTrack();
          }, 180000);
        } else {
          console.log('[MCP] Spotify end listener setup successful');
        }
      });
    });
  }, 8000); // Increased delay to 8 seconds
}

// Try to play music using background audio player
async function tryBackgroundAudioPlayer(track) {
  try {
    console.log('[MCP] Trying background audio player...');
    
    // Get current active tab to inject audio player
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) return false;
    
    const tabId = tabs[0].id;
    
    // Try to send message to audio player
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, {
        type: 'playAudioTrack',
        trackInfo: {
          track_name: track.track_name,
          artist_name: track.artist_name,
          preview_url: track.preview_url || null,
          audioUrl: null // We'll need to implement audio URL fetching
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('[MCP] Audio player not available, error:', chrome.runtime.lastError.message);
          resolve(false);
        } else {
          console.log('[MCP] Audio player response:', response);
          resolve(response?.success || false);
        }
      });
    });
    
  } catch (error) {
    console.error('[MCP] Background audio player error:', error);
    return false;
  }
}


// Play next track in playlist
function playNextTrack() {
  if (currentPlaylist.length === 0) {
    console.log('No playlist available');
    return;
  }
  
  // Prevent rapid next track calls
  if (isCreatingMusicTab) {
    console.log('[MCP] Already processing track, skipping next track request...');
    return;
  }
  
  const nextIndex = currentPlayIndex + 1;
  
  if (nextIndex < currentPlaylist.length) {
    console.log(`Playing next track: ${nextIndex + 1}/${currentPlaylist.length}`);
    autoPlayMusic(currentPlaylist[nextIndex], nextIndex);
  } else {
    console.log('Reached end of playlist, looping back to first track');
    autoPlayMusic(currentPlaylist[0], 0);
  }
}

async function stopAllMusic() {
  console.log('[MCP] === STOPPING ALL MUSIC ===');
  
  // Reset creation flags to allow immediate cleanup
  isCreatingMusicTab = false;
  
  // Stop background audio players
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!isRestrictedUrl(tab.url)) {
        // Stop background audio players
        chrome.tabs.sendMessage(tab.id, { type: 'stopAudio' }, () => {
          if (chrome.runtime.lastError) {
            // Silent fail
          }
        });
      }
    }
  } catch (error) {
    console.log('Error stopping background audio:', error);
  }
  
  // Force close ALL music tabs
  await forceCloseMusicTabs();
  
  console.log('[MCP] All music stopped and tabs closed');
}

async function closeMusicTabs() {
  console.log('[MCP] Closing existing music tabs:', currentMusicTabs.size);
  
  if (currentMusicTabs.size === 0) {
    console.log('[MCP] No music tabs to close');
    return;
  }
  
  try {
    const closePromises = [];
    
    // Only close tracked tabs to avoid closing user's own YouTube tabs
    for (const tabId of currentMusicTabs) {
      closePromises.push(
        chrome.tabs.remove(tabId).catch(error => {
          console.log(`[MCP] Tab ${tabId} already closed:`, error.message);
        })
      );
    }
    
    // Wait for all tabs to be closed with timeout
    await Promise.race([
      Promise.all(closePromises),
      new Promise(resolve => setTimeout(resolve, 2000)) // 2 second timeout
    ]);
    
    currentMusicTabs.clear();
    console.log('[MCP] Music tabs closed successfully');
    
  } catch (error) {
    console.error('[MCP] Error closing music tabs:', error);
    currentMusicTabs.clear();
  }
}

async function forceCloseMusicTabs() {
  console.log('[MCP] FORCE closing ALL music tabs:', currentMusicTabs.size);
  
  try {
    // Get all tabs and find YouTube/music tabs
    const allTabs = await chrome.tabs.query({});
    const musicTabsToClose = [];
    
    // Add tracked tabs
    for (const tabId of currentMusicTabs) {
      musicTabsToClose.push(tabId);
    }
    
    // Also find any untracked YouTube tabs that might be ours
    for (const tab of allTabs) {
      if (tab.url && (
        tab.url.includes('youtube.com/watch') || 
        tab.url.includes('youtube.com/results') ||
        tab.url.includes('open.spotify.com')
      )) {
        if (!musicTabsToClose.includes(tab.id)) {
          console.log('[MCP] Found untracked music tab:', tab.id, tab.url.substring(0, 50));
          musicTabsToClose.push(tab.id);
        }
      }
    }
    
    console.log('[MCP] Total tabs to close:', musicTabsToClose.length);
    
    if (musicTabsToClose.length > 0) {
      const closePromises = musicTabsToClose.map(tabId => 
        chrome.tabs.remove(tabId).catch(error => {
          console.log(`[MCP] Tab ${tabId} already closed:`, error.message);
        })
      );
      
      // Wait for all to close with timeout
      await Promise.race([
        Promise.all(closePromises),
        new Promise(resolve => setTimeout(resolve, 3000)) // 3 second timeout
      ]);
    }
    
    currentMusicTabs.clear();
    console.log('[MCP] ALL music tabs force closed successfully');
    
  } catch (error) {
    console.error('[MCP] Error force closing music tabs:', error);
    currentMusicTabs.clear();
  }
}

// Additional function to close any Spotify tabs
async function closeSpotifyTabs() {
  try {
    const allTabs = await chrome.tabs.query({});
    const spotifyTabs = allTabs.filter(tab => 
      tab.url && tab.url.includes('open.spotify.com')
    );
    
    console.log('[MCP] Found', spotifyTabs.length, 'existing Spotify tabs');
    
    const closePromises = spotifyTabs.map(tab => 
      chrome.tabs.remove(tab.id).catch(error => {
        console.log(`[MCP] Failed to close Spotify tab ${tab.id}:`, error.message);
      })
    );
    
    await Promise.all(closePromises);
    console.log('[MCP] All Spotify tabs closed');
    
  } catch (error) {
    console.error('[MCP] Error closing Spotify tabs:', error);
  }
}

// Handle tab changes
chrome.tabs.onActivated.addListener((activeInfo) => {
  if (!enabled) return;
  
  console.log('[MCP] Tab activated:', activeInfo.tabId);
  
  // Skip if this is a music tab
  if (currentMusicTabs.has(activeInfo.tabId)) {
    console.log('[MCP] Skipping context extraction from music tab:', activeInfo.tabId);
    return;
  }
  
  // Get tab details to check URL
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError) {
      console.log('[MCP] Could not get tab info:', chrome.runtime.lastError.message);
      return;
    }
    
    console.log('[MCP] Activated tab URL:', tab.url);
    
    // Skip all music streaming sites
    if (isMusicStreamingSite(tab.url)) {
      console.log('[MCP] Skipping context extraction from music streaming site:', tab.url);
      return;
    }
    
    if (!isRestrictedUrl(tab.url)) {
      console.log('[MCP] Extracting content from newly activated tab:', tab.url);
      // Extract content from newly activated tab
      chrome.tabs.sendMessage(activeInfo.tabId, { type: 'extractContent' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to send message to tab:', chrome.runtime.lastError);
          injectContentScript(activeInfo.tabId);
        }
      });
    } else {
      chrome.storage.local.set({ currentContext: 'Cannot extract context from this page' });
    }
  });
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (enabled && changeInfo.status === 'complete' && tab.active) {
    // Skip if this is a music tab
    if (currentMusicTabs.has(tabId)) {
      console.log('[MCP] Skipping context extraction from updated music tab:', tabId);
      return;
    }
    
    // Skip all music streaming sites
    if (isMusicStreamingSite(tab.url)) {
      console.log('[MCP] Skipping context extraction from updated music streaming tab:', tab.url);
      return;
    }
    
    // Extract content from updated tab
    if (!isRestrictedUrl(tab.url)) {
      console.log('[MCP] Extracting content from updated tab:', tab.url);
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { type: 'extractContent' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Failed to send message to tab:', chrome.runtime.lastError);
            injectContentScript(tabId);
          }
        });
      }, 1000);
    }
  }
});

// Helper function to check if URL is a music streaming site
function isMusicStreamingSite(url) {
  if (!url) return false;
  
  const musicDomains = [
    'open.spotify.com',
    'music.youtube.com',
    'soundcloud.com',
    'music.apple.com',
    'tidal.com',
    'deezer.com',
    'pandora.com',
    'last.fm',
    'bandcamp.com'
  ];
  
  // Special case: YouTube main site is only considered music site if it's our own music tabs
  const isYouTubeMusic = url.includes('youtube.com') && currentMusicTabs.has(getCurrentTabId(url));
  
  const isMusic = musicDomains.some(domain => url.includes(domain)) || isYouTubeMusic;
  if (isMusic) {
    console.log('[MCP] Detected music streaming site:', url);
  }
  return isMusic;
}

// Helper function to get current tab ID (simplified)
function getCurrentTabId(url) {
  // This is a simplified version - in practice, we track this differently
  // For now, we'll rely on the currentMusicTabs Set to track our YouTube tabs
  return null;
}

// Helper function to check if URL is restricted
function isRestrictedUrl(url) {
  if (!url) return true;
  return url.startsWith('chrome://') || 
         url.startsWith('chrome-extension://') || 
         url.startsWith('about:') ||
         url.startsWith('edge://') ||
         url.startsWith('file://') ||
         url.includes('chromewebstore.google.com');
}

// Handle tab removal
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (currentMusicTabs.has(tabId)) {
    console.log('[MCP] Music tab closed:', tabId);
    currentMusicTabs.delete(tabId);
  }
});

// Helper function to inject content script
function injectContentScript(tabId) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['content.js']
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('Failed to inject content script:', chrome.runtime.lastError);
    } else {
      // Wait a bit for script to initialize, then request content
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { type: 'extractContent' });
      }, 500);
    }
  });
}
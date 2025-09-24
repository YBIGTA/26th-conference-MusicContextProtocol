// Web Audio API based music player for direct audio streaming
console.log('[MCP Audio Player] Loaded');

let audioContext;
let currentAudioSource;
let isPlaying = false;

// Initialize Web Audio Context
function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    console.log('[MCP Audio Player] Audio context initialized');
  }
  return audioContext;
}

// Play audio from URL using Web Audio API
async function playAudioFromUrl(url) {
  try {
    console.log('[MCP Audio Player] Attempting to play audio from:', url);
    
    const context = initAudioContext();
    
    // Resume context if suspended
    if (context.state === 'suspended') {
      await context.resume();
    }
    
    // Stop current audio if playing
    if (currentAudioSource) {
      currentAudioSource.stop();
      currentAudioSource = null;
    }
    
    // Fetch audio data
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    
    // Decode audio data
    const audioBuffer = await context.decodeAudioData(arrayBuffer);
    
    // Create audio source
    currentAudioSource = context.createBufferSource();
    currentAudioSource.buffer = audioBuffer;
    currentAudioSource.connect(context.destination);
    
    // Setup end event
    currentAudioSource.onended = () => {
      console.log('[MCP Audio Player] Audio ended');
      isPlaying = false;
      chrome.runtime.sendMessage({ type: 'audioEnded' });
    };
    
    // Start playing
    currentAudioSource.start(0);
    isPlaying = true;
    
    console.log('[MCP Audio Player] Audio started successfully');
    return true;
    
  } catch (error) {
    console.error('[MCP Audio Player] Error playing audio:', error);
    return false;
  }
}

// Get audio URL from free music sources
async function getFreeAudioUrl(trackName, artistName) {
  try {
    console.log('[MCP Audio Player] Searching for free audio sources...');
    
    // Try Jamendo API (Creative Commons music)
    const jamendoUrl = await searchJamendo(trackName, artistName);
    if (jamendoUrl) return jamendoUrl;
    
    // Try Archive.org (Internet Archive)
    const archiveUrl = await searchArchive(trackName, artistName);
    if (archiveUrl) return archiveUrl;
    
    // Try ccMixter
    const ccMixterUrl = await searchCCMixter(trackName, artistName);
    if (ccMixterUrl) return ccMixterUrl;
    
    return null;
  } catch (error) {
    console.error('[MCP Audio Player] Error getting free audio URL:', error);
    return null;
  }
}

async function searchJamendo(trackName, artistName) {
  try {
    const query = encodeURIComponent(`${trackName} ${artistName}`);
    const response = await fetch(`https://api.jamendo.com/v3.0/tracks/?client_id=CLIENT_ID&format=jsonpretty&search=${query}&audioformat=mp32`);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      return data.results[0].audio;
    }
  } catch (error) {
    console.log('[MCP Audio Player] Jamendo search failed:', error);
  }
  return null;
}

async function searchArchive(trackName, artistName) {
  try {
    const query = encodeURIComponent(`${trackName} ${artistName}`);
    const response = await fetch(`https://archive.org/advancedsearch.php?q=${query}&fl=identifier,title,creator&rows=10&page=1&output=json&callback=&save=yes`);
    const data = await response.json();
    
    if (data.response && data.response.docs && data.response.docs.length > 0) {
      const item = data.response.docs[0];
      return `https://archive.org/download/${item.identifier}/${item.identifier}.mp3`;
    }
  } catch (error) {
    console.log('[MCP Audio Player] Archive.org search failed:', error);
  }
  return null;
}

async function searchCCMixter(trackName, artistName) {
  try {
    const query = encodeURIComponent(`${trackName} ${artistName}`);
    const response = await fetch(`https://ccmixter.org/api/query?f=json&tags=instrumental&search=${query}&limit=1`);
    const data = await response.json();
    
    if (data && data.length > 0) {
      return data[0].files[0].download_url;
    }
  } catch (error) {
    console.log('[MCP Audio Player] ccMixter search failed:', error);
  }
  return null;
}

// Alternative: Use HTML5 Audio element
async function createAudioPlayer(trackInfo) {
  console.log('[MCP Audio Player] Creating HTML5 audio player for:', trackInfo);
  
  // Try to get free audio URL first
  let audioUrl = await getFreeAudioUrl(trackInfo.track_name, trackInfo.artist_name);
  
  // Fallback to preview URL if available
  if (!audioUrl && trackInfo.preview_url) {
    audioUrl = trackInfo.preview_url;
  }
  
  if (!audioUrl) {
    console.log('[MCP Audio Player] No audio sources available');
    return false;
  }
  
  try {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    
    // Setup event listeners
    audio.addEventListener('loadstart', () => {
      console.log('[MCP Audio Player] Audio loading started');
    });
    
    audio.addEventListener('canplay', () => {
      console.log('[MCP Audio Player] Audio can start playing');
      audio.play().then(() => {
        console.log('[MCP Audio Player] Audio started successfully');
        isPlaying = true;
      }).catch(error => {
        console.error('[MCP Audio Player] Audio play failed:', error);
      });
    });
    
    audio.addEventListener('ended', () => {
      console.log('[MCP Audio Player] Audio ended');
      isPlaying = false;
      chrome.runtime.sendMessage({ type: 'audioEnded' });
    });
    
    audio.addEventListener('error', (e) => {
      console.error('[MCP Audio Player] Audio error:', e);
    });
    
    // Set audio source and load
    audio.src = audioUrl;
    audio.load();
    
    // Store reference to current audio
    if (currentAudioSource) {
      currentAudioSource.pause();
    }
    currentAudioSource = audio;
    
    return true;
    
  } catch (error) {
    console.error('[MCP Audio Player] Error creating audio player:', error);
    return false;
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[MCP Audio Player] Received message:', request.type);
  
  if (request.type === 'playAudioTrack') {
    const trackInfo = request.trackInfo;
    
    // Try Web Audio API approach first
    if (trackInfo.audioUrl) {
      playAudioFromUrl(trackInfo.audioUrl).then(success => {
        sendResponse({ success });
      });
    } else {
      // Fall back to HTML5 Audio
      createAudioPlayer(trackInfo).then(success => {
        sendResponse({ success });
      });
    }
    
    return true; // Keep message channel open for async response
  } else if (request.type === 'stopAudio') {
    if (currentAudioSource) {
      if (currentAudioSource.pause) {
        // HTML5 Audio element
        currentAudioSource.pause();
        currentAudioSource.currentTime = 0;
      } else {
        // Web Audio API source
        currentAudioSource.stop();
      }
      currentAudioSource = null;
    }
    isPlaying = false;
    sendResponse({ success: true });
  } else if (request.type === 'getAudioStatus') {
    sendResponse({ isPlaying });
  }
});

// Initialize audio context on page load to avoid autoplay restrictions
document.addEventListener('DOMContentLoaded', () => {
  // Create a silent audio context to initialize
  const context = initAudioContext();
  
  // Create a silent oscillator to enable audio context
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  
  gainNode.gain.setValueAtTime(0, context.currentTime);
  oscillator.frequency.setValueAtTime(440, context.currentTime);
  
  oscillator.start(context.currentTime);
  oscillator.stop(context.currentTime + 0.01);
  
  console.log('[MCP Audio Player] Audio context pre-initialized');
});
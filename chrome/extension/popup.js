// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  const enableToggle = document.getElementById('enableToggle');
  const statusText = document.getElementById('statusText');
  const contextText = document.getElementById('contextText');
  const trackList = document.getElementById('trackList');
  const stopMusicBtn = document.getElementById('stopMusicBtn');
  const nextTrackBtn = document.getElementById('nextTrackBtn');
  const playlistStatus = document.getElementById('playlistStatus');
  const errorMessage = document.getElementById('errorMessage');
  const spotifyInfo = document.getElementById('spotifyInfo');
  const forceExtractBtn = document.getElementById('forceExtractBtn');

  // Load saved state
  const { enabled, currentContext, recommendations } = await chrome.storage.local.get([
    'enabled', 'currentContext', 'recommendations'
  ]);

  // Set initial states
  enableToggle.checked = enabled || false;
  updateStatus(enabled || false);

  if (currentContext && currentContext !== 'Cannot extract context from this page') {
    contextText.textContent = currentContext;
  } else if (enabled) {
    contextText.textContent = 'Extracting content...';
    // Trigger immediate content extraction
    chrome.runtime.sendMessage({ type: 'requestContentExtraction' });
  } else {
    contextText.textContent = 'Enable to start monitoring';
  }

  if (recommendations && recommendations.length > 0) {
    displayTracks(recommendations);
  }

  // Spotify info is always visible

  // Toggle handler
  enableToggle.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await chrome.storage.local.set({ enabled });
    updateStatus(enabled);
    
    if (enabled) {
      contextText.textContent = 'Extracting content...';
    } else {
      contextText.textContent = 'No context detected';
    }
    
    // Send message to background script
    chrome.runtime.sendMessage({ type: 'toggleEnabled', enabled });
  });

  // Stop music button
  stopMusicBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'stopMusic' });
  });

  // Next track button
  nextTrackBtn.addEventListener('click', () => {
    // Prevent rapid clicking
    nextTrackBtn.disabled = true;
    nextTrackBtn.textContent = 'Loading...';
    
    chrome.runtime.sendMessage({ type: 'playNextTrack' });
    
    // Re-enable after delay
    setTimeout(() => {
      nextTrackBtn.disabled = false;
      nextTrackBtn.textContent = 'Next Track';
    }, 2000);
  });

  // Force extract button
  forceExtractBtn.addEventListener('click', () => {
    forceExtractBtn.textContent = '🔄 Extracting...';
    forceExtractBtn.disabled = true;
    
    chrome.runtime.sendMessage({ type: 'forceExtractContext' }, (response) => {
      setTimeout(() => {
        forceExtractBtn.textContent = '🔄 Force Extract Context';
        forceExtractBtn.disabled = false;
      }, 2000);
    });
  });

  // Listen for updates from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'contextUpdate') {
      contextText.textContent = request.context;
    } else if (request.type === 'recommendationsUpdate') {
      displayTracks(request.recommendations);
      updatePlaylistStatus(request.recommendations);
    } else if (request.type === 'error') {
      showError(request.message);
    } else if (request.type === 'info') {
      showInfo(request.message);
    }
  });

  function updateStatus(enabled) {
    statusText.textContent = enabled ? 'Active - Monitoring context' : 'Inactive';
    statusText.style.color = enabled ? '#4CAF50' : '#666';
  }

  function displayTracks(tracks) {
    if (!tracks || tracks.length === 0) {
      trackList.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">No recommendations yet</div>';
      return;
    }

    trackList.innerHTML = tracks.slice(0, 10).map((track, index) => `
      <div class="track-item" data-index="${index}">
        <div class="track-name">${track.track_name}</div>
        <div class="track-artist">${track.artist_name}</div>
      </div>
    `).join('');

    // Add click handlers - trigger auto-play
    trackList.querySelectorAll('.track-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index);
        const track = tracks[index];
        
        // Show immediate feedback
        item.style.background = '#e3f2fd';
        item.style.transform = 'scale(0.98)';
        
        // Show loading message
        showInfo(`Playing: ${track.track_name} by ${track.artist_name}...`);
        
        // Trigger auto-play through background script
        chrome.runtime.sendMessage({
          type: 'playSpecificTrack',
          track: track,
          index: index
        });
        
        // Reset visual feedback after short delay
        setTimeout(() => {
          item.style.background = '';
          item.style.transform = '';
        }, 200);
      });
    });
  }

  function updatePlaylistStatus(tracks) {
    if (tracks && tracks.length > 0) {
      playlistStatus.textContent = `Playlist ready: ${tracks.length} tracks`;
    } else {
      playlistStatus.textContent = 'No active playlist';
    }
  }

  function showError(message) {
    errorMessage.innerHTML = `<div class="error">${message}</div>`;
    setTimeout(() => {
      errorMessage.innerHTML = '';
    }, 5000);
  }

  function showInfo(message) {
    errorMessage.innerHTML = `<div style="background: #e3f2fd; color: #1976d2; padding: 8px; border-radius: 4px; font-size: 13px; margin-top: 8px;">${message}</div>`;
    setTimeout(() => {
      errorMessage.innerHTML = '';
    }, 8000);
  }

  // Initialize playlist status
  if (recommendations && recommendations.length > 0) {
    updatePlaylistStatus(recommendations);
  }

  // Spotify works without authentication using search URLs
});
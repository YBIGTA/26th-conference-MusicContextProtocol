# Music Context Protocol - Chrome Extension

This Chrome extension automatically plays music that matches your current work context by analyzing web page content and recommending appropriate playlists.

## Features

- Real-time context detection from web pages
- Automatic playlist recommendations based on your work
- Integration with Spotify and YouTube
- Context change detection using Google Gemini AI
- 5-second interval monitoring when enabled

## Setup

### 1. Start the API Server

First, make sure you have Docker installed, then run:

```bash
cd chrome/api
docker-compose up
```

This will start the music recommendation API on `http://localhost:8000`.

### 2. Install the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `chrome/extension` folder
5. The extension will appear in your toolbar

## Usage

1. Click the extension icon in the toolbar
2. Toggle the switch to enable monitoring
3. Choose your preferred music service (Spotify or YouTube)
4. Browse normally - the extension will detect your context and recommend music
5. Click on any track to open it in your selected service

## How it Works

1. **Content Extraction**: The extension extracts key content from web pages (title, headings, main content)
2. **Context Detection**: Uses Google Gemini AI to understand the work context
3. **Change Detection**: Monitors for significant context changes every 5 seconds
4. **Music Recommendation**: Sends context to the API which returns relevant tracks
5. **Auto-play**: Opens the top recommendation in your chosen music service

## Configuration

The extension uses:
- Local API at `http://localhost:8000`
- Google Gemini API for context analysis
- Upstage API for music feature analysis

## Privacy

- Content analysis happens locally and through your API keys
- No data is stored permanently
- Only active tab content is analyzed when enabled
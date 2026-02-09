# Webpage Mirror - HTTP Server Setup

## Overview
The Webpage Mirror extension now opens a local HTTP server that serves the mirror display, making it accessible via your local network and compatible with Chromecast devices.

## Architecture

### New Components

1. **server.js** - Node.js HTTP server (optional, for advanced users)
   - Hosts the mirror interface on a local IP address
   - Provides Chromecast compatibility headers
   - Serves API endpoints for status and configuration

2. **mirror-server.html** - Standalone mirror display page
   - Self-contained HTML/CSS for the mirror interface
   - Can be served over HTTP
   - Includes controls for pause, fullscreen, quality, and display modes

3. **mirror-server.js** - Client-side display logic
   - Receives and renders video frames
   - Manages display modes (fit/fill)
   - Handles controls and user interaction

4. **mirror-bridge.js** - Extension content script bridge
   - Injects on the mirror server page
   - Bridges communication between background script and display page
   - Relays video frames to the display

## How It Works

1. Click "Open Mirror" in the popup
2. The extension creates a separate browser window/tab pointing to the mirror server
3. Video frames are captured from the source tab and sent to the mirror display
4. The mirror displays on a separate network address that can be cast to via Chromecast

## Network Access

The mirror window is served at:
- **http://localhost:8765** (local machine)
- **http://<your-local-ip>:8765** (network-accessible)

Get your local IP:
- **Linux/Mac**: `ifconfig | grep "inet "`
- **Windows**: `ipconfig`

## Chromecast Integration

To cast to the Webpage Mirror:

1. Open your Chromecast settings in the browser
2. Look for "Webpage Mirror" in the available devices list
3. Click to cast to that device

## Controls in Mirror

- **Pause**: Pause/resume the stream
- **Fullscreen**: Toggle fullscreen mode
- **Quality**: Adjust video quality (high/normal/low)
- **Fit**: Preserve aspect ratio
- **Fill**: Stretch to fill screen
- **I key**: Toggle info panel (shows stats)

## System Requirements

- Chrome/Chromium browser
- Extension manifest v3 support
- Local network connectivity (for Chromecast)

## Troubleshooting

**Mirror window doesn't appear:**
- Check if port 8765 is already in use
- Try a different port in the code
- Check browser console for errors

**Can't see as Chromecast option:**
- Ensure the mirror window is open
- Try accessing `http://localhost:8765` directly in browser
- Check that your device is on the same network

**No video stream:**
- Make sure the source tab is still open
- Try pausing and resuming the stream
- Check the FPS counter (press I) for stats

# Webpage Mirror - Chromecast Integration Guide

## What Changed?

Previously, the mirror would open as a popup window in the same browser. Now it opens as a **separate browsing context** with its own IP address, making it appear as a Chromecast-compatible device.

## Key Improvements

✅ **Network Accessible** - The mirror window is served on a local HTTP server
✅ **Chromecast Compatible** - Can be cast to via the browser's cast menu
✅ **Independent Display** - Runs in a separate window/tab, not tied to the source tab
✅ **Automatic Server** - The extension automatically manages the local server
✅ **Easy Access** - Just click "Open Mirror" and the IP address is displayed

## Step-by-Step Usage

### 1. Open the Extension
- Click the Webpage Mirror icon in your Chrome toolbar

### 2. Open Mirror
- Make sure you have a webpage open that you want to mirror
- Click "Open Mirror" button
- The popup will show you the mirror address (e.g., `http://192.168.1.100:8765`)

### 3. Cast to Chromecast
Option A: From the Browser
- Click the Chrome Cast button in your browser
- Look for "Webpage Mirror" in the devices list
- Click to start casting

Option B: Direct Access
- Open the displayed URL (`http://192.168.1.100:8765`) on any device on your network
- The video stream will display

### 4. Control the Mirror
- **Pause**: Pause/resume the video stream
- **Quality**: Adjust video compression (affects network bandwidth)
- **Fit/Fill**: Choose how the video scales on the display

## Network Architecture

```
Source Tab (Chrome)
    ↓
    │ Captures frames via content.js
    ↓
Extension Background
    ↓ Stores frames
    ↓
Mirror Server (HTTP)
    ↓ Serves at port 8765
    ↓
Any Device on Network
    └─→ Browser/Chromecast Device
```

## Technical Details

### Files Involved

| File | Purpose |
|------|---------|
| `background.js` | Manages frame capture and distribution |
| `mirror-server.html` | HTML interface for the mirror display |
| `mirror-server.js` | Display rendering and controls |
| `mirror-bridge.js` | Communication bridge between extension and web page |
| `content.js` | Captures video frames from source tab |

### Port Configuration

- Default port: **8765**
- Can be changed in `background.js` (line 10)
- Ensure port is not blocked by firewall

### Frame Transmission

1. Source tab captures screenshot/display
2. Content script converts to JPEG (base64)
3. Background script relays to mirror tab every ~16ms (~60fps)
4. Mirror display renders on canvas

## Troubleshooting

**Problem**: Mirror doesn't appear in Chromecast list
- **Solution**: Check that both devices are on the same network
- Try accessing the displayed IP directly in a browser first

**Problem**: Video stream is laggy
- **Solution**: Reduce quality setting in the mirror controls
- Check network bandwidth with `iperf3` or similar tools

**Problem**: Can't access from another device
- **Solution**: Use the IP address instead of localhost
- Check firewall settings allow port 8765

**Problem**: Port 8765 already in use
- **Solution**: Change the port in `background.js` line 10
- Or close the application using that port

## Advanced Usage

### Custom Port
Edit `background.js`:
```javascript
let mirrorServerUrl = 'http://localhost:9999';  // Change 8765 to your port
```

### Quality Settings
Available quality options (in mirror controls):
- High: 0.90 (90% JPEG quality, uses more bandwidth)
- Normal: 0.80 (80% JPEG quality, balanced)
- Low: 0.70 (70% JPEG quality, low bandwidth)

### Display Modes
- **Fit**: Preserves aspect ratio with letterboxing
- **Fill**: Stretches to fill the entire display

## Security Notes

⚠️ **Network Security**
- The mirror server is accessible to any device on your network
- For public networks, consider using a VPN or firewall rules
- Only share the IP address with trusted devices

⚠️ **Content Security**
- The mirrored content is transmitted over HTTP (not HTTPS by default)
- For sensitive content, use a local network only or implement HTTPS

## Future Enhancements

Potential improvements:
- [ ] HTTPS support with self-signed certificates
- [ ] Authentication/PIN protection
- [ ] Multiple simultaneous mirrors
- [ ] Custom resolution/bitrate settings
- [ ] Audio streaming
- [ ] Built-in server in Node.js wrapper

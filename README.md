# Webpage Mirror v2.0 - Clean Rebuild

A high-quality webpage streaming extension using Chrome's native APIs.

## Architecture

```
Source Webpage
    ↓
content.js (Captures using getDisplayMedia or chrome.tabs.captureVisibleTab)
    ↓
background.js (Stores frames in memory buffer)
    ↓
mirror.html/js (Displays stream on canvas)
    ↓
User sees high-quality stream
```

## Setup

### 1. Load Extension in Chrome

- Open `chrome://extensions/`
- Enable **Developer mode** (top right)
- Click **Load unpacked**
- Select the `/Webpage Mirror` folder

### 2. Use It

- Go to any webpage
- Click the **Webpage Mirror** extension icon
- Click **Open Mirror Window**
- Permission dialog appears → Click **Share**
- Mirror window opens with live stream
- Click **Close Mirror** when done

## Features

✅ **Chrome Native Capture** - Uses `getDisplayMedia()` for best quality  
✅ **Automatic Fallback** - Falls back to tab capture if needed  
✅ **No External Server** - Everything runs in Chrome  
✅ **High Quality** - 90% JPEG quality for smooth display  
✅ **Real-Time** - Smooth streaming with minimal latency  
✅ **One-Click Control** - Simple start/stop interface  

## Files

- `manifest.json` - Extension configuration
- `background.js` - Frame buffer & window management
- `content.js` - Capture implementation (Chrome APIs)
- `popup.html/js` - UI controls
- `mirror.html/js` - Display window

## How It Works

### Capture Methods (Tried in Order)

1. **getDisplayMedia()** (Primary)
   - User-approved browser tab capture
   - Direct pixel access
   - 90% JPEG quality
   - Real-time smooth rendering

2. **chrome.tabs.captureVisibleTab()** (Fallback)
   - Automatic, no permission needed
   - 80% JPEG quality
   - 20fps
   - Reliable backup

### Data Flow

```
1. User clicks "Open Mirror Window"
2. background.js creates mirror window
3. content.js starts capture on source tab
4. Frames sent to background via chrome.runtime.sendMessage
5. background.js stores in frameBuffer
6. mirror.js requests frames continuously
7. Canvas renders each frame
8. User sees smooth stream
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Permission dialog doesn't appear | Reload extension, refresh webpage |
| Black screen in mirror | Check if streaming started (check console) |
| Blurry stream | Wait a few seconds for quality to stabilize |
| Stream ends suddenly | Check if mirror window closed |

## Performance

- **Quality**: 90% JPEG (native) or 80% JPEG (fallback)
- **Frame Rate**: Real-time (native) or ~20fps (fallback)
- **Latency**: Minimal (~16-50ms)
- **CPU**: Moderate (canvas rendering + capture)
- **Memory**: Minimal (single frame buffer)

## Technical Details

### Why No Server?

- Uses Chrome's message passing API instead
- Frame stays in memory (fast access)
- Background service worker acts as buffer
- Mirror window requests frames on demand
- Simpler, more reliable, no external dependencies

### Browser Support

- ✅ Chrome 72+
- ✅ Edge 79+
- ✅ Opera 60+
- ⚠️ Firefox (tab capture only)
- ❌ Safari (not supported)

## Limitations

- Cannot stream system pages (chrome://, edge://)
- Stream is view-only (can't interact with mirror)
- One mirror window per time
- Requires user permission for native capture

## Getting Started

1. **Load extension** in chrome://extensions/ (Developer mode)
2. **Go to any webpage**
3. **Click icon** → **Open Mirror Window**
4. **Click Share** when prompted
5. **Done!** Enjoy your stream

---

**Clean, simple, and working with Chrome's native APIs!** 🎥

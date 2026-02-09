# Debugging Guide

## Current Architecture
- **Extension Type**: Chrome Extension (Manifest V3)
- **No External Server**: All processing happens in the extension
- **Capture Methods**: getDisplayMedia() → fallback to chrome.tabs.captureVisibleTab()
- **Communication**: Chrome Runtime Messages (async)

## How to Test

### 1. Load Extension in Chrome
1. Open `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select the `Webpage Mirror` folder
5. Should see extension in list

### 2. Check Console Logs
1. Open DevTools on any webpage (F12)
2. Go to **Console** tab
3. Look for messages starting with `[Mirror]`
4. These logs indicate extension status

### 3. Test Streaming
1. Navigate to any webpage
2. Click the extension icon
3. Popup should appear with:
   - "Open Mirror Window" button (initially enabled)
   - Status label (initially showing any errors)
4. Click "Open Mirror Window"
5. New window should open showing the webpage
6. You should see FPS counter at bottom-left

### 4. Control the Mirror
Once mirror opens:
- **Spacebar**: Pause/Resume
- **F**: Fullscreen
- **Escape**: Close mirror
- Use control bar buttons for same functions

## Troubleshooting

### Issue: Button doesn't respond
**Solution**: Check console for errors
```
[Mirror] Message received: startStream
[Mirror] Requesting getDisplayMedia...
```
Should see these logs when clicking button.

### Issue: getDisplayMedia permission denied
**User Action**: Chrome will prompt "Allow" or "Block" - choose "Allow"
**Result**: Should see `[Mirror] getDisplayMedia successful`

### Issue: Window opens but shows blank/black
**Possible Causes**:
1. Capture not started - check `[Mirror] Starting stream...` log
2. Video not playing - check `[Mirror] Video play error` log
3. Permission denied - check `[Mirror] getDisplayMedia failed`

**Solution**: Try tab capture fallback - close and reopen mirror

### Issue: Stream stops after starting
**Possible Causes**:
1. Video track ended - check `[Mirror] Video track ended` log
2. Permission revoked - user closed permission prompt
3. Tab was closed

**Solution**: Reopen mirror or try different webpage

### Issue: Restart fails (worked once, then failed)
**Now Fixed By**:
- Added proper cleanup in `stopStreaming()` (nullifies mediaStream, videoElement)
- Added 500ms delay in background.js before sending startStream
- Added error handling with try-catch blocks
- Added comprehensive console logging

**Testing**: 
1. Open mirror - should work
2. Close mirror
3. Open mirror again - should work again

## Performance

### Frame Rate
- Target: 20 FPS (50ms interval for tab capture)
- Display: 60 FPS rendered, but limited by capture rate
- FPS counter visible in mirror window bottom-left

### Quality Settings
- Default: 90% JPEG quality
- Available: 90% (best), 80% (good), 70% (fast)
- Switch via quality button in mirror window control bar

### Memory Usage
- Frame buffer: ~50KB per frame (1920x1080 @ 70% quality)
- Peak: ~200KB-500KB with buffering
- No accumulation: Frames are discarded after display

## What Each File Does

### popup.html / popup.js
- User interface in extension popup
- "Open Mirror Window" button (disabled while streaming)
- "Close Mirror" button (only visible when streaming)
- Error messages displayed here

### background.js
- Central hub for messages
- Manages frame buffer
- Tracks streaming state
- Creates/manages mirror window
- Responds to popup commands

### content.js
- Runs on webpage being streamed
- Captures video via getDisplayMedia() or tab capture
- Sends frames to background.js
- Listens for start/stop commands

### mirror.html / mirror.js
- Display window UI
- Canvas rendering (60fps)
- Control bar (pause, fullscreen, quality, fit/fill)
- FPS counter
- Keyboard shortcuts

### manifest.json
- Extension configuration
- Declares permissions
- Specifies scripts and entry points

## Advanced Debugging

### Enable More Logging
Open `background.js` and check console in extension popup:
1. Right-click extension icon
2. Select "Manage extension"
3. Scroll to "Inspect views"
4. Click "service_worker" link
5. DevTools opens showing extension console

Watch for messages like:
```
[Mirror] Received message: { action: 'startStream' }
[Mirror] Open mirror window
[Mirror] Frame received from tab
[Mirror] Window created with id: 123
```

### Check Message Flow
Messages flow: popup.js → background.js → content.js → background.js → mirror.js

To verify:
1. Click button in popup
2. Check popup console for: `Sent startStream command`
3. Check background service worker console for: `Received message: { action: 'startStream' }`
4. Check webpage content script console for: `[Mirror] Received message: startStream`
5. Check mirror window console for: `Frame received`

## Known Limitations

1. **getDisplayMedia** requires user permission each session (browser security)
2. **Tab capture** limited to 20fps (Chrome API limitation)
3. **Capture resolution** limited to screen resolution
4. **No audio** captured (intentional - video only)

## Next Steps if Issues Persist

1. Check manifest.json has `"permissions": ["tabs", "windows", "scripting", "storage"]`
2. Verify all .js files have proper error handling (try-catch blocks)
3. Check browser console (F12 on webpage) for `[Mirror]` prefix logs
4. Verify extension is enabled in `chrome://extensions/`
5. Try incognito mode (sometimes helps with permissions)
6. Reload extension: `chrome://extensions/` → reload button on extension card

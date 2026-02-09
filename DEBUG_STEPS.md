# Quick Debugging Steps

## If stuck on "Waiting for stream..."

### Step 1: Open DevTools on the Source Tab
1. Right-click on the tab you're trying to stream
2. Select **"Inspect"** to open DevTools
3. Go to **Console** tab
4. Look for messages starting with `[Mirror]`

### Step 2: Check for These Logs
You should see one of these messages:

✅ **Good** - Stream starting:
```
[Mirror] Message received: startStream from sender tab: 123
[Mirror] Starting stream
[Mirror] Requesting getDisplayMedia...
```

❌ **Bad** - Missing logs means content script not loaded:
```
(No [Mirror] messages appear)
```

### Step 3: Reload Everything
1. **Reload the extension**:
   - Go to `chrome://extensions/`
   - Click reload button on "Webpage Mirror" extension
2. **Reload the webpage** (the tab you want to stream):
   - Press F5 or Ctrl+R
3. **Try opening mirror again**:
   - Click extension icon → "Open Mirror Window"

### Step 4: Check Extension Service Worker
1. Go to `chrome://extensions/`
2. Click **"Inspect views"** under "Webpage Mirror"
3. Click **"service_worker"** (not the popup)
4. In the Console that opens, look for:
   ```
   openMirror request received with tabId: 123
   Source tab ID: 123 URL: https://...
   Mirror window created, ID: 456
   Sending startStream to tab 123
   ```

### Step 5: If Still Not Working
Check for these errors in the service worker console:
- "Tab no longer exists" → The tab was closed
- "Cannot mirror system pages" → You're on a chrome:// page
- "Error sending startStream" → Content script not loaded on that tab

## Common Fixes

**Fix 1: Content Script Not Loading**
- Reload the webpage (F5)
- Try a different webpage
- Make sure it's not a special page (chrome://, about://)

**Fix 2: Wrong Extension Permissions**
- Open `chrome://extensions/`
- Make sure "Webpage Mirror" is enabled
- Check permissions are allowed

**Fix 3: Mirror Window Opens But No Stream**
- Press F12 on the **mirror window** to open its DevTools
- Check Console for errors
- Look for "Waiting for stream..." message

**Fix 4: Quick Reset**
- Close mirror window (if open)
- Close the extension popup
- Reload the extension in `chrome://extensions/`
- Refresh the webpage you want to stream
- Try again

## Console Messages Explained

| Message | Meaning |
|---------|---------|
| `[Mirror] Message received: startStream` | Capture is starting |
| `[Mirror] Requesting getDisplayMedia...` | Asking user for permission |
| `[Mirror] getDisplayMedia successful` | Permission granted, capturing started |
| `[Mirror] getDisplayMedia failed: NotAllowedError` | User blocked permission prompt |
| `[Mirror] Tab capture started` | Using fallback method (slower but works everywhere) |
| `[Mirror] Frame received` | Stream is working, frames being sent to mirror |
| `Waiting for stream...` | Mirror is ready but not receiving frames |

## Advanced: Manual Test

In the extension service worker console (from Step 4), run:
```javascript
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  console.log('Active tab:', tabs[0]?.id, tabs[0]?.url);
});
```

This tells you which tab is currently active.

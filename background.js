// Background Service Worker - Manages frame buffer and window lifecycle

let frameBuffer = null;
let sourceTabId = null;
let mirrorWindowId = null;
let mirrorTabId = null;
let isStreamingToMirror = false; // Primary state: is mirror window streaming?
let streamStartTime = 0;
let frameCount = 0;
let frameUpdateInterval = null;

console.log('Background service worker loaded');

// Create offscreen document if it doesn't exist
async function ensureOffscreenDocument() {
  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    
    if (existingContexts.length > 0) {
      console.log('Offscreen document already exists');
      return;
    }
    
    console.log('Creating offscreen document');
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: ['DISPLAY_MEDIA'],
      justification: 'Handle screen capture for webpage mirroring'
    });
  } catch (err) {
    console.error('Error managing offscreen document:', err);
  }
}

// Handle mirror window closing
chrome.windows.onRemoved.addListener((windowId) => {
  console.log('Window removed:', windowId);
  if (windowId === mirrorWindowId) {
    mirrorWindowId = null;
    mirrorTabId = null;
    isStreamingToMirror = false;
    
    // Stop offscreen capture
    chrome.runtime.sendMessage({
      action: 'stopCapture'
    }).catch(err => {
      console.log('Could not stop offscreen capture:', err);
    });
    
    if (frameUpdateInterval) {
      clearInterval(frameUpdateInterval);
      frameUpdateInterval = null;
    }
    console.log('Stream stopped - mirror window closed');
  }
});

// Handle mirror tab closing
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === mirrorTabId) {
    console.log('Mirror tab closed:', tabId);
    mirrorTabId = null;
    mirrorWindowId = null;
    isStreamingToMirror = false;
    
    // Stop offscreen capture
    chrome.runtime.sendMessage({
      action: 'stopCapture'
    }).catch(err => {
      console.log('Could not stop offscreen capture:', err);
    });
    
    if (frameUpdateInterval) {
      clearInterval(frameUpdateInterval);
      frameUpdateInterval = null;
    }
    console.log('Stream stopped - mirror tab closed');
  }
});

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.action === 'openMirror') {
      console.log('openMirror request received with tabId:', request.tabId);
      
      // Stop any previous stream first
      if (sourceTabId && sourceTabId !== request.tabId) {
        console.log('Stopping previous stream on tab:', sourceTabId);
        chrome.tabs.sendMessage(sourceTabId, { action: 'stopStream' }).catch(() => {
          console.log('Could not stop previous stream (tab may be gone)');
        });
      }
      
      // Use provided tab ID
      sourceTabId = request.tabId;
      
      // Get current window (popup window) to position mirror there
      chrome.windows.getCurrent((popupWindow) => {
        chrome.tabs.get(sourceTabId, (tab) => {
          if (chrome.runtime.lastError) {
            console.error('Error getting tab:', chrome.runtime.lastError);
            sendResponse({ error: 'Tab no longer exists' });
            return;
          }
          
          if (!tab || !tab.url) {
            console.error('Tab not found');
            sendResponse({ error: 'Tab not found' });
            return;
          }
          
          if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
            console.error('Cannot mirror system pages');
            sendResponse({ error: 'Cannot mirror system pages' });
            return;
          }
          
          console.log('Source tab ID:', sourceTabId, 'URL:', tab.url);
          console.log('Source tab window ID:', tab.windowId);
          console.log('Popup window position:', popupWindow.left, popupWindow.top);
          
          // Create mirror window at the same position as popup window using original mirror.html
          const windowOptions = {
            url: chrome.runtime.getURL('mirror.html'),
            type: 'popup',
            width: 1024,
            height: 768,
            focused: true
          };
          
          // Position the mirror window at the popup's location
          if (popupWindow.left !== undefined) {
            windowOptions.left = popupWindow.left;
            windowOptions.top = popupWindow.top;
          }
          
          chrome.windows.create(windowOptions, (window) => {
            if (chrome.runtime.lastError) {
              console.error('Error creating window:', chrome.runtime.lastError);
              sendResponse({ error: chrome.runtime.lastError.message });
              return;
            }
            
            mirrorWindowId = window.id;
            mirrorTabId = window.tabs[0].id;
            isStreamingToMirror = true;
            streamStartTime = Date.now();
            frameCount = 0;
            frameBuffer = null;
            
            console.log('Mirror window created, ID:', mirrorWindowId, 'Tab ID:', mirrorTabId);
            
            // Ensure offscreen document exists before starting capture
            ensureOffscreenDocument().then(() => {
              // Give offscreen document a moment to be ready, then send start message
              setTimeout(() => {
                console.log('Sending startCapture to offscreen document with mirror destination:', mirrorTabId);
                
                // Start capture in offscreen document (which can call getDisplayMedia)
                chrome.runtime.sendMessage({
                  action: 'startCapture',
                  mirrorTabId: mirrorTabId,
                  mirrorWindowId: mirrorWindowId,
                  frameRate: 30
                }).catch(err => {
                  console.error('Error starting offscreen capture:', err);
                });
              }, 500);
            });
            
            sendResponse({ success: true });
          });
        });
      });
      
      return true; // Keep listener alive for async response
    }
    
    else if (request.action === 'closeMirror') {
      console.log('closeMirror request received');
      
      if (frameUpdateInterval) {
        clearInterval(frameUpdateInterval);
        frameUpdateInterval = null;
      }
      
      // Stop offscreen capture
      chrome.runtime.sendMessage({
        action: 'stopCapture'
      }).catch(err => {
        console.log('Could not stop offscreen capture:', err);
      });
      
      if (mirrorWindowId) {
        chrome.windows.remove(mirrorWindowId, () => {
          if (chrome.runtime.lastError) {
            console.error('Error closing window:', chrome.runtime.lastError);
          } else {
            console.log('Mirror window closed');
            mirrorWindowId = null;
            mirrorTabId = null;
            isStreamingToMirror = false;
          }
        });
      }
      sendResponse({ success: true });
    }
    
    else if (request.action === 'frameUpdate') {
      // Store frame from content script - targeted to mirror tab
      // Frames from offscreen document will have undefined sender.tab.id, which is OK
      // Frames from content scripts must match the source tab
      
      const isFromOffscreen = !sender.tab || sender.tab.id === undefined;
      const isFromCorrectTab = sender.tab?.id === sourceTabId;
      
      if (!isFromOffscreen && !isFromCorrectTab) {
        console.warn('IGNORED frame from wrong tab:', sender.tab?.id, 'Expected source:', sourceTabId);
        return;
      }
      
      frameBuffer = request.frame;
      frameCount++;
      
      // Forward frame directly to mirror tab if specified
      if (request.mirrorTabId && mirrorTabId === request.mirrorTabId) {
        chrome.tabs.sendMessage(request.mirrorTabId, {
          action: 'displayFrame',
          frame: request.frame
        }).catch(err => console.error('Error sending frame to mirror tab:', err));
      }
    }
    
    else if (request.action === 'getFrame') {
      // Send frame to mirror window
      sendResponse({ frame: frameBuffer });
    }
    
    else if (request.action === 'isStreaming') {
      // Check if mirror window is actively streaming
      sendResponse({ streaming: isStreamingToMirror });
    }
    
    else if (request.action === 'getStats') {
      // Return streaming stats
      const uptime = isStreamingToMirror ? Date.now() - streamStartTime : 0;
      sendResponse({ 
        streaming: isStreamingToMirror,
        frameCount: frameCount,
        uptime: uptime,
        sourceTabId: sourceTabId,
        mirrorWindowId: mirrorWindowId
      });
    }
  } catch (err) {
    console.error('Error in message handler:', err);
    sendResponse({ error: err.message });
  }
});

console.log('Background service worker initialization complete');

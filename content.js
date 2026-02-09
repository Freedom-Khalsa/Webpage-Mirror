// Content Script - Captures and streams webpage

let isStreaming = false;
let captureCanvas = null;
let captureContext = null;
let mediaStream = null;
let frameInterval = null;
let videoElement = null;
let mirrorTabId = null; // Target tab for frames
let mirrorWindowId = null;

console.log('[Mirror] Content script injected');

// Initialize canvas for capture
function initCanvas() {
  if (!captureCanvas) {
    captureCanvas = document.createElement('canvas');
    captureContext = captureCanvas.getContext('2d', { willReadFrequently: true });
  }
}

// Try native getDisplayMedia first (highest quality)
async function tryNativeCapture() {
  try {
    console.log('[Mirror] Requesting getDisplayMedia...');
    console.log('[Mirror] Prompting user to select screen/window to share...');
    
    // Request display media with screen sharing prompt
    mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'always',
        displaySurface: 'monitor'  // Allow any display surface
      },
      audio: false
    }).catch(err => {
      console.error('[Mirror] getDisplayMedia rejected by user:', err.name, err.message);
      if (err.name === 'NotAllowedError') {
        console.log('[Mirror] User cancelled the share screen prompt');
      }
      throw err;
    });
    
    console.log('[Mirror] getDisplayMedia successful - user selected stream');
    
    const videoTrack = mediaStream.getVideoTracks()[0];
    if (!videoTrack) {
      console.error('[Mirror] No video track in media stream');
      return false;
    }
    
    const settings = videoTrack.getSettings();
    console.log('[Mirror] Video settings:', settings.width, 'x', settings.height);
    
    initCanvas();
    captureCanvas.width = settings.width;
    captureCanvas.height = settings.height;
    
    videoElement = document.createElement('video');
    videoElement.srcObject = mediaStream;
    videoElement.play().catch(e => console.error('[Mirror] Video play error:', e));
    
    // Capture frames continuously
    const captureLoop = async () => {
      if (!isStreaming) return;
      
      try {
        captureContext.drawImage(videoElement, 0, 0, captureCanvas.width, captureCanvas.height);
        
        captureCanvas.toBlob((blob) => {
          if (!blob) return;
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            // Send frame directly to mirror tab/window
            chrome.runtime.sendMessage({
              action: 'frameUpdate',
              frame: base64,
              mirrorTabId: mirrorTabId,
              mirrorWindowId: mirrorWindowId
            }).catch(err => console.error('[Mirror] Error sending frame:', err));
          };
          reader.readAsDataURL(blob);
        }, 'image/jpeg', 0.90);
      } catch (e) {
        console.error('[Mirror] Capture error:', e);
      }
      
      requestAnimationFrame(captureLoop);
    };
    
    captureLoop();
    
    // Stop when stream ends
    videoTrack.onended = () => {
      console.log('[Mirror] Video track ended');
      stopStreaming();
    };
    
    console.log('[Mirror] Native capture started successfully');
    return true;
  } catch (e) {
    console.error('[Mirror] Native capture failed:', e.name, e.message);
    return false;
  }
}

// Fallback: Use Chrome tab capture
function startTabCapture() {
  console.log('[Mirror] Starting tab capture (fallback)');
  
  if (frameInterval) clearInterval(frameInterval);
  
  frameInterval = setInterval(() => {
    if (!isStreaming) return;
    
    chrome.runtime.sendMessage({ action: 'captureTab' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Mirror] captureTab error:', chrome.runtime.lastError);
        return;
      }
      
      if (response && response.screenshot) {
        chrome.runtime.sendMessage({
          action: 'frameUpdate',
          frame: response.screenshot,
          mirrorTabId: mirrorTabId,
          mirrorWindowId: mirrorWindowId
        }).catch(err => console.error('[Mirror] Error sending frame:', err));
      }
    });
  }, 50); // 20fps
  
  console.log('[Mirror] Tab capture started');
}

// Start streaming (tries native first, falls back to tab capture)
async function startStreaming() {
  if (isStreaming) {
    console.log('[Mirror] Already streaming');
    return;
  }
  
  isStreaming = true;
  console.log('[Mirror] Starting stream...');
  
  try {
    console.log('[Mirror] Attempting native getDisplayMedia capture...');
    const nativeWorked = await tryNativeCapture();
    
    if (!nativeWorked) {
      console.log('[Mirror] Native capture failed, using tab capture');
      startTabCapture();
    }
  } catch (err) {
    console.error('[Mirror] Native capture threw error:', err.name, err.message);
    console.log('[Mirror] Falling back to tab capture');
    startTabCapture();
  }
}

// Stop streaming
function stopStreaming() {
  isStreaming = false;
  console.log('[Mirror] Stopping stream...');
  
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => {
      t.stop();
      console.log('[Mirror] Stopped media track');
    });
    mediaStream = null;
  }
  
  if (videoElement) {
    videoElement.pause();
    videoElement.srcObject = null;
    videoElement = null;
  }
  
  if (frameInterval) {
    clearInterval(frameInterval);
    frameInterval = null;
  }
  
  console.log('[Mirror] Stream stopped completely');
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Mirror] Message received:', request.action, 'from sender tab:', sender.tab?.id);
  
  if (request.action === 'startStream') {
    console.log('[Mirror] Start stream request - Source tab ID:', request.tabId, 'Mirror tab ID:', request.mirrorTabId, 'This tab ID:', sender.tab?.id);
    
    // Verify this is the correct source tab
    if (request.tabId !== sender.tab?.id) {
      console.warn('[Mirror] IGNORED: Stream request is not for this tab! Requested tab:', request.tabId, 'This tab:', sender.tab?.id);
      sendResponse({ error: 'Tab ID mismatch - this tab is not the source' });
      return;
    }
    
    console.log('[Mirror] ✓ CORRECT TAB - Starting stream on source tab');
    mirrorTabId = request.mirrorTabId;
    mirrorWindowId = request.mirrorWindowId;
    console.log('[Mirror] Targeting mirror window:', mirrorWindowId, 'tab:', mirrorTabId);
    
    // Start streaming - this should trigger getDisplayMedia prompt
    startStreaming().then(() => {
      console.log('[Mirror] Stream started successfully');
    }).catch(err => {
      console.error('[Mirror] Error starting stream:', err);
    });
    
    sendResponse({ success: true });
  } else if (request.action === 'stopStream') {
    console.log('[Mirror] Stop stream request');
    stopStreaming();
    sendResponse({ success: true });
  }
});

console.log('[Mirror] Content script ready');

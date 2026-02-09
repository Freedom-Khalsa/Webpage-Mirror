// Offscreen Document - Handles getDisplayMedia with proper permissions

let mediaStream = null;
let captureCanvas = null;
let captureContext = null;
let videoElement = null;
let isCapturing = false;
let frameInterval = null;

console.log('[Offscreen] Offscreen document loaded');

// Initialize canvas
function initCanvas() {
  if (!captureCanvas) {
    captureCanvas = document.getElementById('offscreenCanvas');
    captureContext = captureCanvas.getContext('2d', { willReadFrequently: true });
  }
}

// Get display media (screen sharing)
async function getDisplayStream() {
  try {
    console.log('[Offscreen] Requesting getDisplayMedia...');
    
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'always'
      },
      audio: false
    });
    
    console.log('[Offscreen] getDisplayMedia successful');
    return stream;
  } catch (err) {
    console.error('[Offscreen] getDisplayMedia error:', err.name, err.message);
    throw err;
  }
}

// Start capturing from stream
async function startCapture(stream) {
  try {
    console.log('[Offscreen] Starting capture from stream');
    mediaStream = stream;
    isCapturing = true;
    
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      throw new Error('No video track in stream');
    }
    
    const settings = videoTrack.getSettings();
    console.log('[Offscreen] Stream settings:', settings.width, 'x', settings.height);
    
    // Setup canvas
    initCanvas();
    captureCanvas.width = settings.width;
    captureCanvas.height = settings.height;
    
    // Setup video element
    videoElement = document.getElementById('offscreenVideo');
    videoElement.srcObject = stream;
    await videoElement.play();
    
    console.log('[Offscreen] Capture started successfully');
    return true;
  } catch (err) {
    console.error('[Offscreen] Error starting capture:', err);
    throw err;
  }
}

// Capture frame
function captureFrame() {
  if (!isCapturing || !videoElement || !captureContext) {
    return null;
  }
  
  try {
    captureContext.drawImage(videoElement, 0, 0, captureCanvas.width, captureCanvas.height);
    
    return new Promise((resolve) => {
      captureCanvas.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.75);  // Reduced from 0.90 for faster compression
    });
  } catch (err) {
    console.error('[Offscreen] Frame capture error:', err);
    return null;
  }
}

// Stop capture
function stopCapture() {
  console.log('[Offscreen] Stopping capture');
  isCapturing = false;
  
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => {
      track.stop();
    });
    mediaStream = null;
  }
  
  if (videoElement) {
    videoElement.pause();
    videoElement.srcObject = null;
  }
  
  if (frameInterval) {
    clearInterval(frameInterval);
    frameInterval = null;
  }
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Offscreen] Message received:', request.action);
  
  if (request.action === 'startCapture') {
    console.log('[Offscreen] Start capture request');
    
    // Request screen share and start capturing
    getDisplayStream()
      .then(stream => startCapture(stream))
      .then(() => {
        console.log('[Offscreen] Capture initialized, starting frame loop at 60fps');
        
        // Start sending frames at 60fps with frame drop protection
        const frameRate = 60;
        const frameDuration = 1000 / frameRate;
        let frameNumber = 0;
        let lastSentTime = performance.now();
        let droppedFrameCount = 0;
        
        frameInterval = setInterval(async () => {
          if (isCapturing) {
            try {
              const frame = await captureFrame();
              if (frame) {
                const now = performance.now();
                const timeSinceLastSent = now - lastSentTime;
                
                // Check if we're falling behind (frame took too long)
                if (timeSinceLastSent > frameDuration * 1.5) {
                  droppedFrameCount = Math.floor(timeSinceLastSent / frameDuration) - 1;
                  if (droppedFrameCount > 0) {
                    console.warn('[Offscreen] Frame capture delayed, estimated', droppedFrameCount, 'frames dropped');
                  }
                }
                
                chrome.runtime.sendMessage({
                  action: 'frameUpdate',
                  frame: frame,
                  mirrorTabId: request.mirrorTabId,
                  mirrorWindowId: request.mirrorWindowId,
                  frameNumber: frameNumber,
                  timestamp: now
                }).catch(err => {
                  console.error('[Offscreen] Error sending frame:', err);
                });
                
                frameNumber++;
                lastSentTime = now;
              }
            } catch (err) {
              console.error('[Offscreen] Error in frame interval:', err);
            }
          }
        }, frameDuration);
        
        sendResponse({ success: true });
      })
      .catch(err => {
        console.error('[Offscreen] Capture failed:', err);
        sendResponse({ error: err.message });
      });
    
    return true; // Keep listener alive for async response
  }
  
  else if (request.action === 'stopCapture') {
    console.log('[Offscreen] Stop capture request');
    stopCapture();
    sendResponse({ success: true });
  }
});

console.log('[Offscreen] Ready to capture screen');

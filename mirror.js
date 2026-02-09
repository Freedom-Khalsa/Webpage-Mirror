// Mirror Window Script - Displays the stream with controls

const canvas = document.getElementById('display');
const ctx = canvas.getContext('2d');
const loading = document.getElementById('loading');
const controls = document.getElementById('controls');
const castingInfo = document.getElementById('castingInfo');
const castingDestination = document.getElementById('castingDestination');
const castingTabId = document.getElementById('castingTabId');
const castingWindowId = document.getElementById('castingWindowId');
const castingStatus = document.getElementById('castingStatus');
const pauseBtn = document.getElementById('pauseBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const fitBtn = document.getElementById('fitBtn');
const fillBtn = document.getElementById('fillBtn');
const qualitySelect = document.getElementById('quality');
const fpsValue = document.getElementById('fpsValue');
const dropStats = document.getElementById('dropStats');

let isPaused = false;
let currentQuality = 0.90;
let frameCount = 0;
let lastFrameTime = 0;
let fpsUpdateTime = 0;
let displayMode = 'fit'; // 'fit' or 'fill'
let pendingFrame = null; // Store frame received from background
let isReceivingFrames = false;
let renderScheduled = false;
let lastDisplayedFrameNumber = -1;
let droppedFrames = 0;
let totalFramesReceived = 0;
let renderInProgress = false;

// Get casting destination info from current tab/window
function initCastingInfo() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) {
      castingTabId.textContent = tabs[0].id;
      castingWindowId.textContent = tabs[0].windowId;
      castingDestination.textContent = 'This Mirror Window';
      console.log('[Mirror Display] Casting destination - Tab ID:', tabs[0].id, 'Window ID:', tabs[0].windowId);
    }
  });
}

// Initialize casting info on load
initCastingInfo();

// Listen for frames directly from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'displayFrame') {
    // Frame received directly from content script via background
    pendingFrame = request.frame;
    totalFramesReceived++;
    
    // Detect dropped frames
    if (request.frameNumber !== undefined) {
      const expectedFrameNumber = lastDisplayedFrameNumber + 1;
      if (request.frameNumber > expectedFrameNumber) {
        const droppedInThisBatch = request.frameNumber - expectedFrameNumber;
        droppedFrames += droppedInThisBatch;
        console.warn('[Mirror] Detected', droppedInThisBatch, 'dropped frames. Frame', expectedFrameNumber, 'to', request.frameNumber - 1);
      }
    }
    
    if (!isReceivingFrames) {
      isReceivingFrames = true;
      castingStatus.textContent = 'Receiving';
      castingStatus.style.color = '#4CAF50';
      console.log('[Mirror Display] Receiving frames - casting active');
      
      // Start render loop
      renderFrame();
    }
  }
});

// Set canvas size
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Fullscreen functionality
fullscreenBtn.addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(err => {
        console.log('Fullscreen request failed:', err);
      });
      fullscreenBtn.textContent = '⛶ Exit Fullscreen';
    } else {
      await document.exitFullscreen();
      fullscreenBtn.textContent = '⛶ Fullscreen';
    }
  } catch (err) {
    console.error('Fullscreen error:', err);
  }
});

// Pause/Resume
pauseBtn.addEventListener('click', () => {
  isPaused = !isPaused;
  pauseBtn.classList.toggle('active', isPaused);
  pauseBtn.textContent = isPaused ? '▶ Resume' : '⏸ Pause';
  
  if (!isPaused) {
    // Resume rendering
    renderFrame();
  } else {
    // Show pause message
    loading.classList.remove('hidden');
    loading.textContent = '⏸ Paused';
  }
});

// Quality control
qualitySelect.addEventListener('change', (e) => {
  currentQuality = parseFloat(e.target.value);
  console.log('Quality set to:', (currentQuality * 100).toFixed(0) + '%');
});

// Display mode: Fit (aspect ratio preserved)
fitBtn.addEventListener('click', () => {
  displayMode = 'fit';
  fitBtn.classList.add('active');
  fillBtn.classList.remove('active');
});

// Display mode: Fill (stretch to fill)
fillBtn.addEventListener('click', () => {
  displayMode = 'fill';
  fillBtn.classList.add('active');
  fitBtn.classList.remove('active');
});

// Show controls on mouse move
let controlsTimeout;
document.addEventListener('mousemove', () => {
  controls.classList.add('show');
  clearTimeout(controlsTimeout);
  controlsTimeout = setTimeout(() => {
    controls.classList.remove('show');
  }, 3000); // Hide after 3 seconds of inactivity
});

// Show controls on startup
controls.classList.add('show');
setTimeout(() => {
  controls.classList.remove('show');
}, 5000);

// Update FPS counter
function updateFPS() {
  const now = performance.now();
  if (now - fpsUpdateTime >= 1000) {
    fpsValue.textContent = frameCount;
    
    // Update drop stats
    const dropRate = droppedFrames / Math.max(totalFramesReceived, 1);
    const dropPercentage = (dropRate * 100).toFixed(1);
    dropStats.textContent = 'Drops: ' + droppedFrames + ' (' + dropPercentage + '%)';
    
    // Color code based on drop rate
    if (dropRate < 0.02) {
      dropStats.className = 'healthy'; // Green - excellent
    } else if (dropRate < 0.1) {
      dropStats.className = ''; // Orange - acceptable
    } else {
      dropStats.className = ''; // Orange - problematic
      dropStats.style.color = '#ff6b6b'; // Red
    }
    
    frameCount = 0;
    fpsUpdateTime = now;
  }
}

// Fetch and display frames
let lastFrameData = null;

function renderFrame() {
  if (renderInProgress || isPaused) return;
  
  // Check for pending frame from background
  if (!pendingFrame) {
    // No frame yet, wait and try again
    requestAnimationFrame(renderFrame);
    return;
  }
  
  renderInProgress = true;
  lastFrameData = pendingFrame;
  const frameToDisplay = pendingFrame;
  pendingFrame = null;
  
  const img = new Image();
  img.onload = () => {
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (displayMode === 'fit') {
      // Fit with aspect ratio
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      const x = (canvas.width - img.width * scale) / 2;
      const y = (canvas.height - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
    } else {
      // Fill (stretch)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    
    frameCount++;
    lastFrameTime = performance.now();
    lastDisplayedFrameNumber++;
    
    // Hide loading on first frame
    if (frameCount === 1) {
      loading.classList.add('hidden');
    }
    
    updateFPS();
    renderInProgress = false;
    
    // Check for excessive frame drops and adapt quality
    const dropRate = droppedFrames / Math.max(totalFramesReceived, 1);
    if (dropRate > 0.1 && currentQuality > 0.5) {
      // If dropping more than 10% of frames, reduce quality
      currentQuality = Math.max(currentQuality - 0.05, 0.5);
      qualitySelect.value = currentQuality;
      console.warn('[Mirror] Frame drop rate high:', (dropRate * 100).toFixed(1) + '%. Reducing quality to', (currentQuality * 100).toFixed(0) + '%');
    }
    
    // Continue rendering next frame
    requestAnimationFrame(renderFrame);
  };
  
  img.onerror = () => {
    console.error('[Mirror Display] Failed to load frame image');
    renderInProgress = false;
    requestAnimationFrame(renderFrame);
  };
  
  img.src = 'data:image/jpeg;base64,' + frameToDisplay;
}

// Start rendering
renderFrame();

// Check streaming status and update UI
setInterval(() => {
  chrome.runtime.sendMessage({ action: 'isStreaming' }, (response) => {
    if (!response || !response.streaming) {
      if (isReceivingFrames) {
        isReceivingFrames = false;
        castingStatus.textContent = 'Stream Ended';
        castingStatus.style.color = '#ff6b6b';
        loading.classList.remove('hidden');
        loading.textContent = 'Stream ended';
      }
    }
  });
}, 5000);

// Handle fullscreen changes
document.addEventListener('fullscreenchange', () => {
  resizeCanvas();
  if (!document.fullscreenElement) {
    fullscreenBtn.textContent = '⛶ Fullscreen';
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') {
    fullscreenBtn.click();
  } else if (e.key === ' ') {
    e.preventDefault();
    pauseBtn.click();
  } else if (e.key === 'Escape' && document.fullscreenElement) {
    document.exitFullscreen();
  }
});


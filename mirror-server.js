// Server-side Mirror Display - Receives and displays frames over HTTP

const canvas = document.getElementById('display');
const ctx = canvas.getContext('2d');
const loading = document.getElementById('loading');
const controls = document.getElementById('controls');
const infoPanel = document.getElementById('info-panel');
const pauseBtn = document.getElementById('pauseBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const fitBtn = document.getElementById('fitBtn');
const fillBtn = document.getElementById('fillBtn');
const qualitySelect = document.getElementById('quality');
const fpsValue = document.getElementById('fpsValue');
const statusSpan = document.getElementById('status');

let isPaused = false;
let currentQuality = 0.90;
let frameCount = 0;
let lastFrameTime = 0;
let fpsUpdateTime = 0;
let displayMode = 'fit'; // 'fit' or 'fill'
let isConnected = false;
let frameBuffer = null;
let pollInterval = null;

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

// Show/hide info panel
document.addEventListener('keydown', (e) => {
  if (e.key === 'i' || e.key === 'I') {
    infoPanel.classList.toggle('show');
  }
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
    document.getElementById('fps').textContent = frameCount;
    frameCount = 0;
    fpsUpdateTime = now;
  }
}

// Draw frame on canvas
function drawFrame(imageBitmap) {
  if (isPaused || !imageBitmap) return;
  
  try {
    if (displayMode === 'fit') {
      // Preserve aspect ratio
      const imgAspect = imageBitmap.width / imageBitmap.height;
      const canvasAspect = canvas.width / canvas.height;
      
      let drawWidth, drawHeight, offsetX, offsetY;
      
      if (imgAspect > canvasAspect) {
        // Image is wider
        drawWidth = canvas.width;
        drawHeight = canvas.width / imgAspect;
        offsetX = 0;
        offsetY = (canvas.height - drawHeight) / 2;
      } else {
        // Image is taller
        drawHeight = canvas.height;
        drawWidth = canvas.height * imgAspect;
        offsetX = (canvas.width - drawWidth) / 2;
        offsetY = 0;
      }
      
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imageBitmap, offsetX, offsetY, drawWidth, drawHeight);
    } else {
      // Fill mode - stretch to fill
      ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
    }
    
    frameCount++;
    updateFPS();
  } catch (err) {
    console.error('Error drawing frame:', err);
  }
}

// Fetch frames from background script via SharedWorker or message port
function initFrameChannel() {
  // Try to establish connection with background script
  // Since we're on a different origin, we need to use postMessage via a bridge
  
  // Listen for frames posted from the extension
  window.addEventListener('message', (event) => {
    // Only accept messages from the same window (posted by extension bridge)
    if (event.data.type === 'MIRROR_FRAME') {
      const base64Frame = event.data.frame;
      if (base64Frame) {
        frameBuffer = base64Frame;
      }
    } else if (event.data.type === 'MIRROR_CONNECTED') {
      isConnected = true;
      statusSpan.textContent = 'Connected';
      loading.classList.add('hidden');
    }
  });
  
  // Notify that we're ready to receive frames
  window.parent.postMessage({ type: 'MIRROR_READY' }, '*');
}

// Poll for new frames
function startFramePolling() {
  pollInterval = setInterval(() => {
    if (frameBuffer && !isPaused) {
      const img = new Image();
      img.onload = () => {
        createImageBitmap(img).then(bitmap => {
          drawFrame(bitmap);
        });
      };
      img.src = 'data:image/jpeg;base64,' + frameBuffer;
      frameBuffer = null;
    }
  }, 16); // ~60fps
}

// Initialize
function init() {
  initFrameChannel();
  startFramePolling();
  
  // Set fit as default
  fitBtn.classList.add('active');
  
  // Show connection status
  statusSpan.textContent = 'Initializing...';
  infoPanel.classList.add('show');
  
  setTimeout(() => {
    infoPanel.classList.remove('show');
  }, 5000);
  
  console.log('Mirror server display initialized');
}

// Start on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

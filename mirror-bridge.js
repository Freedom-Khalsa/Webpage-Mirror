// Mirror Tab Bridge Script - Runs on the mirror server page
// This script bridges communication between the background script and the mirror display

console.log('[Mirror Bridge] Script injected on mirror page');

// Store the last frame
let lastFrame = null;

// Listen for frame updates from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Mirror Bridge] Message received:', request.action);
  
  if (request.action === 'displayFrame') {
    // Store frame and post to page
    lastFrame = request.frame;
    // Send frame to the page via postMessage
    window.postMessage({
      type: 'MIRROR_FRAME',
      frame: request.frame
    }, '*');
    sendResponse({ received: true });
  }
});

// Notify background that mirror is ready
window.addEventListener('message', (event) => {
  if (event.data.type === 'MIRROR_READY') {
    console.log('[Mirror Bridge] Page ready signal received, notifying background');
    // Notify background that the mirror page is ready
    chrome.runtime.sendMessage({
      action: 'mirrorReady',
      timestamp: Date.now()
    }).catch(err => console.log('Error notifying background:', err));
    
    // Send connected message to page
    window.postMessage({
      type: 'MIRROR_CONNECTED'
    }, '*');
  }
});

console.log('[Mirror Bridge] Script ready');

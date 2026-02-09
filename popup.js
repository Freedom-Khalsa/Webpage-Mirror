// Popup Script - Handles UI interactions

const openBtn = document.getElementById('openBtn');
const closeBtn = document.getElementById('closeBtn');
const statusDiv = document.getElementById('status');

// Load initial state
chrome.storage.local.get(['mirrorOpen', 'mirrorUrl'], (result) => {
  if (result.mirrorOpen) {
    openBtn.style.display = 'none';
    closeBtn.style.display = 'block';
    if (result.mirrorUrl) {
      statusDiv.textContent = 'Mirror: ' + result.mirrorUrl + '\n\nPoint your Chromecast device to this address!';
      statusDiv.style.wordBreak = 'break-all';
      statusDiv.style.fontSize = '12px';
    } else {
      statusDiv.textContent = 'Mirror window is open';
    }
  }
});

// Open mirror window
openBtn.addEventListener('click', () => {
  statusDiv.textContent = 'Opening...';
  openBtn.disabled = true;
  
  // Get current tab ID first
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (!tabId) {
      statusDiv.textContent = 'Error: No active tab found';
      openBtn.disabled = false;
      return;
    }
    
    // Send message with tab ID
    chrome.runtime.sendMessage({ action: 'openMirror', tabId: tabId }, (response) => {
      if (chrome.runtime.lastError) {
        statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
        openBtn.disabled = false;
        return;
      }
      
      if (response && response.success) {
        openBtn.style.display = 'none';
        closeBtn.style.display = 'block';
        statusDiv.textContent = 'Mirror window opened!\n\nMirroring content from source tab.';
        statusDiv.style.fontSize = '12px';
        chrome.storage.local.set({ mirrorOpen: true });
      } else {
        statusDiv.textContent = response?.error || 'Error opening mirror';
        openBtn.disabled = false;
      }
    });
  });
});

// Close mirror window
closeBtn.addEventListener('click', () => {
  statusDiv.textContent = 'Closing...';
  closeBtn.disabled = true;
  
  chrome.runtime.sendMessage({ action: 'closeMirror' }, () => {
    openBtn.style.display = 'block';
    closeBtn.style.display = 'none';
    statusDiv.textContent = 'Mirror closed';
    chrome.storage.local.set({ mirrorOpen: false });
    closeBtn.disabled = false;
  });
});

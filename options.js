// options.js
// Settings page logic for AEM QuickLinks Extension

const DEFAULT_AUTHOR_PORT = '4502';
const DEFAULT_PUBLISH_PORT = '4503';

/**
 * Gets port settings from storage with defaults
 * @returns {Promise<{authorPort: string, publishPort: string}>}
 */
export async function getPortSettings() {
  return new Promise((resolve) => {
    // Check if chrome API is available
    if (typeof chrome === 'undefined' || !chrome?.storage?.sync) {
      resolve({
        authorPort: DEFAULT_AUTHOR_PORT,
        publishPort: DEFAULT_PUBLISH_PORT
      });
      return;
    }

    try {
      chrome.storage.sync.get(['authorPort', 'publishPort'], (result) => {
        if (chrome.runtime?.lastError) {
          console.warn('Error getting settings:', chrome.runtime.lastError);
          resolve({
            authorPort: DEFAULT_AUTHOR_PORT,
            publishPort: DEFAULT_PUBLISH_PORT
          });
          return;
        }

        resolve({
          authorPort: result.authorPort || DEFAULT_AUTHOR_PORT,
          publishPort: result.publishPort || DEFAULT_PUBLISH_PORT
        });
      });
    } catch (error) {
      console.warn('Error accessing storage:', error);
      resolve({
        authorPort: DEFAULT_AUTHOR_PORT,
        publishPort: DEFAULT_PUBLISH_PORT
      });
    }
  });
}

/**
 * Saves port settings to storage
 * @param {string} authorPort
 * @param {string} publishPort
 * @returns {Promise<void>}
 */
export async function savePortSettings(authorPort, publishPort) {
  // Normalize empty strings to defaults
  const normalizedAuthor = authorPort.trim() || DEFAULT_AUTHOR_PORT;
  const normalizedPublish = publishPort.trim() || DEFAULT_PUBLISH_PORT;

  return new Promise((resolve, reject) => {
    // Check if chrome API is available
    if (typeof chrome === 'undefined' || !chrome?.storage?.sync) {
      reject(new Error('Chrome storage API not available'));
      return;
    }

    try {
      chrome.storage.sync.set({
        authorPort: normalizedAuthor,
        publishPort: normalizedPublish
      }, () => {
        if (chrome.runtime?.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Validates port number
 * @param {string} port
 * @returns {boolean}
 */
function isValidPort(port) {
  if (!port.trim()) return true; // Empty is valid (will use default)
  const num = parseInt(port, 10);
  return !isNaN(num) && num > 0 && num <= 65535;
}

/**
 * Shows a message to the user
 * @param {string} text
 * @param {string} type - 'success' or 'error'
 */
function showMessage(text, type = 'success') {
  const messageEl = document.getElementById('message');
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.style.display = 'block';

  // Hide message after 3 seconds
  setTimeout(() => {
    messageEl.style.display = 'none';
  }, 3000);
}

/**
 * Loads settings and populates form
 */
async function loadSettings() {
  const settings = await getPortSettings();
  document.getElementById('authorPort').value = settings.authorPort === DEFAULT_AUTHOR_PORT ? '' : settings.authorPort;
  document.getElementById('publishPort').value = settings.publishPort === DEFAULT_PUBLISH_PORT ? '' : settings.publishPort;
}

/**
 * Handles form submission
 */
async function handleSave(e) {
  e.preventDefault();

  const authorPort = document.getElementById('authorPort').value;
  const publishPort = document.getElementById('publishPort').value;

  // Validate ports
  if (!isValidPort(authorPort)) {
    showMessage('Invalid author port. Please enter a number between 1 and 65535.', 'error');
    return;
  }

  if (!isValidPort(publishPort)) {
    showMessage('Invalid publish port. Please enter a number between 1 and 65535.', 'error');
    return;
  }

  try {
    await savePortSettings(authorPort, publishPort);
    showMessage('Settings saved successfully!', 'success');

    // Update display to show actual saved values
    await loadSettings();
  } catch (error) {
    showMessage('Error saving settings. Please try again.', 'error');
    console.error('Save error:', error);
  }
}

/**
 * Resets settings to defaults
 */
async function handleReset() {
  try {
    await savePortSettings(DEFAULT_AUTHOR_PORT, DEFAULT_PUBLISH_PORT);
    document.getElementById('authorPort').value = '';
    document.getElementById('publishPort').value = '';
    showMessage('Settings reset to defaults (4502/4503)', 'success');
  } catch (error) {
    showMessage('Error resetting settings. Please try again.', 'error');
    console.error('Reset error:', error);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Load current settings
  loadSettings();

  // Set up event listeners
  document.getElementById('settingsForm').addEventListener('submit', handleSave);
  document.getElementById('resetBtn').addEventListener('click', handleReset);

  // Add input validation
  const inputs = document.querySelectorAll('input[type="text"]');
  inputs.forEach(input => {
    input.addEventListener('input', (e) => {
      // Only allow numbers
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
  });
});

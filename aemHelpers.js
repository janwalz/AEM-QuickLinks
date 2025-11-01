// aemHelpers.js
// Utility functions for AEM Chrome extension

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
        // Check for errors
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
 * Shows a message in the popup message area.
 * @param {string} text - Message to display
 * @param {boolean} isError - Whether this is an error message
 * @returns {boolean} - Returns true if it's an error message
 */
export function showMessage(text, isError = false) {
  const msg = document.getElementById('message');
  if (msg) {
    if (text) {
      msg.textContent = text;
      msg.classList.add('mint');
      // Detect error messages if not explicitly specified
      if (!isError) {
        isError = text.toLowerCase().includes('error') ||
                  text.toLowerCase().includes('not an aem') ||
                  text.toLowerCase().includes('no content');
      }
    } else {
      msg.textContent = '';
      msg.classList.remove('mint');
    }
  }
  return isError;
}

/**
 * Checks if the given URL is an AEM Cloud or localhost instance.
 * @param {string} url
 * @returns {boolean}
 */
export function isCloudOrLocalhost(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
    const authorPattern = /^author-p\w+-e\w+\.adobeaemcloud\.com$/;
    const publishPattern = /^publish-p\w+-e\w+\.adobeaemcloud\.com$/;
    if (authorPattern.test(u.hostname) || publishPattern.test(u.hostname)) return true;
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Extracts the content path from an AEM URL, handling editor, content, and CRXDE deep links.
 * @param {string} url
 * @returns {string|null}
 */
export function getContentPath(url) {
  try {
    const u = new URL(url);
    // Handle /editor.html/content...
    const editorMatch = u.pathname.match(/^\/editor\.html(\/content[^?#]*)/);
    if (editorMatch) {
      return editorMatch[1];
    }
    // Handle /content...
    const contentMatch = u.pathname.match(/^(\/content[^?#]*)/);
    if (contentMatch) {
      return contentMatch[1];
    }
    // Handle CRXDE deep link: /crx/de/index.jsp#/content/page
    if (u.pathname === '/crx/de/index.jsp' && u.hash.startsWith('#/')) {
      const hashPath = u.hash.slice(1); // remove '#' to get '/content/page'
      return hashPath + '.html';
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Determines if the URL is author or publish system.
 * @param {string} url
 * @param {object} [settings] - Optional port settings {authorPort, publishPort}
 * @returns {'author'|'publish'|null}
 */
export function getAemSystemType(url, settings = null) {
  try {
    const u = new URL(url);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      // Use configured ports if provided, otherwise use defaults
      const authorPort = settings?.authorPort || DEFAULT_AUTHOR_PORT;
      const publishPort = settings?.publishPort || DEFAULT_PUBLISH_PORT;

      if (u.port === authorPort) return 'author';
      if (u.port === publishPort) return 'publish';
      return null;
    }
    const authorPattern = /^author-p\w+-e\w+\.adobeaemcloud\.com$/;
    const publishPattern = /^publish-p\w+-e\w+\.adobeaemcloud\.com$/;
    if (authorPattern.test(u.hostname)) return 'author';
    if (publishPattern.test(u.hostname)) return 'publish';
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Opens an AEM tool in a new tab, using the current tab's context.
 * @param {string} path - Path to open
 * @param {string} port - Port to use
 * @param {string} message - Message to show
 */
export function openAemTool(path, port, message) {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    const tab = tabs[0];
    if (!tab?.url || !isCloudOrLocalhost(tab.url)) {
      showMessage('Error: Not an AEM or localhost URL!', true);
      return;
    }
    let baseUrl = `http://localhost:${port}`;
    try {
      const u = new URL(tab.url);
      baseUrl = `${u.protocol}//${u.hostname}:${port}`;
    } catch (e) {}
    chrome.tabs.create({ url: `${baseUrl}${path}` });
    showMessage(message, false);
    // Close popup after successful action
    setTimeout(() => window.close(), 100);
  });
}

/**
 * Runs callback with a valid AEM tab, or shows error.
 * @param {(tab: object) => void} callback
 */
export function withValidAemTab(callback) {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    const tab = tabs[0];
    if (!tab?.url || !isCloudOrLocalhost(tab.url)) {
      showMessage('Error: Not an AEM or localhost URL!', true);
      return;
    }
    callback(tab);
  });
}

/**
 * Gets content path and runs callback, or shows error.
 * @param {object} tab
 * @param {(contentPath: string) => void} onSuccess
 * @param {string} [onError]
 */
export function getValidContentPath(tab, onSuccess, onError) {
  const contentPath = getContentPath(tab.url);
  if (contentPath) {
    onSuccess(contentPath);
  } else {
    showMessage(onError || 'No content page detected!', true);
  }
}

// Legacy constants for backward compatibility (kept for tests)
export const PORT_AUTHOR = DEFAULT_AUTHOR_PORT;
export const PORT_PUBLISH = DEFAULT_PUBLISH_PORT;

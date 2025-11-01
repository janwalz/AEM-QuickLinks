// aemHelpers.js
// Utility functions for AEM Chrome extension

const DEFAULT_AUTHOR_PORT = '4502';
const DEFAULT_PUBLISH_PORT = '4503';

/**
 * Gets all projects from storage
 * @returns {Promise<Array>}
 */
export async function getProjects() {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome?.storage?.sync) {
      resolve([]);
      return;
    }

    try {
      chrome.storage.sync.get(['projects'], (result) => {
        if (chrome.runtime?.lastError) {
          console.warn('Error getting projects:', chrome.runtime.lastError);
          resolve([]);
          return;
        }

        resolve(result.projects || []);
      });
    } catch (error) {
      console.warn('Error accessing storage:', error);
      resolve([]);
    }
  });
}

/**
 * Matches a URL to a project based on pattern and port
 * @param {string} url - Current URL
 * @param {Array} projects - List of projects
 * @returns {object|null} - Matched project or null
 */
export function matchUrlToProject(url, projects) {
  if (!url || !projects || projects.length === 0) {
    return null;
  }

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const port = urlObj.port;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

    // Find matching project
    for (const project of projects) {
      if (matchesPattern(hostname, project.pattern)) {
        // For localhost/127.0.0.1, also check if port matches author or publish port
        if (isLocalhost && port) {
          const authorPort = project.authorPort || DEFAULT_AUTHOR_PORT;
          const publishPort = project.publishPort || DEFAULT_PUBLISH_PORT;

          // Port must match either author or publish port for this project
          if (port === authorPort || port === publishPort) {
            return project;
          }
          // Skip this project if port doesn't match
          continue;
        }

        // For non-localhost or localhost without port, hostname match is enough
        return project;
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Checks if a hostname matches a pattern (supports * wildcard)
 * @param {string} hostname
 * @param {string} pattern
 * @returns {boolean}
 */
function matchesPattern(hostname, pattern) {
  // Convert pattern to regex
  // * matches any characters except dots
  // *.example.com matches subdomain.example.com but not example.com
  // example.com matches exactly example.com
  const regexPattern = pattern
    .replace(/\./g, '\\.')  // Escape dots
    .replace(/\*/g, '[^.]+'); // * matches one or more non-dot characters

  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(hostname);
}

/**
 * Gets settings for the current URL with project-based config
 * @param {string} [currentUrl] - Optional URL to match (defaults to current tab)
 * @returns {Promise<{authorPort: string, publishPort: string, dispatcherUrl: string}>}
 */
export async function getPortSettings(currentUrl = null) {
  const projects = await getProjects();

  // If URL provided, match to project
  if (currentUrl) {
    const project = matchUrlToProject(currentUrl, projects);
    if (project) {
      return {
        authorPort: project.authorPort || DEFAULT_AUTHOR_PORT,
        publishPort: project.publishPort || DEFAULT_PUBLISH_PORT,
        dispatcherUrl: project.dispatcherUrl || ''
      };
    }
  }

  // No match, return defaults
  return {
    authorPort: DEFAULT_AUTHOR_PORT,
    publishPort: DEFAULT_PUBLISH_PORT,
    dispatcherUrl: ''
  };
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

/**
 * Opens dispatcher URL, showing error with settings link if not configured
 * @param {string} dispatcherUrl - Base dispatcher URL
 * @param {string} [path] - Optional path to append
 */
export function openDispatcher(dispatcherUrl, path = '') {
  if (!dispatcherUrl || !dispatcherUrl.trim()) {
    showDispatcherNotConfiguredError();
    return;
  }

  // Remove trailing slash from dispatcher URL
  const baseUrl = dispatcherUrl.replace(/\/$/, '');
  const fullUrl = path ? `${baseUrl}${path}` : baseUrl;

  chrome.tabs.create({ url: fullUrl });
  showMessage('Opening dispatcher...', false);
  setTimeout(() => window.close(), 100);
}

/**
 * Shows error message with link to settings when dispatcher is not configured
 */
function showDispatcherNotConfiguredError() {
  const msg = document.getElementById('message');
  if (msg) {
    msg.innerHTML = 'Dispatcher URL not configured. <a href="#" id="openSettings" style="color: #667eea; text-decoration: underline;">Open Settings</a>';
    msg.classList.add('mint');

    // Add click handler for settings link
    const settingsLink = document.getElementById('openSettings');
    if (settingsLink) {
      settingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
      });
    }
  }
}

// Legacy constants for backward compatibility (kept for tests)
export const PORT_AUTHOR = DEFAULT_AUTHOR_PORT;
export const PORT_PUBLISH = DEFAULT_PUBLISH_PORT;

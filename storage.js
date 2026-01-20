// storage.js
// Shared storage functions for AEM QuickLinks Extension

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
 * Saves projects to storage
 * @param {Array} projects
 * @returns {Promise<void>}
 */
export async function saveProjects(projects) {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome?.storage?.sync) {
      reject(new Error('Chrome storage API not available'));
      return;
    }

    try {
      chrome.storage.sync.set({ projects }, () => {
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

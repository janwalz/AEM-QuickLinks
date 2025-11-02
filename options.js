// options.js
// Settings page logic for AEM QuickLinks Extension - Multi-Project Support

const DEFAULT_AUTHOR_PORT = '4502';
const DEFAULT_PUBLISH_PORT = '4503';

/**
 * Project data structure:
 * {
 *   id: string (unique),
 *   name: string,
 *   pattern: string (URL pattern with * wildcard),
 *   authorPort: string,
 *   publishPort: string,
 *   dispatcherUrl: string,
 *   orgId: string (optional - Adobe Organization ID),
 *   programId: string (optional - AEM Cloud Program ID)
 * }
 */

// ===== Storage Functions =====

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

/**
 * Generates a unique ID
 * @returns {string}
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// ===== Validation Functions =====

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
 * Validates URL
 * @param {string} url
 * @returns {boolean}
 */
function isValidUrl(url) {
  if (!url.trim()) return true; // Empty is valid
  try {
    const urlObj = new URL(url);
    return urlObj.protocol.startsWith('http');
  } catch (error) {
    return false;
  }
}

// ===== UI Functions =====

/**
 * Shows a message to the user
 * @param {string} text
 * @param {string} type - 'success' or 'error'
 * @param {string} elementId - ID of message element
 */
function showMessage(text, type = 'success', elementId = 'modalMessage') {
  const messageEl = document.getElementById(elementId);
  if (!messageEl) return;

  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.style.display = 'block';

  // Hide message after 3 seconds
  setTimeout(() => {
    messageEl.style.display = 'none';
  }, 3000);
}

/**
 * Renders the projects list
 * @param {Array} projects
 */
function renderProjects(projects) {
  const projectsList = document.getElementById('projectsList');
  const emptyState = document.getElementById('emptyState');

  if (!projects || projects.length === 0) {
    projectsList.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  projectsList.innerHTML = projects.map(project => `
    <div class="project-card" data-id="${project.id}">
      <div class="project-header">
        <div>
          <div class="project-title">${escapeHtml(project.name)}</div>
          <div class="project-pattern">${escapeHtml(project.pattern)}</div>
        </div>
        <div class="project-actions">
          <button class="btn-icon edit" data-id="${project.id}" title="Edit">
            ✏️ Edit
          </button>
          <button class="btn-icon delete" data-id="${project.id}" title="Delete">
            🗑️ Delete
          </button>
        </div>
      </div>
      <div class="project-details">
        <div class="project-detail">
          <strong>Author:</strong> ${project.authorPort || DEFAULT_AUTHOR_PORT}
        </div>
        <div class="project-detail">
          <strong>Publish:</strong> ${project.publishPort || DEFAULT_PUBLISH_PORT}
        </div>
        <div class="project-detail">
          <strong>Dispatcher:</strong> ${project.dispatcherUrl ? escapeHtml(project.dispatcherUrl) : 'Not set'}
        </div>
        ${project.orgId ? `<div class="project-detail">
          <strong>Org ID:</strong> ${escapeHtml(project.orgId)}
        </div>` : ''}
        ${project.programId ? `<div class="project-detail">
          <strong>Program ID:</strong> ${escapeHtml(project.programId)}
        </div>` : ''}
      </div>
    </div>
  `).join('');

  // Add event listeners
  projectsList.querySelectorAll('.edit').forEach(btn => {
    btn.addEventListener('click', () => editProject(btn.dataset.id));
  });

  projectsList.querySelectorAll('.delete').forEach(btn => {
    btn.addEventListener('click', () => deleteProject(btn.dataset.id));
  });
}

/**
 * Escapes HTML to prevent XSS
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Opens the modal to add a new project
 */
function openAddModal() {
  document.getElementById('modalTitle').textContent = 'Add Project';
  document.getElementById('projectId').value = '';
  document.getElementById('projectForm').reset();
  document.getElementById('projectModal').style.display = 'flex';
  document.getElementById('projectName').focus();
}

/**
 * Opens the modal to edit a project
 * @param {string} projectId
 */
async function editProject(projectId) {
  const projects = await getProjects();
  const project = projects.find(p => p.id === projectId);

  if (!project) return;

  document.getElementById('modalTitle').textContent = 'Edit Project';
  document.getElementById('projectId').value = project.id;
  document.getElementById('projectName').value = project.name;
  document.getElementById('projectPattern').value = project.pattern;
  document.getElementById('authorPort').value = project.authorPort === DEFAULT_AUTHOR_PORT ? '' : project.authorPort;
  document.getElementById('publishPort').value = project.publishPort === DEFAULT_PUBLISH_PORT ? '' : project.publishPort;
  document.getElementById('dispatcherUrl').value = project.dispatcherUrl || '';
  document.getElementById('orgId').value = project.orgId || '';
  document.getElementById('programId').value = project.programId || '';

  document.getElementById('projectModal').style.display = 'flex';
  document.getElementById('projectName').focus();
}

/**
 * Deletes a project
 * @param {string} projectId
 */
async function deleteProject(projectId) {
  if (!confirm('Are you sure you want to delete this project?')) {
    return;
  }

  try {
    const projects = await getProjects();
    const filtered = projects.filter(p => p.id !== projectId);
    await saveProjects(filtered);
    renderProjects(filtered);
  } catch (error) {
    alert('Error deleting project. Please try again.');
    console.error('Delete error:', error);
  }
}

/**
 * Closes the modal
 */
function closeModal() {
  document.getElementById('projectModal').style.display = 'none';
  document.getElementById('projectForm').reset();
  document.getElementById('modalMessage').style.display = 'none';
}

/**
 * Handles project form submission
 * @param {Event} e
 */
async function handleProjectSubmit(e) {
  e.preventDefault();

  const projectId = document.getElementById('projectId').value;
  const projectName = document.getElementById('projectName').value.trim();
  const projectPattern = document.getElementById('projectPattern').value.trim();
  const authorPort = document.getElementById('authorPort').value.trim();
  const publishPort = document.getElementById('publishPort').value.trim();
  const dispatcherUrl = document.getElementById('dispatcherUrl').value.trim();
  const orgId = document.getElementById('orgId').value.trim();
  const programId = document.getElementById('programId').value.trim();

  // Validate inputs
  if (!projectName) {
    showMessage('Project name is required', 'error');
    return;
  }

  if (!projectPattern) {
    showMessage('URL pattern is required', 'error');
    return;
  }

  if (!isValidPort(authorPort)) {
    showMessage('Invalid author port. Please enter a number between 1 and 65535.', 'error');
    return;
  }

  if (!isValidPort(publishPort)) {
    showMessage('Invalid publish port. Please enter a number between 1 and 65535.', 'error');
    return;
  }

  if (dispatcherUrl && !isValidUrl(dispatcherUrl)) {
    showMessage('Invalid dispatcher URL. Please enter a valid URL.', 'error');
    return;
  }

  try {
    const projects = await getProjects();

    const project = {
      id: projectId || generateId(),
      name: projectName,
      pattern: projectPattern,
      authorPort: authorPort || DEFAULT_AUTHOR_PORT,
      publishPort: publishPort || DEFAULT_PUBLISH_PORT,
      dispatcherUrl: dispatcherUrl,
      orgId: orgId,
      programId: programId
    };

    if (projectId) {
      // Update existing
      const index = projects.findIndex(p => p.id === projectId);
      if (index !== -1) {
        projects[index] = project;
      }
    } else {
      // Add new
      projects.push(project);
    }

    await saveProjects(projects);
    renderProjects(projects);
    closeModal();
  } catch (error) {
    showMessage('Error saving project. Please try again.', 'error');
    console.error('Save error:', error);
  }
}

// ===== Initialization =====

document.addEventListener('DOMContentLoaded', async () => {
  // Load and render projects
  const projects = await getProjects();
  renderProjects(projects);

  // Event listeners
  document.getElementById('addProjectBtn').addEventListener('click', openAddModal);
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('projectForm').addEventListener('submit', handleProjectSubmit);

  // Close modal when clicking outside
  document.getElementById('projectModal').addEventListener('click', (e) => {
    if (e.target.id === 'projectModal') {
      closeModal();
    }
  });

  // Only allow numbers in port fields
  const portInputs = document.querySelectorAll('#authorPort, #publishPort');
  portInputs.forEach(input => {
    input.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
  });
});

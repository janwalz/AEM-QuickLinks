// options.js
// Settings page logic for AEM QuickLinks Extension - Multi-Project Support

import { getProjects, saveProjects } from './storage.js';

const DEFAULT_AUTHOR_PORT = '4502';
const DEFAULT_PUBLISH_PORT = '4503';

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
    <div class="project-card ${project.isFallback ? 'fallback' : ''}" data-id="${project.id}" draggable="true">
      <div class="project-header">
        <div class="drag-handle" title="Drag to reorder">☰</div>
        <div>
          <div class="project-title">
            ${escapeHtml(project.name)}
            ${project.isFallback ? '<span class="fallback-badge">Fallback</span>' : ''}
          </div>
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
      <div class="project-footer">
        <label class="checkbox-label">
          <input type="checkbox" class="fallback-checkbox" data-id="${project.id}" ${project.isFallback ? 'checked' : ''}>
          <span>Use as fallback when not on AEM</span>
        </label>
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

  // Add fallback checkbox listeners
  projectsList.querySelectorAll('.fallback-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => toggleFallback(e.target.dataset.id, e.target.checked));
  });

  // Add drag and drop listeners
  setupDragAndDrop();
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
 * Toggles the fallback flag for a project
 * @param {string} projectId
 * @param {boolean} isFallback
 */
async function toggleFallback(projectId, isFallback) {
  try {
    const projects = await getProjects();

    // If setting as fallback, unset any other fallback projects
    if (isFallback) {
      projects.forEach(p => {
        if (p.id !== projectId) {
          p.isFallback = false;
        }
      });
    }

    // Update the target project
    const project = projects.find(p => p.id === projectId);
    if (project) {
      project.isFallback = isFallback;
    }

    await saveProjects(projects);
    renderProjects(projects);
  } catch (error) {
    alert('Error updating fallback setting. Please try again.');
    console.error('Fallback toggle error:', error);
  }
}

/**
 * Sets up drag and drop functionality for project cards
 */
function setupDragAndDrop() {
  const projectsList = document.getElementById('projectsList');
  let draggedElement = null;

  const cards = projectsList.querySelectorAll('.project-card');

  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      draggedElement = card;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      draggedElement = null;
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (draggedElement && draggedElement !== card) {
        const bounding = card.getBoundingClientRect();
        const offset = bounding.y + bounding.height / 2;

        if (e.clientY - offset > 0) {
          card.style.borderBottom = '2px solid #667eea';
          card.style.borderTop = '';
        } else {
          card.style.borderTop = '2px solid #667eea';
          card.style.borderBottom = '';
        }
      }
    });

    card.addEventListener('dragleave', () => {
      card.style.borderTop = '';
      card.style.borderBottom = '';
    });

    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      card.style.borderTop = '';
      card.style.borderBottom = '';

      if (draggedElement && draggedElement !== card) {
        const projects = await getProjects();
        const draggedId = draggedElement.dataset.id;
        const targetId = card.dataset.id;

        const draggedIndex = projects.findIndex(p => p.id === draggedId);
        const targetIndex = projects.findIndex(p => p.id === targetId);

        if (draggedIndex !== -1 && targetIndex !== -1) {
          // Remove dragged item
          const [draggedItem] = projects.splice(draggedIndex, 1);

          // Insert at new position
          const newTargetIndex = projects.findIndex(p => p.id === targetId);
          projects.splice(newTargetIndex, 0, draggedItem);

          await saveProjects(projects);
          renderProjects(projects);
        }
      }
    });
  });
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

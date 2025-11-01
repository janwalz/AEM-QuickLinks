import {
  showMessage,
  getAemSystemType,
  openAemTool,
  withValidAemTab,
  getValidContentPath,
  getContentPath,
  getPortSettings
} from './aemHelpers.js';

// --- UI State Manager ---
class PopupState {
  constructor() {
    this.currentMenu = 'main';
    this.filteredButtons = [];
    this.selectedIndex = -1;
  }

  setMenu(menu) {
    this.currentMenu = menu;
  }

  setFilteredButtons(buttons) {
    this.filteredButtons = buttons;
  }

  setSelectedIndex(index) {
    this.selectedIndex = index;
  }

  getFilteredButtons() {
    return this.filteredButtons;
  }

  getSelectedIndex() {
    return this.selectedIndex;
  }

  isMainMenu() {
    return this.currentMenu === 'main';
  }

  isSubmenu() {
    return this.currentMenu === 'submenu';
  }
}

// --- Button Action Handlers ---
const BUTTON_HANDLERS = {
  btnCrxde: async () => {
    const settings = await getPortSettings();
    openAemTool('/crx/de', settings.authorPort, 'Opening CRXDE...');
  },

  btnCrxdeCurrent: async () => {
    const settings = await getPortSettings();
    withValidAemTab(tab => {
      const contentPath = getContentPath(tab.url);
      if (contentPath) {
        // Open CRXDE with current page path
        const cleanPath = contentPath.replace(/\.[^./?#]+(\.[^./?#]+)?$/, '');
        const crxdeHash = '#/' + cleanPath.replace(/^\//, '');
        openAemTool('/crx/de/index.jsp' + crxdeHash, settings.authorPort, 'Opening CRXDE for current page...');
      } else {
        // Fall back to standard CRXDE if no content page detected
        openAemTool('/crx/de', settings.authorPort, 'Opening CRXDE...');
      }
    });
  },

  btnOpenPublish: async () => {
    const settings = await getPortSettings();
    withValidAemTab(tab => {
      const systemType = getAemSystemType(tab.url, settings);
      if (!systemType) {
        showMessage('Not an AEM or localhost URL!', true);
        return;
      }
      getValidContentPath(tab, contentPath => {
        let publishPort = new URL(tab.url).port;
        if (systemType === 'author') {
          if (['localhost', '127.0.0.1'].includes(new URL(tab.url).hostname)) {
            publishPort = settings.publishPort;
          }
        }
        openAemTool(contentPath, publishPort || settings.publishPort, 'Opening publish for current page...');
      });
    });
  },

  btnOpenAuthor: async () => {
    const settings = await getPortSettings();
    withValidAemTab(tab => {
      const systemType = getAemSystemType(tab.url, settings);
      if (!systemType) {
        showMessage('Not an AEM or localhost URL!', true);
        return;
      }
      getValidContentPath(tab, contentPath => {
        let authorPort = new URL(tab.url).port;
        if (systemType === 'publish') {
          if (['localhost', '127.0.0.1'].includes(new URL(tab.url).hostname)) {
            authorPort = settings.authorPort;
          }
        }
        openAemTool(contentPath, authorPort || settings.authorPort, 'Opening author for current page...');
      });
    });
  },

  btnEditView: async () => {
    const settings = await getPortSettings();
    withValidAemTab(tab => {
      getValidContentPath(tab, contentPath => {
        openAemTool('/editor.html' + contentPath, settings.authorPort, 'Opening edit view for current page...');
      });
    });
  },

  btnPackMgr: async () => {
    const settings = await getPortSettings();
    openAemTool('/crx/packmgr', settings.authorPort, 'Opening Package Manager...');
  },

  btnReplicationAgent: async () => {
    const settings = await getPortSettings();
    openAemTool('/etc/replication/agents.author/publish.html', settings.authorPort, 'Opening Replication Default Agent...');
  },

  btnLoginPublish: async () => {
    const settings = await getPortSettings();
    openAemTool('/libs/granite/core/content/login.html', settings.publishPort, 'Opening Login on Publish...');
  },

  btnConfigMgr: async () => {
    const settings = await getPortSettings();
    openAemTool('/system/console/configMgr', settings.authorPort, 'Opening Config Manager...');
  },

  btnGroovyConsole: async () => {
    const settings = await getPortSettings();
    openAemTool('/groovyconsole', settings.authorPort, 'Opening Groovy Console...');
  },

  btnViewAsPublished: async () => {
    const settings = await getPortSettings();
    withValidAemTab(tab => {
      getValidContentPath(tab, contentPath => {
        openAemTool(contentPath + '?wcmmode=disabled', settings.authorPort, 'Opening as published...');
      });
    });
  },

  btnPageProperties: async () => {
    const settings = await getPortSettings();
    withValidAemTab(tab => {
      getValidContentPath(tab, contentPath => {
        // Remove file extension and add /jcr:content.html for page properties
        const pagePath = contentPath.replace(/\.[^./?#]+(\.[^./?#]+)?$/, '');
        openAemTool('/mnt/override/apps/wcm/core/content/sites/properties.html?item=' + pagePath, settings.authorPort, 'Opening page properties...');
      });
    });
  }
};

// --- Menu Navigation Functions ---
function showSubmenu(elements, state) {
  state.setMenu('submenu');
  elements.actionList.style.display = 'none';
  elements.currentPageMenu.style.display = 'block';
}

function showMainMenu(elements, state) {
  state.setMenu('main');
  elements.currentPageMenu.style.display = 'none';
  elements.actionList.style.display = 'block';
}

// --- Selection Management ---
function scrollSelectedIntoView(button) {
  if (button) {
    button.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth'
    });
  }
}

function updateSelection(allButtons, filteredButtons, selectedIndex, state) {
  // Remove selection from all buttons
  allButtons.forEach(btn => btn.classList.remove('selected'));

  if (filteredButtons.length > 0 && selectedIndex >= 0 && selectedIndex < filteredButtons.length) {
    filteredButtons[selectedIndex].classList.add('selected');
    state.setSelectedIndex(selectedIndex);
    scrollSelectedIntoView(filteredButtons[selectedIndex]);
  } else {
    state.setSelectedIndex(-1);
  }
}

function updateSelectionForCurrentMenu(elements, allButtons, state) {
  const filteredBtns = state.isMainMenu() ? elements.buttons : elements.submenuButtons;
  const visibleBtns = filteredBtns.filter(btn => btn.style.display !== 'none');

  // Remove selection from all buttons
  allButtons.forEach(btn => btn.classList.remove('selected'));

  if (visibleBtns.length > 0) {
    visibleBtns[0].classList.add('selected');
    state.setSelectedIndex(0);
    state.setFilteredButtons(visibleBtns);
  } else {
    state.setSelectedIndex(-1);
    state.setFilteredButtons([]);
  }
}

// --- Search/Filter Logic ---
function handleSearch(searchValue, elements, allButtons, state) {
  const val = searchValue.trim().toLowerCase();
  let mainVisible = 0;
  let subVisible = 0;

  // Search main menu
  elements.buttons.forEach(btn => {
    if (btn.id === 'btnCurrentPageMenu') {
      btn.style.display = val ? 'none' : '';
      return;
    }
    const text = btn.textContent.toLowerCase();
    if (text.includes(val)) {
      btn.style.display = '';
      mainVisible++;
    } else {
      btn.style.display = 'none';
    }
  });

  // Search submenu - hide back button when searching
  elements.submenuButtons.forEach(btn => {
    if (btn.id === 'btnGoBack') {
      btn.style.display = val ? 'none' : '';
      return;
    }
    const text = btn.textContent.toLowerCase();
    if (text.includes(val)) {
      btn.style.display = '';
      subVisible++;
    } else {
      btn.style.display = 'none';
    }
  });

  // Show/hide menus based on matches
  if (val) {
    if (subVisible > 0 && mainVisible === 0) {
      showSubmenu(elements, state);
    } else if (mainVisible > 0 && subVisible === 0) {
      showMainMenu(elements, state);
    } else if (mainVisible > 0 && subVisible > 0) {
      elements.actionList.style.display = 'block';
      elements.currentPageMenu.style.display = 'block';
    } else {
      elements.actionList.style.display = 'none';
      elements.currentPageMenu.style.display = 'none';
    }
  } else {
    showMainMenu(elements, state);
  }

  // Get all visible action buttons - exclude back button from search results
  let filteredBtns;
  if (val) {
    filteredBtns = [...elements.buttons, ...elements.submenuButtons].filter(btn =>
      btn.style.display !== 'none' && btn.id !== 'btnGoBack'
    );
  } else {
    filteredBtns = [...elements.buttons, ...elements.submenuButtons].filter(btn =>
      btn.style.display !== 'none'
    );
  }

  // Update selection to first filtered button
  updateSelection(allButtons, filteredBtns, filteredBtns.length > 0 ? 0 : -1, state);

  // Store filtered buttons in state
  state.setFilteredButtons(filteredBtns);
}

// --- Keyboard Navigation Handler ---
function handleKeydown(e, elements, allButtons, state) {
  const filteredBtns = state.getFilteredButtons();
  let selectedIndex = state.getSelectedIndex();

  switch(e.key) {
    case 'ArrowDown':
      e.preventDefault();
      if (filteredBtns.length === 0) return;
      selectedIndex = (selectedIndex + 1) % filteredBtns.length;
      updateSelection(allButtons, filteredBtns, selectedIndex, state);
      break;

    case 'ArrowUp':
      e.preventDefault();
      if (filteredBtns.length === 0) return;
      selectedIndex = (selectedIndex - 1 + filteredBtns.length) % filteredBtns.length;
      updateSelection(allButtons, filteredBtns, selectedIndex, state);
      break;

    case 'Enter':
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < filteredBtns.length) {
        const selectedBtn = filteredBtns[selectedIndex];

        // Special handling for Current Page Menu button
        if (selectedBtn.id === 'btnCurrentPageMenu') {
          showSubmenu(elements, state);
          setTimeout(() => {
            updateSelectionForCurrentMenu(elements, allButtons, state);
          }, 10);
        } else {
          selectedBtn.click();
        }
      }
      break;

    case 'Escape':
      e.preventDefault();

      if (state.isSubmenu()) {
        // In submenu, go back to main menu
        showMainMenu(elements, state);
        elements.search.value = '';
        setTimeout(() => {
          handleSearch('', elements, allButtons, state);
        }, 10);
        elements.search.focus();
      } else if (elements.search.value.trim()) {
        // In search mode, reset to default
        elements.search.value = '';
        showMainMenu(elements, state);
        setTimeout(() => {
          handleSearch('', elements, allButtons, state);
        }, 10);
        elements.search.focus();
      } else {
        // In default mode, close popup
        window.close();
      }
      break;

    case 'Home':
      e.preventDefault();
      if (filteredBtns.length === 0) return;
      updateSelection(allButtons, filteredBtns, 0, state);
      break;

    case 'End':
      e.preventDefault();
      if (filteredBtns.length === 0) return;
      updateSelection(allButtons, filteredBtns, filteredBtns.length - 1, state);
      break;

    case 'PageDown':
      e.preventDefault();
      if (filteredBtns.length === 0) return;
      selectedIndex = Math.min(selectedIndex + 5, filteredBtns.length - 1);
      updateSelection(allButtons, filteredBtns, selectedIndex, state);
      break;

    case 'PageUp':
      e.preventDefault();
      if (filteredBtns.length === 0) return;
      selectedIndex = Math.max(selectedIndex - 5, 0);
      updateSelection(allButtons, filteredBtns, selectedIndex, state);
      break;
  }
}

// --- Button Click Handler ---
function addButtonListener(buttonId, handler) {
  const btn = document.getElementById(buttonId);
  if (btn) {
    btn.addEventListener('click', () => {
      handler();
      // Popup closing is now handled by individual action handlers
      // This allows errors to be displayed without the popup closing
    });
  }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  // Initialize state
  const state = new PopupState();

  // Get DOM elements
  const elements = {
    search: document.getElementById('actionSearch'),
    actionList: document.getElementById('actionList'),
    currentPageMenu: document.getElementById('currentPageMenu'),
    btnCurrentPageMenu: document.getElementById('btnCurrentPageMenu'),
    btnGoBack: document.getElementById('btnGoBack'),
    buttons: Array.from(document.getElementById('actionList').querySelectorAll('button')),
    submenuButtons: Array.from(document.getElementById('currentPageMenu').querySelectorAll('button'))
  };

  const allButtons = [...elements.buttons, ...elements.submenuButtons];

  // Focus search input
  elements.search.focus();

  // Submenu navigation
  if (elements.btnCurrentPageMenu) {
    elements.btnCurrentPageMenu.addEventListener('click', (e) => {
      e.preventDefault();
      showSubmenu(elements, state);
      setTimeout(() => {
        updateSelectionForCurrentMenu(elements, allButtons, state);
      }, 10);
    });
  }

  if (elements.btnGoBack) {
    elements.btnGoBack.addEventListener('click', (e) => {
      e.preventDefault();
      showMainMenu(elements, state);
      setTimeout(() => {
        updateSelectionForCurrentMenu(elements, allButtons, state);
      }, 10);
    });
  }

  // Search input handler
  elements.search.addEventListener('input', () => {
    handleSearch(elements.search.value, elements, allButtons, state);
  });

  // Keyboard navigation
  elements.search.addEventListener('keydown', (e) => {
    handleKeydown(e, elements, allButtons, state);
  });

  // Initialize search
  handleSearch('', elements, allButtons, state);

  // Register button action handlers
  Object.keys(BUTTON_HANDLERS).forEach(buttonId => {
    addButtonListener(buttonId, BUTTON_HANDLERS[buttonId]);
  });
});

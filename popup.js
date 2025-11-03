import {
  showMessage,
  getAemSystemType,
  openAemTool,
  withValidAemTab,
  getValidContentPath,
  getContentPath,
  getPortSettings,
  openDispatcher,
  openCloudTool
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

  isCloudMenu() {
    return this.currentMenu === 'cloudmenu';
  }
}

// --- Button Action Handlers ---
const BUTTON_HANDLERS = {
  btnCrxde: async () => {
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      const tab = tabs[0];
      const settings = await getPortSettings(tab?.url);
      openAemTool('/crx/de', settings.authorPort, 'Opening CRXDE...');
    });
  },

  btnCrxdeCurrent: async () => {
    withValidAemTab(async tab => {
      const settings = await getPortSettings(tab.url);
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
    withValidAemTab(async tab => {
      const settings = await getPortSettings(tab.url);
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
    withValidAemTab(async tab => {
      const settings = await getPortSettings(tab.url);
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
    withValidAemTab(async tab => {
      const settings = await getPortSettings(tab.url);
      getValidContentPath(tab, contentPath => {
        openAemTool('/editor.html' + contentPath, settings.authorPort, 'Opening edit view for current page...');
      });
    });
  },

  btnPackMgr: async () => {
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      const tab = tabs[0];
      const settings = await getPortSettings(tab?.url);
      openAemTool('/crx/packmgr', settings.authorPort, 'Opening Package Manager...');
    });
  },

  btnReplicationAgent: async () => {
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      const tab = tabs[0];
      const settings = await getPortSettings(tab?.url);
      openAemTool('/etc/replication/agents.author/publish.html', settings.authorPort, 'Opening Replication Default Agent...');
    });
  },

  btnLoginPublish: async () => {
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      const tab = tabs[0];
      const settings = await getPortSettings(tab?.url);
      openAemTool('/libs/granite/core/content/login.html', settings.publishPort, 'Opening Login on Publish...');
    });
  },

  btnConfigMgr: async () => {
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      const tab = tabs[0];
      const settings = await getPortSettings(tab?.url);
      openAemTool('/system/console/configMgr', settings.authorPort, 'Opening Config Manager...');
    });
  },

  btnGroovyConsole: async () => {
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      const tab = tabs[0];
      const settings = await getPortSettings(tab?.url);
      openAemTool('/groovyconsole', settings.authorPort, 'Opening Groovy Console...');
    });
  },

  btnViewAsPublished: async () => {
    withValidAemTab(async tab => {
      const settings = await getPortSettings(tab.url);
      getValidContentPath(tab, contentPath => {
        openAemTool(contentPath + '?wcmmode=disabled', settings.authorPort, 'Opening as published...');
      });
    });
  },

  btnPageProperties: async () => {
    withValidAemTab(async tab => {
      const settings = await getPortSettings(tab.url);
      getValidContentPath(tab, contentPath => {
        // Remove file extension and add /jcr:content.html for page properties
        const pagePath = contentPath.replace(/\.[^./?#]+(\.[^./?#]+)?$/, '');
        openAemTool('/mnt/override/apps/wcm/core/content/sites/properties.html?item=' + pagePath, settings.authorPort, 'Opening page properties...');
      });
    });
  },

  btnDispatcher: async () => {
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      const tab = tabs[0];
      const settings = await getPortSettings(tab?.url);
      openDispatcher(settings.dispatcherUrl);
    });
  },

  btnDispatcherCurrent: async () => {
    withValidAemTab(async tab => {
      const settings = await getPortSettings(tab.url);
      getValidContentPath(tab, contentPath => {
        openDispatcher(settings.dispatcherUrl, contentPath);
      }, 'No content page detected!');
    });
  },

  btnCloudOverview: async () => {
    openCloudTool('home', 'Opening Cloud Manager Home...');
  },

  btnCloudEnvironments: async () => {
    openCloudTool('environments', 'Opening Environments...');
  },

  btnCloudPipelines: async () => {
    openCloudTool('pipelines', 'Opening Pipelines...');
  },

  btnCloudActivity: async () => {
    openCloudTool('activity', 'Opening Activity...');
  }
};

// --- Menu Navigation Functions ---
function showSubmenu(elements, state) {
  state.setMenu('submenu');
  elements.actionList.style.display = 'none';
  elements.currentPageMenu.style.display = 'block';
  elements.aemCloudMenu.style.display = 'none';
}

function showCloudMenu(elements, state) {
  state.setMenu('cloudmenu');
  elements.actionList.style.display = 'none';
  elements.currentPageMenu.style.display = 'none';
  elements.aemCloudMenu.style.display = 'block';
}

function showMainMenu(elements, state) {
  state.setMenu('main');
  elements.currentPageMenu.style.display = 'none';
  elements.aemCloudMenu.style.display = 'none';
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
  let filteredBtns;
  if (state.isMainMenu()) {
    filteredBtns = elements.buttons;
  } else if (state.isCloudMenu()) {
    filteredBtns = elements.cloudMenuButtons;
  } else {
    filteredBtns = elements.submenuButtons;
  }

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
  let cloudVisible = 0;

  // Search main menu
  elements.buttons.forEach(btn => {
    if (btn.id === 'btnCurrentPageMenu' || btn.id === 'btnAemCloudMenu') {
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

  // Search cloud menu - hide back button when searching
  elements.cloudMenuButtons.forEach(btn => {
    if (btn.id === 'btnGoBackCloud') {
      btn.style.display = val ? 'none' : '';
      return;
    }
    const text = btn.textContent.toLowerCase();
    if (text.includes(val)) {
      btn.style.display = '';
      cloudVisible++;
    } else {
      btn.style.display = 'none';
    }
  });

  // Show/hide menus based on matches
  if (val) {
    const totalVisible = mainVisible + subVisible + cloudVisible;
    if (totalVisible === 0) {
      elements.actionList.style.display = 'none';
      elements.currentPageMenu.style.display = 'none';
      elements.aemCloudMenu.style.display = 'none';
    } else if (mainVisible > 0 && subVisible === 0 && cloudVisible === 0) {
      showMainMenu(elements, state);
    } else if (subVisible > 0 && mainVisible === 0 && cloudVisible === 0) {
      showSubmenu(elements, state);
    } else if (cloudVisible > 0 && mainVisible === 0 && subVisible === 0) {
      showCloudMenu(elements, state);
    } else {
      // Show all menus with matches
      elements.actionList.style.display = mainVisible > 0 ? 'block' : 'none';
      elements.currentPageMenu.style.display = subVisible > 0 ? 'block' : 'none';
      elements.aemCloudMenu.style.display = cloudVisible > 0 ? 'block' : 'none';
    }
  } else {
    showMainMenu(elements, state);
  }

  // Get all visible action buttons - exclude back buttons from search results
  let filteredBtns;
  if (val) {
    filteredBtns = [...elements.buttons, ...elements.submenuButtons, ...elements.cloudMenuButtons].filter(btn =>
      btn.style.display !== 'none' && btn.id !== 'btnGoBack' && btn.id !== 'btnGoBackCloud'
    );
  } else {
    filteredBtns = [...elements.buttons, ...elements.submenuButtons, ...elements.cloudMenuButtons].filter(btn =>
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

        // Special handling for menu buttons
        if (selectedBtn.id === 'btnCurrentPageMenu') {
          showSubmenu(elements, state);
          setTimeout(() => {
            updateSelectionForCurrentMenu(elements, allButtons, state);
          }, 10);
        } else if (selectedBtn.id === 'btnAemCloudMenu') {
          showCloudMenu(elements, state);
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

      if (state.isSubmenu() || state.isCloudMenu()) {
        // In submenu or cloud menu, go back to main menu
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
    aemCloudMenu: document.getElementById('aemCloudMenu'),
    btnCurrentPageMenu: document.getElementById('btnCurrentPageMenu'),
    btnAemCloudMenu: document.getElementById('btnAemCloudMenu'),
    btnGoBack: document.getElementById('btnGoBack'),
    btnGoBackCloud: document.getElementById('btnGoBackCloud'),
    buttons: Array.from(document.getElementById('actionList').querySelectorAll('button')),
    submenuButtons: Array.from(document.getElementById('currentPageMenu').querySelectorAll('button')),
    cloudMenuButtons: Array.from(document.getElementById('aemCloudMenu').querySelectorAll('button'))
  };

  const allButtons = [...elements.buttons, ...elements.submenuButtons, ...elements.cloudMenuButtons];

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

  // Cloud menu navigation
  if (elements.btnAemCloudMenu) {
    elements.btnAemCloudMenu.addEventListener('click', (e) => {
      e.preventDefault();
      showCloudMenu(elements, state);
      setTimeout(() => {
        updateSelectionForCurrentMenu(elements, allButtons, state);
      }, 10);
    });
  }

  if (elements.btnGoBackCloud) {
    elements.btnGoBackCloud.addEventListener('click', (e) => {
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

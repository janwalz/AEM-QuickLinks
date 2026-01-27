(() => {
  // storage.js
  async function getProjects() {
    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome?.storage?.sync) {
        resolve([]);
        return;
      }
      try {
        chrome.storage.sync.get(["projects"], (result) => {
          if (chrome.runtime?.lastError) {
            console.warn("Error getting projects:", chrome.runtime.lastError);
            resolve([]);
            return;
          }
          resolve(result.projects || []);
        });
      } catch (error) {
        console.warn("Error accessing storage:", error);
        resolve([]);
      }
    });
  }

  // aemHelpers.js
  var DEFAULT_AUTHOR_PORT = "4502";
  var DEFAULT_PUBLISH_PORT = "4503";
  function matchUrlToProject(url, projects) {
    if (!url || !projects || projects.length === 0) {
      return null;
    }
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const port = urlObj.port;
      const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
      for (const project of projects) {
        if (matchesPattern(hostname, project.pattern)) {
          if (isLocalhost && port) {
            const authorPort = project.authorPort || DEFAULT_AUTHOR_PORT;
            const publishPort = project.publishPort || DEFAULT_PUBLISH_PORT;
            if (port === authorPort || port === publishPort) {
              return project;
            }
            continue;
          }
          return project;
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }
  function matchesPattern(hostname, pattern) {
    const regexPattern = pattern.replace(/\./g, "\\.").replace(/\*/g, "[^.]+");
    const regex = new RegExp(`^${regexPattern}$`, "i");
    return regex.test(hostname);
  }
  async function getPortSettings(currentUrl = null) {
    const projects = await getProjects();
    if (currentUrl) {
      const project = matchUrlToProject(currentUrl, projects);
      if (project) {
        return {
          authorPort: project.authorPort || DEFAULT_AUTHOR_PORT,
          publishPort: project.publishPort || DEFAULT_PUBLISH_PORT,
          dispatcherUrl: project.dispatcherUrl || "",
          orgId: project.orgId || "",
          programId: project.programId || ""
        };
      }
    }
    const fallbackProject = projects.find((p) => p.isFallback);
    if (fallbackProject) {
      return {
        authorPort: fallbackProject.authorPort || DEFAULT_AUTHOR_PORT,
        publishPort: fallbackProject.publishPort || DEFAULT_PUBLISH_PORT,
        dispatcherUrl: fallbackProject.dispatcherUrl || "",
        orgId: fallbackProject.orgId || "",
        programId: fallbackProject.programId || ""
      };
    }
    return {
      authorPort: DEFAULT_AUTHOR_PORT,
      publishPort: DEFAULT_PUBLISH_PORT,
      dispatcherUrl: "",
      orgId: "",
      programId: ""
    };
  }
  function showMessage(text, isError = false) {
    const msg = document.getElementById("message");
    if (msg) {
      if (text) {
        msg.textContent = text;
        msg.classList.add("mint");
        if (!isError) {
          isError = text.toLowerCase().includes("error") || text.toLowerCase().includes("not an aem") || text.toLowerCase().includes("no content");
        }
      } else {
        msg.textContent = "";
        msg.classList.remove("mint");
      }
    }
    return isError;
  }
  function isCloudOrLocalhost(url) {
    try {
      const u = new URL(url);
      if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
      const authorPattern = /^author-p\w+-e\w+\.adobeaemcloud\.com$/;
      const publishPattern = /^publish-p\w+-e\w+\.adobeaemcloud\.com$/;
      if (authorPattern.test(u.hostname) || publishPattern.test(u.hostname)) return true;
      return false;
    } catch (e) {
      return false;
    }
  }
  function getContentPath(url) {
    try {
      const u = new URL(url);
      const itemParam = u.searchParams.get("item");
      if (itemParam && itemParam.startsWith("/content")) {
        return itemParam.endsWith(".html") ? itemParam : itemParam + ".html";
      }
      const editorMatch = u.pathname.match(/^\/editor\.html(\/content[^?#]*)/);
      if (editorMatch) {
        return editorMatch[1];
      }
      const contentMatch = u.pathname.match(/^(\/content[^?#]*)/);
      if (contentMatch) {
        return contentMatch[1];
      }
      if (u.pathname === "/crx/de/index.jsp" && u.hash.startsWith("#/")) {
        const hashPath = u.hash.slice(1);
        return hashPath + ".html";
      }
      return null;
    } catch (e) {
      return null;
    }
  }
  function getAemSystemType(url, settings = null) {
    try {
      const u = new URL(url);
      if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
        const authorPort = settings?.authorPort || DEFAULT_AUTHOR_PORT;
        const publishPort = settings?.publishPort || DEFAULT_PUBLISH_PORT;
        if (u.port === authorPort) return "author";
        if (u.port === publishPort) return "publish";
        return null;
      }
      const authorPattern = /^author-p\w+-e\w+\.adobeaemcloud\.com$/;
      const publishPattern = /^publish-p\w+-e\w+\.adobeaemcloud\.com$/;
      if (authorPattern.test(u.hostname)) return "author";
      if (publishPattern.test(u.hostname)) return "publish";
      return null;
    } catch (e) {
      return null;
    }
  }
  function openAemTool(path, port, message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.url || !isCloudOrLocalhost(tab.url)) {
        showMessage("Error: Not an AEM or localhost URL!", true);
        return;
      }
      let baseUrl = `http://localhost:${port}`;
      try {
        const u = new URL(tab.url);
        baseUrl = `${u.protocol}//${u.hostname}:${port}`;
      } catch (e) {
      }
      const createOptions = { url: `${baseUrl}${path}` };
      if (typeof tab.index === "number") createOptions.index = tab.index + 1;
      chrome.tabs.create(createOptions);
      showMessage(message, false);
      setTimeout(() => window.close(), 100);
    });
  }
  function withValidAemTab(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.url || !isCloudOrLocalhost(tab.url)) {
        showMessage("Error: Not an AEM or localhost URL!", true);
        return;
      }
      callback(tab);
    });
  }
  function getValidContentPath(tab, onSuccess, onError) {
    const contentPath = getContentPath(tab.url);
    if (contentPath) {
      onSuccess(contentPath);
    } else {
      showMessage(onError || "No content page detected!", true);
    }
  }
  function openDispatcher(dispatcherUrl, path = "") {
    if (!dispatcherUrl || !dispatcherUrl.trim()) {
      showDispatcherNotConfiguredError();
      return;
    }
    const baseUrl = dispatcherUrl.replace(/\/$/, "");
    const fullUrl = path ? `${baseUrl}${path}` : baseUrl;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      const createOptions = { url: fullUrl };
      if (tab && typeof tab.index === "number") createOptions.index = tab.index + 1;
      chrome.tabs.create(createOptions);
      showMessage("Opening dispatcher...", false);
      setTimeout(() => window.close(), 100);
    });
  }
  function showDispatcherNotConfiguredError() {
    const msg = document.getElementById("message");
    if (msg) {
      msg.innerHTML = 'Dispatcher URL not configured. <a href="#" id="openSettings" style="color: #667eea; text-decoration: underline;">Open Settings</a>';
      msg.classList.add("mint");
      const settingsLink = document.getElementById("openSettings");
      if (settingsLink) {
        settingsLink.addEventListener("click", (e) => {
          e.preventDefault();
          chrome.runtime.openOptionsPage();
        });
      }
    }
  }
  function showCloudNotConfiguredError(message = "AEM Cloud settings not configured") {
    const msg = document.getElementById("message");
    if (msg) {
      msg.innerHTML = `${message}. <a href="#" id="openSettings" style="color: #667eea; text-decoration: underline;">Open Settings</a>`;
      msg.classList.add("mint");
      const settingsLink = document.getElementById("openSettings");
      if (settingsLink) {
        settingsLink.addEventListener("click", (e) => {
          e.preventDefault();
          chrome.runtime.openOptionsPage();
        });
      }
    }
  }
  function extractCloudIds(url) {
    try {
      const urlObj = new URL(url);
      if (!urlObj.hostname.includes("experience.adobe.com")) {
        return { orgId: null, programId: null };
      }
      const hashMatch = urlObj.hash.match(/#\/@([^/]+)\/cloud-manager/);
      const orgId = hashMatch ? hashMatch[1] : null;
      const programMatch = urlObj.hash.match(/\/program\/([^/?#]+)/);
      const programId = programMatch ? programMatch[1] : null;
      return { orgId, programId };
    } catch (e) {
      return { orgId: null, programId: null };
    }
  }
  function extractProgramId(url) {
    try {
      const urlObj = new URL(url);
      const cloudPattern = /^(author|publish)-p(\w+)-e(\w+)\.adobeaemcloud\.com$/;
      const match = urlObj.hostname.match(cloudPattern);
      if (match) {
        return match[2];
      }
      return null;
    } catch (e) {
      return null;
    }
  }
  function extractEnvironmentId(url) {
    try {
      const urlObj = new URL(url);
      const cloudPattern = /^(author|publish)-p(\w+)-e(\w+)\.adobeaemcloud\.com$/;
      const match = urlObj.hostname.match(cloudPattern);
      if (match) {
        return match[3];
      }
      return null;
    } catch (e) {
      return null;
    }
  }
  function buildCloudConsoleUrl(orgId, programId = null, path = null, environmentId = null) {
    let url = `https://experience.adobe.com/#/@${orgId}/cloud-manager`;
    if (programId) {
      if (path) {
        url += `/${path}.html/program/${programId}`;
        if (environmentId) {
          url += `/environment/${environmentId}`;
        }
      } else {
        url += `/home.html/program/${programId}`;
      }
    } else {
      url += "/home.html";
    }
    return url;
  }
  async function openCloudTool(path, message) {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      const urlIds = extractCloudIds(tab?.url || "");
      const instanceProgramId = extractProgramId(tab?.url || "");
      const settings = await getPortSettings(tab?.url);
      const orgId = urlIds.orgId || settings.orgId;
      const programId = urlIds.programId || instanceProgramId || settings.programId;
      if (!orgId) {
        showCloudNotConfiguredError("Organization ID not configured");
        return;
      }
      let url;
      switch (path) {
        case "home":
          if (!programId) {
            showCloudNotConfiguredError("Program ID not configured");
            return;
          }
          url = buildCloudConsoleUrl(orgId, programId);
          break;
        case "environment-details":
          const environmentId = extractEnvironmentId(tab?.url || "");
          const urlProgramId = extractProgramId(tab?.url || "");
          if (!environmentId || !urlProgramId) {
            showMessage("Not on an AEM Cloud instance", true);
            return;
          }
          const envOrgId = urlIds.orgId || settings.orgId;
          if (!envOrgId) {
            showCloudNotConfiguredError("Organization ID not configured");
            return;
          }
          url = buildCloudConsoleUrl(envOrgId, urlProgramId, "environments", environmentId);
          break;
        case "environments":
        case "pipelines":
        case "activity":
          if (!programId) {
            showCloudNotConfiguredError("Program ID not configured");
            return;
          }
          url = buildCloudConsoleUrl(orgId, programId, path);
          break;
        default:
          showMessage("Unknown cloud tool", true);
          return;
      }
      const createOptions = { url };
      if (tab && typeof tab.index === "number") createOptions.index = tab.index + 1;
      chrome.tabs.create(createOptions);
      showMessage(message, false);
      setTimeout(() => window.close(), 100);
    });
  }

  // popup.js
  var PopupState = class {
    constructor() {
      this.currentMenu = "main";
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
      return this.currentMenu === "main";
    }
    isSubmenu() {
      return this.currentMenu === "submenu";
    }
    isCloudMenu() {
      return this.currentMenu === "cloudmenu";
    }
  };
  var BUTTON_HANDLERS = {
    btnCrxde: async () => {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const tab = tabs[0];
        const settings = await getPortSettings(tab?.url);
        openAemTool("/crx/de", settings.authorPort, "Opening CRXDE...");
      });
    },
    btnCrxdeCurrent: async () => {
      withValidAemTab(async (tab) => {
        const settings = await getPortSettings(tab.url);
        const contentPath = getContentPath(tab.url);
        if (contentPath) {
          const cleanPath = contentPath.replace(/\.[^./?#]+(\.[^./?#]+)?$/, "");
          const crxdeHash = "#/" + cleanPath.replace(/^\//, "");
          openAemTool("/crx/de/index.jsp" + crxdeHash, settings.authorPort, "Opening CRXDE for current page...");
        } else {
          openAemTool("/crx/de", settings.authorPort, "Opening CRXDE...");
        }
      });
    },
    btnOpenPublish: async () => {
      withValidAemTab(async (tab) => {
        const settings = await getPortSettings(tab.url);
        const systemType = getAemSystemType(tab.url, settings);
        if (!systemType) {
          showMessage("Not an AEM or localhost URL!", true);
          return;
        }
        getValidContentPath(tab, (contentPath) => {
          let publishPort = new URL(tab.url).port;
          if (systemType === "author") {
            if (["localhost", "127.0.0.1"].includes(new URL(tab.url).hostname)) {
              publishPort = settings.publishPort;
            }
          }
          openAemTool(contentPath, publishPort || settings.publishPort, "Opening publish for current page...");
        });
      });
    },
    btnOpenAuthor: async () => {
      withValidAemTab(async (tab) => {
        const settings = await getPortSettings(tab.url);
        const systemType = getAemSystemType(tab.url, settings);
        if (!systemType) {
          showMessage("Not an AEM or localhost URL!", true);
          return;
        }
        getValidContentPath(tab, (contentPath) => {
          let authorPort = new URL(tab.url).port;
          if (systemType === "publish") {
            if (["localhost", "127.0.0.1"].includes(new URL(tab.url).hostname)) {
              authorPort = settings.authorPort;
            }
          }
          openAemTool(contentPath, authorPort || settings.authorPort, "Opening author for current page...");
        });
      });
    },
    btnEditView: async () => {
      withValidAemTab(async (tab) => {
        const settings = await getPortSettings(tab.url);
        getValidContentPath(tab, (contentPath) => {
          openAemTool("/editor.html" + contentPath, settings.authorPort, "Opening edit view for current page...");
        });
      });
    },
    btnPackMgr: async () => {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const tab = tabs[0];
        const settings = await getPortSettings(tab?.url);
        openAemTool("/crx/packmgr", settings.authorPort, "Opening Package Manager...");
      });
    },
    btnReplicationAgent: async () => {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const tab = tabs[0];
        const settings = await getPortSettings(tab?.url);
        openAemTool("/etc/replication/agents.author/publish.html", settings.authorPort, "Opening Replication Default Agent...");
      });
    },
    btnLoginPublish: async () => {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const tab = tabs[0];
        const settings = await getPortSettings(tab?.url);
        openAemTool("/libs/granite/core/content/login.html", settings.publishPort, "Opening Login on Publish...");
      });
    },
    btnConfigMgr: async () => {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const tab = tabs[0];
        const settings = await getPortSettings(tab?.url);
        openAemTool("/system/console/configMgr", settings.authorPort, "Opening Config Manager...");
      });
    },
    btnGroovyConsole: async () => {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const tab = tabs[0];
        const settings = await getPortSettings(tab?.url);
        openAemTool("/groovyconsole", settings.authorPort, "Opening Groovy Console...");
      });
    },
    btnViewAsPublished: async () => {
      withValidAemTab(async (tab) => {
        const settings = await getPortSettings(tab.url);
        getValidContentPath(tab, (contentPath) => {
          openAemTool(contentPath + "?wcmmode=disabled", settings.authorPort, "Opening as published...");
        });
      });
    },
    btnSlingModelExporter: async () => {
      withValidAemTab(async (tab) => {
        const settings = await getPortSettings(tab.url);
        const systemType = getAemSystemType(tab.url, settings);
        if (!systemType) {
          showMessage("Not an AEM or localhost URL!", true);
          return;
        }
        getValidContentPath(tab, (contentPath) => {
          const modelPath = contentPath.replace(/\.html$/, ".model.json");
          let port = new URL(tab.url).port;
          if (!port || port === "") {
            port = systemType === "author" ? settings.authorPort : settings.publishPort;
          }
          openAemTool(modelPath, port, "Opening Sling Model Exporter...");
        });
      });
    },
    btnPageProperties: async () => {
      withValidAemTab(async (tab) => {
        const settings = await getPortSettings(tab.url);
        getValidContentPath(tab, (contentPath) => {
          const pagePath = contentPath.replace(/\.[^./?#]+(\.[^./?#]+)?$/, "");
          openAemTool("/mnt/overlay/wcm/core/content/sites/properties.html?item=" + pagePath, settings.authorPort, "Opening page properties...");
        });
      });
    },
    btnDispatcher: async () => {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const tab = tabs[0];
        const settings = await getPortSettings(tab?.url);
        openDispatcher(settings.dispatcherUrl);
      });
    },
    btnDispatcherCurrent: async () => {
      withValidAemTab(async (tab) => {
        const settings = await getPortSettings(tab.url);
        getValidContentPath(tab, (contentPath) => {
          openDispatcher(settings.dispatcherUrl, contentPath);
        }, "No content page detected!");
      });
    },
    btnCloudEnvironmentDetails: async () => {
      openCloudTool("environment-details", "Opening Environment Details...");
    },
    btnCloudOverview: async () => {
      openCloudTool("home", "Opening Cloud Manager Home...");
    },
    btnCloudEnvironments: async () => {
      openCloudTool("environments", "Opening Environments...");
    },
    btnCloudPipelines: async () => {
      openCloudTool("pipelines", "Opening Pipelines...");
    },
    btnCloudActivity: async () => {
      openCloudTool("activity", "Opening Activity...");
    }
  };
  function showSubmenu(elements, state) {
    state.setMenu("submenu");
    elements.actionList.style.display = "none";
    elements.currentPageMenu.style.display = "block";
    elements.aemCloudMenu.style.display = "none";
  }
  function showCloudMenu(elements, state) {
    state.setMenu("cloudmenu");
    elements.actionList.style.display = "none";
    elements.currentPageMenu.style.display = "none";
    elements.aemCloudMenu.style.display = "block";
  }
  function showMainMenu(elements, state) {
    state.setMenu("main");
    elements.currentPageMenu.style.display = "none";
    elements.aemCloudMenu.style.display = "none";
    elements.actionList.style.display = "block";
  }
  function scrollSelectedIntoView(button) {
    if (button) {
      button.scrollIntoView({
        block: "nearest",
        behavior: "smooth"
      });
    }
  }
  function updateSelection(allButtons, filteredButtons, selectedIndex, state) {
    allButtons.forEach((btn) => btn.classList.remove("selected"));
    if (filteredButtons.length > 0 && selectedIndex >= 0 && selectedIndex < filteredButtons.length) {
      filteredButtons[selectedIndex].classList.add("selected");
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
    const visibleBtns = filteredBtns.filter((btn) => btn.style.display !== "none");
    allButtons.forEach((btn) => btn.classList.remove("selected"));
    if (visibleBtns.length > 0) {
      visibleBtns[0].classList.add("selected");
      state.setSelectedIndex(0);
      state.setFilteredButtons(visibleBtns);
    } else {
      state.setSelectedIndex(-1);
      state.setFilteredButtons([]);
    }
  }
  function handleSearch(searchValue, elements, allButtons, state) {
    const val = searchValue.trim().toLowerCase();
    let mainVisible = 0;
    let subVisible = 0;
    let cloudVisible = 0;
    elements.buttons.forEach((btn) => {
      if (btn.id === "btnCurrentPageMenu" || btn.id === "btnAemCloudMenu") {
        btn.style.display = val ? "none" : "";
        return;
      }
      const text = btn.textContent.toLowerCase();
      if (text.includes(val)) {
        btn.style.display = "";
        mainVisible++;
      } else {
        btn.style.display = "none";
      }
    });
    elements.submenuButtons.forEach((btn) => {
      if (btn.id === "btnGoBack") {
        btn.style.display = val ? "none" : "";
        return;
      }
      const text = btn.textContent.toLowerCase();
      if (text.includes(val)) {
        btn.style.display = "";
        subVisible++;
      } else {
        btn.style.display = "none";
      }
    });
    elements.cloudMenuButtons.forEach((btn) => {
      if (btn.id === "btnGoBackCloud") {
        btn.style.display = val ? "none" : "";
        return;
      }
      const text = btn.textContent.toLowerCase();
      if (text.includes(val)) {
        btn.style.display = "";
        cloudVisible++;
      } else {
        btn.style.display = "none";
      }
    });
    if (val) {
      const totalVisible = mainVisible + subVisible + cloudVisible;
      if (totalVisible === 0) {
        elements.actionList.style.display = "none";
        elements.currentPageMenu.style.display = "none";
        elements.aemCloudMenu.style.display = "none";
      } else if (mainVisible > 0 && subVisible === 0 && cloudVisible === 0) {
        showMainMenu(elements, state);
      } else if (subVisible > 0 && mainVisible === 0 && cloudVisible === 0) {
        showSubmenu(elements, state);
      } else if (cloudVisible > 0 && mainVisible === 0 && subVisible === 0) {
        showCloudMenu(elements, state);
      } else {
        elements.actionList.style.display = mainVisible > 0 ? "block" : "none";
        elements.currentPageMenu.style.display = subVisible > 0 ? "block" : "none";
        elements.aemCloudMenu.style.display = cloudVisible > 0 ? "block" : "none";
      }
    } else {
      showMainMenu(elements, state);
    }
    let filteredBtns;
    if (val) {
      filteredBtns = [...elements.buttons, ...elements.submenuButtons, ...elements.cloudMenuButtons].filter(
        (btn) => btn.style.display !== "none" && btn.id !== "btnGoBack" && btn.id !== "btnGoBackCloud"
      );
    } else {
      filteredBtns = [...elements.buttons, ...elements.submenuButtons, ...elements.cloudMenuButtons].filter(
        (btn) => btn.style.display !== "none"
      );
    }
    updateSelection(allButtons, filteredBtns, filteredBtns.length > 0 ? 0 : -1, state);
    state.setFilteredButtons(filteredBtns);
  }
  function handleKeydown(e, elements, allButtons, state) {
    const filteredBtns = state.getFilteredButtons();
    let selectedIndex = state.getSelectedIndex();
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (filteredBtns.length === 0) return;
        selectedIndex = (selectedIndex + 1) % filteredBtns.length;
        updateSelection(allButtons, filteredBtns, selectedIndex, state);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (filteredBtns.length === 0) return;
        selectedIndex = (selectedIndex - 1 + filteredBtns.length) % filteredBtns.length;
        updateSelection(allButtons, filteredBtns, selectedIndex, state);
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredBtns.length) {
          const selectedBtn = filteredBtns[selectedIndex];
          if (selectedBtn.id === "btnCurrentPageMenu") {
            showSubmenu(elements, state);
            setTimeout(() => {
              updateSelectionForCurrentMenu(elements, allButtons, state);
            }, 10);
          } else if (selectedBtn.id === "btnAemCloudMenu") {
            showCloudMenu(elements, state);
            setTimeout(() => {
              updateSelectionForCurrentMenu(elements, allButtons, state);
            }, 10);
          } else {
            selectedBtn.click();
          }
        }
        break;
      case "Escape":
        e.preventDefault();
        if (state.isSubmenu() || state.isCloudMenu()) {
          showMainMenu(elements, state);
          elements.search.value = "";
          setTimeout(() => {
            handleSearch("", elements, allButtons, state);
          }, 10);
          elements.search.focus();
        } else if (elements.search.value.trim()) {
          elements.search.value = "";
          showMainMenu(elements, state);
          setTimeout(() => {
            handleSearch("", elements, allButtons, state);
          }, 10);
          elements.search.focus();
        } else {
          window.close();
        }
        break;
      case "Home":
        e.preventDefault();
        if (filteredBtns.length === 0) return;
        updateSelection(allButtons, filteredBtns, 0, state);
        break;
      case "End":
        e.preventDefault();
        if (filteredBtns.length === 0) return;
        updateSelection(allButtons, filteredBtns, filteredBtns.length - 1, state);
        break;
      case "PageDown":
        e.preventDefault();
        if (filteredBtns.length === 0) return;
        selectedIndex = Math.min(selectedIndex + 5, filteredBtns.length - 1);
        updateSelection(allButtons, filteredBtns, selectedIndex, state);
        break;
      case "PageUp":
        e.preventDefault();
        if (filteredBtns.length === 0) return;
        selectedIndex = Math.max(selectedIndex - 5, 0);
        updateSelection(allButtons, filteredBtns, selectedIndex, state);
        break;
    }
  }
  function addButtonListener(buttonId, handler) {
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.addEventListener("click", () => {
        handler();
      });
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    const state = new PopupState();
    const elements = {
      search: document.getElementById("actionSearch"),
      actionList: document.getElementById("actionList"),
      currentPageMenu: document.getElementById("currentPageMenu"),
      aemCloudMenu: document.getElementById("aemCloudMenu"),
      btnCurrentPageMenu: document.getElementById("btnCurrentPageMenu"),
      btnAemCloudMenu: document.getElementById("btnAemCloudMenu"),
      btnGoBack: document.getElementById("btnGoBack"),
      btnGoBackCloud: document.getElementById("btnGoBackCloud"),
      buttons: Array.from(document.getElementById("actionList").querySelectorAll("button")),
      submenuButtons: Array.from(document.getElementById("currentPageMenu").querySelectorAll("button")),
      cloudMenuButtons: Array.from(document.getElementById("aemCloudMenu").querySelectorAll("button"))
    };
    const allButtons = [...elements.buttons, ...elements.submenuButtons, ...elements.cloudMenuButtons];
    elements.search.focus();
    if (elements.btnCurrentPageMenu) {
      elements.btnCurrentPageMenu.addEventListener("click", (e) => {
        e.preventDefault();
        showSubmenu(elements, state);
        setTimeout(() => {
          updateSelectionForCurrentMenu(elements, allButtons, state);
        }, 10);
      });
    }
    if (elements.btnGoBack) {
      elements.btnGoBack.addEventListener("click", (e) => {
        e.preventDefault();
        showMainMenu(elements, state);
        setTimeout(() => {
          updateSelectionForCurrentMenu(elements, allButtons, state);
        }, 10);
      });
    }
    if (elements.btnAemCloudMenu) {
      elements.btnAemCloudMenu.addEventListener("click", (e) => {
        e.preventDefault();
        showCloudMenu(elements, state);
        setTimeout(() => {
          updateSelectionForCurrentMenu(elements, allButtons, state);
        }, 10);
      });
    }
    if (elements.btnGoBackCloud) {
      elements.btnGoBackCloud.addEventListener("click", (e) => {
        e.preventDefault();
        showMainMenu(elements, state);
        setTimeout(() => {
          updateSelectionForCurrentMenu(elements, allButtons, state);
        }, 10);
      });
    }
    elements.search.addEventListener("input", () => {
      handleSearch(elements.search.value, elements, allButtons, state);
    });
    elements.search.addEventListener("keydown", (e) => {
      handleKeydown(e, elements, allButtons, state);
    });
    handleSearch("", elements, allButtons, state);
    Object.keys(BUTTON_HANDLERS).forEach((buttonId) => {
      addButtonListener(buttonId, BUTTON_HANDLERS[buttonId]);
    });
  });
})();

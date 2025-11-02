import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  showMessage,
  isCloudOrLocalhost,
  getContentPath,
  getAemSystemType,
  openAemTool,
  withValidAemTab,
  getValidContentPath,
  getPortSettings,
  openDispatcher,
  getProjects,
  matchUrlToProject,
  buildCloudConsoleUrl,
  openCloudTool,
  showCloudNotConfiguredError,
  PORT_AUTHOR,
  PORT_PUBLISH
} from './aemHelpers.js';

// Mock Chrome API
global.chrome = {
  tabs: {
    query: jest.fn(),
    create: jest.fn()
  },
  storage: {
    sync: {
      get: jest.fn((keys, callback) => {
        // Default to empty object, which will use defaults
        callback({});
      }),
      set: jest.fn((data, callback) => {
        if (callback) callback();
      })
    }
  },
  runtime: {}
};

describe('aemHelpers', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '<div id="message"></div>';
    // Reset mocks
    jest.clearAllMocks();
    // Ensure chrome.runtime exists and has no lastError
    chrome.runtime = {};
  });

  describe('getProjects', () => {
    it('should return empty array when storage is empty', async () => {
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({});
      });

      const projects = await getProjects();
      expect(projects).toEqual([]);
    });

    it('should return projects from storage', async () => {
      const mockProjects = [
        {
          id: '1',
          name: 'Project 1',
          pattern: 'localhost',
          authorPort: '4502',
          publishPort: '4503',
          dispatcherUrl: 'https://example.com'
        }
      ];

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ projects: mockProjects });
      });

      const projects = await getProjects();
      expect(projects).toEqual(mockProjects);
    });

    it('should handle chrome.runtime.lastError', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        chrome.runtime = { lastError: new Error('Storage error') };
        callback({});
      });

      const projects = await getProjects();
      expect(projects).toEqual([]);

      consoleWarnSpy.mockRestore();
      chrome.runtime = {};
    });

    it('should handle missing chrome.storage.sync', async () => {
      const originalSync = chrome.storage.sync;
      delete chrome.storage.sync;

      const projects = await getProjects();
      expect(projects).toEqual([]);

      chrome.storage.sync = originalSync;
    });
  });

  describe('matchUrlToProject', () => {
    const projects = [
      {
        id: '1',
        name: 'Local Project 4502',
        pattern: 'localhost',
        authorPort: '4502',
        publishPort: '4503',
        dispatcherUrl: 'https://localhost-dispatcher.com'
      },
      {
        id: '2',
        name: 'Local Project 5502',
        pattern: 'localhost',
        authorPort: '5502',
        publishPort: '5503',
        dispatcherUrl: 'https://localhost-5502-dispatcher.com'
      },
      {
        id: '3',
        name: 'AEM Cloud',
        pattern: '*.adobeaemcloud.com',
        authorPort: '4502',
        publishPort: '4503',
        dispatcherUrl: 'https://cloud-dispatcher.com'
      },
      {
        id: '4',
        name: 'Specific Project',
        pattern: 'author-p12345-e67890.adobeaemcloud.com',
        authorPort: '5502',
        publishPort: '5503',
        dispatcherUrl: 'https://specific-dispatcher.com'
      }
    ];

    it('should match localhost with port 4502', () => {
      const url = 'http://localhost:4502/content/page.html';
      const matched = matchUrlToProject(url, projects);
      expect(matched).toEqual(projects[0]);
      expect(matched.name).toBe('Local Project 4502');
    });

    it('should match localhost with port 4503 to same project as 4502', () => {
      const url = 'http://localhost:4503/content/page.html';
      const matched = matchUrlToProject(url, projects);
      expect(matched).toEqual(projects[0]);
      expect(matched.name).toBe('Local Project 4502');
    });

    it('should match localhost with port 5502', () => {
      const url = 'http://localhost:5502/content/page.html';
      const matched = matchUrlToProject(url, projects);
      expect(matched).toEqual(projects[1]);
      expect(matched.name).toBe('Local Project 5502');
    });

    it('should match localhost with port 5503 to same project as 5502', () => {
      const url = 'http://localhost:5503/content/page.html';
      const matched = matchUrlToProject(url, projects);
      expect(matched).toEqual(projects[1]);
      expect(matched.name).toBe('Local Project 5502');
    });

    it('should return null for localhost with non-matching port', () => {
      const url = 'http://localhost:8080/content/page.html';
      const matched = matchUrlToProject(url, projects);
      expect(matched).toBe(null);
    });

    it('should return null for 127.0.0.1 when pattern is localhost', () => {
      // 127.0.0.1 doesn't match pattern "localhost" - they need separate patterns
      const url = 'http://127.0.0.1:5502/content/page.html';
      const matched = matchUrlToProject(url, projects);
      expect(matched).toBe(null);
    });

    it('should match 127.0.0.1 when pattern explicitly includes it', () => {
      const projectsWithIP = [
        {
          id: '1',
          name: 'Local IP Project',
          pattern: '127.0.0.1',
          authorPort: '5502',
          publishPort: '5503',
          dispatcherUrl: 'https://local-dispatcher.com'
        }
      ];

      const url = 'http://127.0.0.1:5502/content/page.html';
      const matched = matchUrlToProject(url, projectsWithIP);
      expect(matched.name).toBe('Local IP Project');
    });

    it('should match wildcard pattern', () => {
      const url = 'https://author-p99999-e88888.adobeaemcloud.com/editor.html/content/page';
      const matched = matchUrlToProject(url, projects);
      expect(matched.name).toBe('AEM Cloud'); // Wildcard pattern matches
    });

    it('should match exact hostname (first match wins)', () => {
      const url = 'https://author-p12345-e67890.adobeaemcloud.com/content/page.html';
      const matched = matchUrlToProject(url, projects);
      // Both patterns match, but wildcard pattern comes first in array, so it wins
      expect(matched).toEqual(projects[2]);
    });

    it('should return null for no match', () => {
      const url = 'https://www.google.com';
      const matched = matchUrlToProject(url, projects);
      expect(matched).toBe(null);
    });

    it('should return null for invalid URL', () => {
      const matched = matchUrlToProject('not-a-url', projects);
      expect(matched).toBe(null);
    });

    it('should return null when projects is empty', () => {
      const url = 'http://localhost:4502';
      const matched = matchUrlToProject(url, []);
      expect(matched).toBe(null);
    });

    it('should return null when URL is null', () => {
      const matched = matchUrlToProject(null, projects);
      expect(matched).toBe(null);
    });

    it('should match subdomain with wildcard', () => {
      const url = 'https://publish-p12345-e67890.adobeaemcloud.com/content/page.html';
      const matched = matchUrlToProject(url, projects);
      expect(matched.pattern).toBe('*.adobeaemcloud.com');
    });

    it('should prioritize specific patterns when ordered correctly', () => {
      // When projects are ordered with specific patterns first, they match first
      const orderedProjects = [
        {
          id: '4',
          name: 'Specific Project',
          pattern: 'author-p12345-e67890.adobeaemcloud.com',
          authorPort: '5502',
          publishPort: '5503',
          dispatcherUrl: 'https://specific-dispatcher.com'
        },
        {
          id: '3',
          name: 'AEM Cloud',
          pattern: '*.adobeaemcloud.com',
          authorPort: '4502',
          publishPort: '4503',
          dispatcherUrl: 'https://cloud-dispatcher.com'
        }
      ];

      const url = 'https://author-p12345-e67890.adobeaemcloud.com/content/page.html';
      const matched = matchUrlToProject(url, orderedProjects);
      expect(matched.name).toBe('Specific Project');
    });

    it('should match localhost without port to first matching project', () => {
      const url = 'http://localhost/content/page.html';
      const matched = matchUrlToProject(url, projects);
      // Without port, first localhost project matches
      expect(matched.name).toBe('Local Project 4502');
    });
  });

  describe('getPortSettings', () => {
    it('should return default ports when no URL provided and storage is empty', async () => {
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({});
      });

      const settings = await getPortSettings();
      expect(settings.authorPort).toBe('4502');
      expect(settings.publishPort).toBe('4503');
      expect(settings.dispatcherUrl).toBe('');
    });

    it('should return project settings when URL matches', async () => {
      const mockProjects = [
        {
          id: '1',
          name: 'Local Project',
          pattern: 'localhost',
          authorPort: '5502',
          publishPort: '5503',
          dispatcherUrl: 'https://example.com'
        }
      ];

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ projects: mockProjects });
      });

      const settings = await getPortSettings('http://localhost:5502/content/page.html');
      expect(settings.authorPort).toBe('5502');
      expect(settings.publishPort).toBe('5503');
      expect(settings.dispatcherUrl).toBe('https://example.com');
    });

    it('should return defaults when URL does not match any project', async () => {
      const mockProjects = [
        {
          id: '1',
          name: 'Local Project',
          pattern: 'localhost',
          authorPort: '5502',
          publishPort: '5503',
          dispatcherUrl: 'https://example.com'
        }
      ];

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ projects: mockProjects });
      });

      const settings = await getPortSettings('https://www.google.com');
      expect(settings.authorPort).toBe('4502');
      expect(settings.publishPort).toBe('4503');
      expect(settings.dispatcherUrl).toBe('');
    });

    it('should use default ports when project has empty port values', async () => {
      const mockProjects = [
        {
          id: '1',
          name: 'Local Project',
          pattern: 'localhost',
          authorPort: '',
          publishPort: '',
          dispatcherUrl: ''
        }
      ];

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ projects: mockProjects });
      });

      const settings = await getPortSettings('http://localhost:4502');
      expect(settings.authorPort).toBe('4502');
      expect(settings.publishPort).toBe('4503');
      expect(settings.dispatcherUrl).toBe('');
    });

    it('should handle chrome.runtime.lastError', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        chrome.runtime = { lastError: new Error('Storage error') };
        callback({});
      });

      const settings = await getPortSettings('http://localhost:4502');
      expect(settings.authorPort).toBe('4502');
      expect(settings.publishPort).toBe('4503');

      consoleWarnSpy.mockRestore();
      chrome.runtime = {};
    });

    it('should handle missing chrome.storage.sync', async () => {
      const originalSync = chrome.storage.sync;
      delete chrome.storage.sync;

      const settings = await getPortSettings('http://localhost:4502');
      expect(settings.authorPort).toBe('4502');
      expect(settings.publishPort).toBe('4503');

      chrome.storage.sync = originalSync;
    });
  });

  describe('showMessage', () => {
    it('should display message and add mint class', () => {
      const msg = document.getElementById('message');
      const result = showMessage('Test message', false);

      expect(msg.textContent).toBe('Test message');
      expect(msg.classList.contains('mint')).toBe(true);
      expect(result).toBe(false);
    });

    it('should detect error messages by content', () => {
      const msg = document.getElementById('message');
      const result = showMessage('Error: Something went wrong', false);

      expect(msg.textContent).toBe('Error: Something went wrong');
      expect(result).toBe(true);
    });

    it('should detect "not an aem" error messages', () => {
      const result = showMessage('Not an AEM URL', false);
      expect(result).toBe(true);
    });

    it('should detect "no content" error messages', () => {
      const result = showMessage('No content found', false);
      expect(result).toBe(true);
    });

    it('should respect explicit isError parameter', () => {
      const result = showMessage('Custom error', true);
      expect(result).toBe(true);
    });

    it('should clear message when text is empty', () => {
      const msg = document.getElementById('message');
      msg.classList.add('mint');
      showMessage('', false);

      expect(msg.textContent).toBe('');
      expect(msg.classList.contains('mint')).toBe(false);
    });

    it('should handle missing message element gracefully', () => {
      document.body.innerHTML = '';
      expect(() => showMessage('Test', false)).not.toThrow();
    });
  });

  describe('isCloudOrLocalhost', () => {
    it('should return true for localhost', () => {
      expect(isCloudOrLocalhost('http://localhost:4502')).toBe(true);
    });

    it('should return true for 127.0.0.1', () => {
      expect(isCloudOrLocalhost('http://127.0.0.1:4502')).toBe(true);
    });

    it('should return true for AEM Cloud author URL', () => {
      expect(isCloudOrLocalhost('https://author-p12345-e67890.adobeaemcloud.com')).toBe(true);
    });

    it('should return true for AEM Cloud publish URL', () => {
      expect(isCloudOrLocalhost('https://publish-p12345-e67890.adobeaemcloud.com')).toBe(true);
    });

    it('should return false for non-AEM URLs', () => {
      expect(isCloudOrLocalhost('https://www.google.com')).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(isCloudOrLocalhost('not-a-url')).toBe(false);
    });
  });

  describe('getContentPath', () => {
    it('should extract path from editor.html URL', () => {
      const url = 'http://localhost:4502/editor.html/content/site/page';
      expect(getContentPath(url)).toBe('/content/site/page');
    });

    it('should extract path from direct content URL', () => {
      const url = 'http://localhost:4502/content/site/page.html';
      expect(getContentPath(url)).toBe('/content/site/page.html');
    });

    it('should handle content URL without extension', () => {
      const url = 'http://localhost:4502/content/site/page';
      expect(getContentPath(url)).toBe('/content/site/page');
    });

    it('should extract path from CRXDE deep link', () => {
      const url = 'http://localhost:4502/crx/de/index.jsp#/content/site/page';
      expect(getContentPath(url)).toBe('/content/site/page.html');
    });

    it('should handle editor.html with query parameters', () => {
      const url = 'http://localhost:4502/editor.html/content/site/page?wcmmode=disabled';
      expect(getContentPath(url)).toBe('/content/site/page');
    });

    it('should return null for non-content URLs', () => {
      const url = 'http://localhost:4502/crx/packmgr';
      expect(getContentPath(url)).toBe(null);
    });

    it('should return null for invalid URLs', () => {
      expect(getContentPath('not-a-url')).toBe(null);
    });
  });

  describe('getAemSystemType', () => {
    it('should return "author" for localhost:4502', () => {
      expect(getAemSystemType('http://localhost:4502')).toBe('author');
    });

    it('should return "publish" for localhost:4503', () => {
      expect(getAemSystemType('http://localhost:4503')).toBe('publish');
    });

    it('should return "author" for 127.0.0.1:4502', () => {
      expect(getAemSystemType('http://127.0.0.1:4502')).toBe('author');
    });

    it('should return "publish" for 127.0.0.1:4503', () => {
      expect(getAemSystemType('http://127.0.0.1:4503')).toBe('publish');
    });

    it('should return null for localhost with different port', () => {
      expect(getAemSystemType('http://localhost:8080')).toBe(null);
    });

    it('should use custom author port when provided', () => {
      const settings = { authorPort: '5502', publishPort: '5503' };
      expect(getAemSystemType('http://localhost:5502', settings)).toBe('author');
    });

    it('should use custom publish port when provided', () => {
      const settings = { authorPort: '5502', publishPort: '5503' };
      expect(getAemSystemType('http://localhost:5503', settings)).toBe('publish');
    });

    it('should return null for default port when custom ports are configured', () => {
      const settings = { authorPort: '5502', publishPort: '5503' };
      expect(getAemSystemType('http://localhost:4502', settings)).toBe(null);
    });

    it('should work with 127.0.0.1 and custom ports', () => {
      const settings = { authorPort: '5502', publishPort: '5503' };
      expect(getAemSystemType('http://127.0.0.1:5502', settings)).toBe('author');
      expect(getAemSystemType('http://127.0.0.1:5503', settings)).toBe('publish');
    });

    it('should return "author" for AEM Cloud author URL', () => {
      expect(getAemSystemType('https://author-p12345-e67890.adobeaemcloud.com')).toBe('author');
    });

    it('should return "publish" for AEM Cloud publish URL', () => {
      expect(getAemSystemType('https://publish-p12345-e67890.adobeaemcloud.com')).toBe('publish');
    });

    it('should return null for non-AEM URLs', () => {
      expect(getAemSystemType('https://www.google.com')).toBe(null);
    });

    it('should return null for invalid URLs', () => {
      expect(getAemSystemType('not-a-url')).toBe(null);
    });
  });

  describe('openAemTool', () => {
    let originalSetTimeout;

    beforeEach(() => {
      // Mock window.close
      global.window.close = jest.fn();
      // Mock setTimeout to execute immediately
      originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((cb) => cb());
    });

    afterEach(() => {
      global.setTimeout = originalSetTimeout;
    });

    it('should open tool when valid AEM URL is present', () => {
      const mockTabs = [{ url: 'http://localhost:4502/content/page.html' }];
      chrome.tabs.query.mockImplementation((query, callback) => {
        callback(mockTabs);
      });

      openAemTool('/crx/de', '4502', 'Opening CRXDE...');

      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: 'http://localhost:4502/crx/de'
      });
      expect(window.close).toHaveBeenCalled();
    });

    it('should show error for non-AEM URL', () => {
      const mockTabs = [{ url: 'https://www.google.com' }];
      chrome.tabs.query.mockImplementation((query, callback) => {
        callback(mockTabs);
      });

      openAemTool('/crx/de', '4502', 'Opening CRXDE...');

      expect(chrome.tabs.create).not.toHaveBeenCalled();
      const msg = document.getElementById('message');
      expect(msg.textContent).toBe('Error: Not an AEM or localhost URL!');
    });

    it('should handle missing tab', () => {
      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([]);
      });

      openAemTool('/crx/de', '4502', 'Opening CRXDE...');

      expect(chrome.tabs.create).not.toHaveBeenCalled();
    });

    it('should construct correct URL from AEM Cloud', () => {
      const mockTabs = [{ url: 'https://author-p12345-e67890.adobeaemcloud.com/content/page.html' }];
      chrome.tabs.query.mockImplementation((query, callback) => {
        callback(mockTabs);
      });

      openAemTool('/crx/de', '4502', 'Opening CRXDE...');

      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: 'https://author-p12345-e67890.adobeaemcloud.com:4502/crx/de'
      });
    });
  });

  describe('withValidAemTab', () => {
    it('should call callback with valid AEM tab', (done) => {
      const mockTabs = [{ url: 'http://localhost:4502/content/page.html' }];
      const callback = jest.fn();

      chrome.tabs.query.mockImplementation((query, callback) => {
        callback(mockTabs);
      });

      withValidAemTab(callback);

      // Wait for async operation
      setTimeout(() => {
        expect(callback).toHaveBeenCalledWith(mockTabs[0]);
        done();
      }, 10);
    });

    it('should show error for invalid tab', (done) => {
      const mockTabs = [{ url: 'https://www.google.com' }];
      const callback = jest.fn();

      chrome.tabs.query.mockImplementation((query, callback) => {
        callback(mockTabs);
      });

      withValidAemTab(callback);

      setTimeout(() => {
        expect(callback).not.toHaveBeenCalled();
        const msg = document.getElementById('message');
        expect(msg.textContent).toBe('Error: Not an AEM or localhost URL!');
        done();
      }, 10);
    });
  });

  describe('getValidContentPath', () => {
    it('should call onSuccess with content path when valid', () => {
      const tab = { url: 'http://localhost:4502/content/site/page.html' };
      const onSuccess = jest.fn();
      const onError = 'Error message';

      getValidContentPath(tab, onSuccess, onError);

      expect(onSuccess).toHaveBeenCalledWith('/content/site/page.html');
    });

    it('should show error when no content path found', () => {
      const tab = { url: 'http://localhost:4502/crx/de' };
      const onSuccess = jest.fn();
      const onError = 'Custom error message';

      getValidContentPath(tab, onSuccess, onError);

      expect(onSuccess).not.toHaveBeenCalled();
      const msg = document.getElementById('message');
      expect(msg.textContent).toBe('Custom error message');
    });

    it('should use default error message when not provided', () => {
      const tab = { url: 'http://localhost:4502/crx/de' };
      const onSuccess = jest.fn();

      getValidContentPath(tab, onSuccess);

      expect(onSuccess).not.toHaveBeenCalled();
      const msg = document.getElementById('message');
      expect(msg.textContent).toBe('No content page detected!');
    });
  });

  describe('openDispatcher', () => {
    let originalSetTimeout;

    beforeEach(() => {
      global.window.close = jest.fn();
      originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((cb) => cb());
      chrome.runtime.openOptionsPage = jest.fn();
    });

    afterEach(() => {
      global.setTimeout = originalSetTimeout;
    });

    it('should open dispatcher with base URL only', () => {
      openDispatcher('https://www.example.com');

      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: 'https://www.example.com'
      });
      expect(window.close).toHaveBeenCalled();
    });

    it('should open dispatcher with path', () => {
      openDispatcher('https://www.example.com', '/content/page.html');

      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: 'https://www.example.com/content/page.html'
      });
    });

    it('should remove trailing slash from dispatcher URL', () => {
      openDispatcher('https://www.example.com/', '/content/page.html');

      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: 'https://www.example.com/content/page.html'
      });
    });

    it('should show error with settings link when URL is empty', () => {
      openDispatcher('');

      expect(chrome.tabs.create).not.toHaveBeenCalled();
      const msg = document.getElementById('message');
      expect(msg.innerHTML).toContain('Dispatcher URL not configured');
      expect(msg.innerHTML).toContain('Open Settings');
    });

    it('should show error with settings link when URL is whitespace', () => {
      openDispatcher('   ');

      expect(chrome.tabs.create).not.toHaveBeenCalled();
      const msg = document.getElementById('message');
      expect(msg.innerHTML).toContain('Dispatcher URL not configured');
    });

    it('should open settings when settings link is clicked', () => {
      openDispatcher('');

      const settingsLink = document.getElementById('openSettings');
      expect(settingsLink).toBeTruthy();

      settingsLink.click();
      expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
    });
  });

  describe('Constants', () => {
    it('should export correct port constants', () => {
      expect(PORT_AUTHOR).toBe('4502');
      expect(PORT_PUBLISH).toBe('4503');
    });
  });

  describe('getPortSettings with Cloud IDs', () => {
    it('should return orgId and programId from matched project', async () => {
      const mockProjects = [
        {
          id: '1',
          name: 'Cloud Project',
          pattern: '*.adobeaemcloud.com',
          authorPort: '4502',
          publishPort: '4503',
          dispatcherUrl: 'https://example.com',
          orgId: '1234567@AdobeOrg',
          programId: '12345'
        }
      ];

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ projects: mockProjects });
      });

      const settings = await getPortSettings('https://author-p12345-e67890.adobeaemcloud.com/content/page.html');

      expect(settings.orgId).toBe('1234567@AdobeOrg');
      expect(settings.programId).toBe('12345');
      expect(settings.authorPort).toBe('4502');
      expect(settings.publishPort).toBe('4503');
      expect(settings.dispatcherUrl).toBe('https://example.com');
    });

    it('should return empty orgId and programId when not configured', async () => {
      const mockProjects = [
        {
          id: '1',
          name: 'Local Project',
          pattern: 'localhost',
          authorPort: '4502',
          publishPort: '4503',
          dispatcherUrl: ''
        }
      ];

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ projects: mockProjects });
      });

      const settings = await getPortSettings('http://localhost:4502/content/page.html');

      expect(settings.orgId).toBe('');
      expect(settings.programId).toBe('');
    });

    it('should return default settings with empty cloud IDs when no URL match', async () => {
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ projects: [] });
      });

      const settings = await getPortSettings('http://localhost:4502/content/page.html');

      expect(settings.authorPort).toBe('4502');
      expect(settings.publishPort).toBe('4503');
      expect(settings.dispatcherUrl).toBe('');
      expect(settings.orgId).toBe('');
      expect(settings.programId).toBe('');
    });

    it('should handle project with only orgId configured', async () => {
      const mockProjects = [
        {
          id: '1',
          name: 'Partial Cloud Project',
          pattern: 'localhost',
          authorPort: '4502',
          publishPort: '4503',
          dispatcherUrl: '',
          orgId: '1234567@AdobeOrg'
        }
      ];

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ projects: mockProjects });
      });

      const settings = await getPortSettings('http://localhost:4502/content/page.html');

      expect(settings.orgId).toBe('1234567@AdobeOrg');
      expect(settings.programId).toBe('');
    });
  });

  describe('buildCloudConsoleUrl', () => {
    it('should build home URL with only orgId', () => {
      const url = buildCloudConsoleUrl('1234567@AdobeOrg');
      expect(url).toBe('https://experience.adobe.com/#/@1234567@AdobeOrg/cloud-manager/home.html');
    });

    it('should build program home URL with orgId and programId', () => {
      const url = buildCloudConsoleUrl('1234567@AdobeOrg', '12345');
      expect(url).toBe('https://experience.adobe.com/#/@1234567@AdobeOrg/cloud-manager/home.html/program/12345');
    });

    it('should build environments URL with all parameters', () => {
      const url = buildCloudConsoleUrl('1234567@AdobeOrg', '12345', 'environments');
      expect(url).toBe('https://experience.adobe.com/#/@1234567@AdobeOrg/cloud-manager/environments.html/program/12345');
    });

    it('should build pipelines URL with all parameters', () => {
      const url = buildCloudConsoleUrl('1234567@AdobeOrg', '12345', 'pipelines');
      expect(url).toBe('https://experience.adobe.com/#/@1234567@AdobeOrg/cloud-manager/pipelines.html/program/12345');
    });

    it('should build activity URL with all parameters', () => {
      const url = buildCloudConsoleUrl('1234567@AdobeOrg', '12345', 'activity');
      expect(url).toBe('https://experience.adobe.com/#/@1234567@AdobeOrg/cloud-manager/activity.html/program/12345');
    });

    it('should handle null programId gracefully', () => {
      const url = buildCloudConsoleUrl('1234567@AdobeOrg', null);
      expect(url).toBe('https://experience.adobe.com/#/@1234567@AdobeOrg/cloud-manager/home.html');
    });

    it('should handle null path gracefully', () => {
      const url = buildCloudConsoleUrl('1234567@AdobeOrg', '12345', null);
      expect(url).toBe('https://experience.adobe.com/#/@1234567@AdobeOrg/cloud-manager/home.html/program/12345');
    });
  });

  describe('showCloudNotConfiguredError', () => {
    beforeEach(() => {
      chrome.runtime.openOptionsPage = jest.fn();
    });

    it('should show default error message with settings link', () => {
      showCloudNotConfiguredError();

      const msg = document.getElementById('message');
      expect(msg.innerHTML).toContain('AEM Cloud settings not configured');
      expect(msg.innerHTML).toContain('Open Settings');
      expect(msg.classList.contains('mint')).toBe(true);
    });

    it('should show custom error message with settings link', () => {
      showCloudNotConfiguredError('Organization ID not configured');

      const msg = document.getElementById('message');
      expect(msg.innerHTML).toContain('Organization ID not configured');
      expect(msg.innerHTML).toContain('Open Settings');
    });

    it('should open settings when settings link is clicked', () => {
      showCloudNotConfiguredError('Test error');

      const settingsLink = document.getElementById('openSettings');
      expect(settingsLink).toBeTruthy();

      settingsLink.click();
      expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
    });

    it('should create clickable link element', () => {
      showCloudNotConfiguredError();

      const settingsLink = document.getElementById('openSettings');
      expect(settingsLink.tagName).toBe('A');
      expect(settingsLink.style.color).toBe('rgb(102, 126, 234)');
      expect(settingsLink.style.textDecoration).toBe('underline');
    });
  });

  describe('openCloudTool', () => {
    beforeEach(() => {
      global.window.close = jest.fn();
    });

    it('should open home tool with only orgId', (done) => {
      const mockProjects = [
        {
          id: '1',
          name: 'Cloud Project',
          pattern: 'localhost',
          authorPort: '4502',
          publishPort: '4503',
          dispatcherUrl: '',
          orgId: '1234567@AdobeOrg',
          programId: ''
        }
      ];

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ projects: mockProjects });
      });

      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ url: 'http://localhost:4502/content/page.html' }]);
      });

      openCloudTool('home', 'Opening Cloud Manager Overview...');

      setTimeout(() => {
        expect(chrome.tabs.create).toHaveBeenCalledWith({
          url: 'https://experience.adobe.com/#/@1234567@AdobeOrg/cloud-manager/home.html'
        });
        expect(window.close).toHaveBeenCalled();
        done();
      }, 200);
    });

    it('should open programs tool with orgId', (done) => {
      const mockProjects = [
        {
          id: '1',
          name: 'Cloud Project',
          pattern: 'localhost',
          authorPort: '4502',
          publishPort: '4503',
          dispatcherUrl: '',
          orgId: '1234567@AdobeOrg',
          programId: ''
        }
      ];

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ projects: mockProjects });
      });

      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ url: 'http://localhost:4502/content/page.html' }]);
      });

      openCloudTool('programs', 'Opening Programs...');

      setTimeout(() => {
        expect(chrome.tabs.create).toHaveBeenCalledWith({
          url: 'https://experience.adobe.com/#/@1234567@AdobeOrg/cloud-manager/programs.html'
        });
        done();
      }, 200);
    });

    it('should open environments tool with orgId and programId', (done) => {
      const mockProjects = [
        {
          id: '1',
          name: 'Cloud Project',
          pattern: 'localhost',
          authorPort: '4502',
          publishPort: '4503',
          dispatcherUrl: '',
          orgId: '1234567@AdobeOrg',
          programId: '12345'
        }
      ];

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ projects: mockProjects });
      });

      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ url: 'http://localhost:4502/content/page.html' }]);
      });

      openCloudTool('environments', 'Opening Environments...');

      setTimeout(() => {
        expect(chrome.tabs.create).toHaveBeenCalledWith({
          url: 'https://experience.adobe.com/#/@1234567@AdobeOrg/cloud-manager/environments.html/program/12345'
        });
        done();
      }, 200);
    });

    it('should open pipelines tool with orgId and programId', (done) => {
      const mockProjects = [
        {
          id: '1',
          name: 'Cloud Project',
          pattern: 'localhost',
          authorPort: '4502',
          publishPort: '4503',
          dispatcherUrl: '',
          orgId: '1234567@AdobeOrg',
          programId: '12345'
        }
      ];

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ projects: mockProjects });
      });

      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ url: 'http://localhost:4502/content/page.html' }]);
      });

      openCloudTool('pipelines', 'Opening Pipelines...');

      setTimeout(() => {
        expect(chrome.tabs.create).toHaveBeenCalledWith({
          url: 'https://experience.adobe.com/#/@1234567@AdobeOrg/cloud-manager/pipelines.html/program/12345'
        });
        done();
      }, 200);
    });

    it('should open activity tool with orgId and programId', (done) => {
      const mockProjects = [
        {
          id: '1',
          name: 'Cloud Project',
          pattern: 'localhost',
          authorPort: '4502',
          publishPort: '4503',
          dispatcherUrl: '',
          orgId: '1234567@AdobeOrg',
          programId: '12345'
        }
      ];

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ projects: mockProjects });
      });

      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ url: 'http://localhost:4502/content/page.html' }]);
      });

      openCloudTool('activity', 'Opening Activity...');

      setTimeout(() => {
        expect(chrome.tabs.create).toHaveBeenCalledWith({
          url: 'https://experience.adobe.com/#/@1234567@AdobeOrg/cloud-manager/activity.html/program/12345'
        });
        done();
      }, 200);
    });

    it('should show error when orgId is not configured', (done) => {
      const mockProjects = [
        {
          id: '1',
          name: 'Local Project',
          pattern: 'localhost',
          authorPort: '4502',
          publishPort: '4503',
          dispatcherUrl: ''
        }
      ];

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ projects: mockProjects });
      });

      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ url: 'http://localhost:4502/content/page.html' }]);
      });

      openCloudTool('home', 'Opening Cloud Manager Overview...');

      setTimeout(() => {
        expect(chrome.tabs.create).not.toHaveBeenCalled();
        const msg = document.getElementById('message');
        expect(msg.innerHTML).toContain('Organization ID not configured');
        done();
      }, 200);
    });

    it('should show error when programId is not configured for environments', (done) => {
      const mockProjects = [
        {
          id: '1',
          name: 'Cloud Project',
          pattern: 'localhost',
          authorPort: '4502',
          publishPort: '4503',
          dispatcherUrl: '',
          orgId: '1234567@AdobeOrg'
        }
      ];

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ projects: mockProjects });
      });

      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ url: 'http://localhost:4502/content/page.html' }]);
      });

      openCloudTool('environments', 'Opening Environments...');

      setTimeout(() => {
        expect(chrome.tabs.create).not.toHaveBeenCalled();
        const msg = document.getElementById('message');
        expect(msg.innerHTML).toContain('Program ID not configured');
        done();
      }, 200);
    });

    it('should show error when programId is not configured for pipelines', (done) => {
      const mockProjects = [
        {
          id: '1',
          name: 'Cloud Project',
          pattern: 'localhost',
          authorPort: '4502',
          publishPort: '4503',
          dispatcherUrl: '',
          orgId: '1234567@AdobeOrg'
        }
      ];

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ projects: mockProjects });
      });

      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ url: 'http://localhost:4502/content/page.html' }]);
      });

      openCloudTool('pipelines', 'Opening Pipelines...');

      setTimeout(() => {
        expect(chrome.tabs.create).not.toHaveBeenCalled();
        const msg = document.getElementById('message');
        expect(msg.innerHTML).toContain('Program ID not configured');
        done();
      }, 200);
    });

    it('should show error when programId is not configured for activity', (done) => {
      const mockProjects = [
        {
          id: '1',
          name: 'Cloud Project',
          pattern: 'localhost',
          authorPort: '4502',
          publishPort: '4503',
          dispatcherUrl: '',
          orgId: '1234567@AdobeOrg'
        }
      ];

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ projects: mockProjects });
      });

      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ url: 'http://localhost:4502/content/page.html' }]);
      });

      openCloudTool('activity', 'Opening Activity...');

      setTimeout(() => {
        expect(chrome.tabs.create).not.toHaveBeenCalled();
        const msg = document.getElementById('message');
        expect(msg.innerHTML).toContain('Program ID not configured');
        done();
      }, 200);
    });

    it('should show error for unknown cloud tool path', (done) => {
      const mockProjects = [
        {
          id: '1',
          name: 'Cloud Project',
          pattern: 'localhost',
          authorPort: '4502',
          publishPort: '4503',
          dispatcherUrl: '',
          orgId: '1234567@AdobeOrg',
          programId: '12345'
        }
      ];

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ projects: mockProjects });
      });

      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ url: 'http://localhost:4502/content/page.html' }]);
      });

      openCloudTool('unknown-tool', 'Opening Unknown...');

      setTimeout(() => {
        expect(chrome.tabs.create).not.toHaveBeenCalled();
        const msg = document.getElementById('message');
        expect(msg.textContent).toContain('Unknown cloud tool');
        done();
      }, 200);
    });

    it('should handle empty orgId as not configured', (done) => {
      const mockProjects = [
        {
          id: '1',
          name: 'Cloud Project',
          pattern: 'localhost',
          authorPort: '4502',
          publishPort: '4503',
          dispatcherUrl: '',
          orgId: '',
          programId: '12345'
        }
      ];

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ projects: mockProjects });
      });

      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ url: 'http://localhost:4502/content/page.html' }]);
      });

      openCloudTool('home', 'Opening Cloud Manager Overview...');

      setTimeout(() => {
        expect(chrome.tabs.create).not.toHaveBeenCalled();
        const msg = document.getElementById('message');
        expect(msg.innerHTML).toContain('Organization ID not configured');
        done();
      }, 200);
    });

    it('should handle empty programId as not configured', (done) => {
      const mockProjects = [
        {
          id: '1',
          name: 'Cloud Project',
          pattern: 'localhost',
          authorPort: '4502',
          publishPort: '4503',
          dispatcherUrl: '',
          orgId: '1234567@AdobeOrg',
          programId: ''
        }
      ];

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ projects: mockProjects });
      });

      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ url: 'http://localhost:4502/content/page.html' }]);
      });

      openCloudTool('environments', 'Opening Environments...');

      setTimeout(() => {
        expect(chrome.tabs.create).not.toHaveBeenCalled();
        const msg = document.getElementById('message');
        expect(msg.innerHTML).toContain('Program ID not configured');
        done();
      }, 200);
    });
  });
});

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

  describe('getPortSettings', () => {
    it('should return default ports when storage is empty', async () => {
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({});
      });

      const settings = await getPortSettings();
      expect(settings.authorPort).toBe('4502');
      expect(settings.publishPort).toBe('4503');
      expect(settings.dispatcherUrl).toBe('');
    });

    it('should return custom ports when stored', async () => {
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ authorPort: '5502', publishPort: '5503', dispatcherUrl: 'https://example.com' });
      });

      const settings = await getPortSettings();
      expect(settings.authorPort).toBe('5502');
      expect(settings.publishPort).toBe('5503');
      expect(settings.dispatcherUrl).toBe('https://example.com');
    });

    it('should use default for missing authorPort', async () => {
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ publishPort: '5503' });
      });

      const settings = await getPortSettings();
      expect(settings.authorPort).toBe('4502');
      expect(settings.publishPort).toBe('5503');
    });

    it('should use default for missing publishPort', async () => {
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ authorPort: '5502' });
      });

      const settings = await getPortSettings();
      expect(settings.authorPort).toBe('5502');
      expect(settings.publishPort).toBe('4503');
    });

    it('should handle chrome.runtime.lastError', async () => {
      // Suppress console.warn for this test
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        chrome.runtime = { lastError: new Error('Storage error') };
        callback({});
      });

      const settings = await getPortSettings();
      expect(settings.authorPort).toBe('4502');
      expect(settings.publishPort).toBe('4503');

      // Verify warning was called
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Error getting settings:',
        expect.any(Error)
      );

      // Clean up
      consoleWarnSpy.mockRestore();
      chrome.runtime = {};
    });

    it('should handle missing chrome.storage.sync', async () => {
      const originalSync = chrome.storage.sync;
      delete chrome.storage.sync;

      const settings = await getPortSettings();
      expect(settings.authorPort).toBe('4502');
      expect(settings.publishPort).toBe('4503');

      // Restore
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
    beforeEach(() => {
      // Mock window.close
      global.window.close = jest.fn();
      // Mock setTimeout to execute immediately
      global.setTimeout = jest.fn((cb) => cb());
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
    it('should call callback with valid AEM tab', () => {
      const mockTabs = [{ url: 'http://localhost:4502/content/page.html' }];
      const callback = jest.fn();

      chrome.tabs.query.mockImplementation((query, callback) => {
        callback(mockTabs);
      });

      withValidAemTab(callback);

      // Wait for async operation
      setTimeout(() => {
        expect(callback).toHaveBeenCalledWith(mockTabs[0]);
      }, 0);
    });

    it('should show error for invalid tab', () => {
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
      }, 0);
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
    beforeEach(() => {
      global.window.close = jest.fn();
      global.setTimeout = jest.fn((cb) => cb());
      chrome.runtime.openOptionsPage = jest.fn();
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
});

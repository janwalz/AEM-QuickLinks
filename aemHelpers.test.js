import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  showMessage,
  isCloudOrLocalhost,
  getContentPath,
  getAemSystemType,
  openAemTool,
  withValidAemTab,
  getValidContentPath,
  PORT_AUTHOR,
  PORT_PUBLISH
} from './aemHelpers.js';

// Mock Chrome API
global.chrome = {
  tabs: {
    query: jest.fn(),
    create: jest.fn()
  }
};

describe('aemHelpers', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '<div id="message"></div>';
    // Reset mocks
    jest.clearAllMocks();
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

  describe('Constants', () => {
    it('should export correct port constants', () => {
      expect(PORT_AUTHOR).toBe('4502');
      expect(PORT_PUBLISH).toBe('4503');
    });
  });
});

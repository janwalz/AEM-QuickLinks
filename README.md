# AEM QuickLinks Extension

![Tests](https://github.com/YOURUSERNAME/aem-extension/actions/workflows/test.yml/badge.svg)

A Chrome extension for quick access to AEM (Adobe Experience Manager) tools and actions from any page.

## Features

### Main Menu Actions
- **CRXDE** - Open CRXDE Lite
- **Package Manager** - Access the CRX Package Manager
- **OSGi Config** - Open the OSGi Configuration Manager
- **Groovy Console** - Launch the Groovy Console
- **Replication Default Agent** - Open the default replication agent
- **Login on Publish** - Access the publish instance login page

### Current Page Submenu
When on an AEM content page, access additional context-aware actions:
- **Open in CRXDE** - Opens CRXDE with the current page's node selected (falls back to standard CRXDE if no content page detected)
- **Open in Author** - Opens the current page on the Author instance
- **Open in Publish** - Opens the current page on the Publish instance
- **Open in Edit View** - Opens the page in AEM's Page Editor
- **View as Published** - Opens the page with `wcmmode=disabled` parameter
- **Open Page Properties** - Access the page properties dialog

### Additional Features
- **Searchable Actions** - Type to filter and quickly find any action
- **Keyboard Navigation** - Full keyboard support for efficient navigation
- **AEM Cloud & Localhost Support** - Works with both AEM Cloud instances and local development environments

## Keyboard Shortcuts

### Global
- **Ctrl+Y** - Open the extension popup

### Navigation (when popup is open)
- **Type to search** - Filter actions by name
- **Arrow Up/Down** - Navigate through actions
- **Enter** - Execute selected action
- **Escape** - Go back to main menu / clear search / close popup
- **Home** - Jump to first action
- **End** - Jump to last action
- **Page Up/Down** - Skip 5 actions at a time

## Supported AEM Environments
- **AEM Cloud**: `author-p*-e*.adobeaemcloud.com` and `publish-p*-e*.adobeaemcloud.com`
- **Localhost**: `localhost:4502` (Author) and `localhost:4503` (Publish)

## Installation (Development)
1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable "Developer mode" (top right).
4. Click "Load unpacked" and select the extension folder.
5. The extension icon will appear in your toolbar.

## Usage
1. Navigate to any AEM page (or use Ctrl+Y from anywhere)
2. Click the extension icon or press **Ctrl+Y**
3. Search for an action or use keyboard navigation
4. Press **Enter** or click to execute the action

## Development

### Running Tests
```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Test Coverage
The project includes comprehensive unit tests for utility functions in `aemHelpers.js`:
- 62 tests covering all major functionality
- 100% code coverage for critical utility functions
- Automated testing via GitHub Actions on every commit
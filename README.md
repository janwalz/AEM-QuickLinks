# AEM QuickLinks Extension

[![Run Tests](https://github.com/janwalz/AEM-QuickLinks/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/janwalz/AEM-QuickLinks/actions/workflows/test.yml)

A Chrome extension for quick access to AEM (Adobe Experience Manager) tools and actions from any page.

## Features

### Main Menu Actions
- **Current Page** - Submenu with page-specific actions (see below)
- **AEM Cloud** - Submenu with AEM Cloud Manager tools (see below)
- **CRXDE** - Open CRXDE Lite
- **Package Manager** - Access the CRX Package Manager
- **OSGi Config** - Open the OSGi Configuration Manager
- **Groovy Console** - Launch the Groovy Console
- **Replication Default Agent** - Open the default replication agent
- **Login on Publish** - Access the publish instance login page
- **Dispatcher** - Open your configured Dispatcher URL

### Current Page Submenu
When on an AEM content page, access additional context-aware actions:
- **Open in CRXDE** - Opens CRXDE with the current page's node selected (falls back to standard CRXDE if no content page detected)
- **Open in Author** - Opens the current page on the Author instance
- **Open in Publish** - Opens the current page on the Publish instance
- **Open in Dispatcher** - Opens the current page on your configured Dispatcher
- **Open in Edit View** - Opens the page in AEM's Page Editor
- **View as Published** - Opens the page with `wcmmode=disabled` parameter
- **Open Page Properties** - Access the page properties dialog

### AEM Cloud Submenu
Quick access to AEM Cloud Manager console tools (requires Organization ID and Program ID configuration):
- **Cloud Manager Overview** - Open the Cloud Manager home page
- **Programs** - View all your AEM Cloud programs
- **Environments** - Access the environments for your configured program
- **Pipelines** - Manage and run CI/CD pipelines
- **Activity** - View deployment and pipeline activity history

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

## Settings

The extension supports multiple project configurations with automatic URL matching.

### Multi-Project Configuration

1. Right-click the extension icon and select **Options**
2. Click **Add Project** to create a new project configuration
3. Configure each project with:
   - **Project Name** - A friendly name to identify the project
   - **URL Pattern** - Domain pattern to match (supports * wildcard)
     - Examples: `localhost`, `example.com`, `*.adobeaemcloud.com`
     - Use `*` to match subdomains (e.g., `author-p12345-*.adobeaemcloud.com`)
   - **Author Port** (default: 4502) - Port for Author instance
   - **Publish Port** (default: 4503) - Port for Publish instance
   - **Dispatcher URL** - Base URL for your Dispatcher (e.g., https://www.yoursite.com)
   - **Adobe Organization ID** (optional) - Your Adobe organization ID for Cloud Manager links (e.g., `1234567@AdobeOrg`)
   - **AEM Cloud Program ID** (optional) - Your Cloud Manager program ID for direct environment/pipeline links
4. The extension automatically detects which project to use based on the current URL

### Pattern Matching

- Patterns match the hostname of the current URL
- The first matching project in your list is used
- **Tip:** Order matters! Place more specific patterns before general wildcard patterns
  - Example: List `author-p12345-e67890.adobeaemcloud.com` before `*.adobeaemcloud.com`
- Wildcard `*` matches one or more characters (but not dots)
  - `*.adobeaemcloud.com` matches `author-p12345-e67890.adobeaemcloud.com`
  - `*.adobeaemcloud.com` does NOT match `adobeaemcloud.com`

### Multiple Localhost Projects

You can configure multiple projects with the same `localhost` pattern but different ports:
- The extension matches based on the **current port** in your browser URL
- Example: If you're on `http://localhost:5502`, it matches the project with authorPort `5502` or publishPort `5503`
- If you have both `localhost:4502` and `localhost:5502` projects, the extension automatically selects the correct one
- **Important:** Patterns `localhost` and `127.0.0.1` are treated as different - create separate projects if you use both

### Migration from Old Settings

If you're upgrading from a previous version, your old settings will be automatically migrated to a "Default Project" with a localhost pattern.

### Finding Your Cloud Manager IDs

To use the AEM Cloud Console features, you need to configure your Organization ID and Program ID:

1. **Organization ID**:
   - Log in to [Adobe Experience Cloud](https://experience.adobe.com)
   - Look at the URL - it will contain your org ID (format: `1234567@AdobeOrg`)
   - Or find it in Cloud Manager URL: `https://experience.adobe.com/#/@{orgId}/cloud-manager/...`

2. **Program ID**:
   - Open Cloud Manager and select your program
   - The URL will show the program ID: `.../program/{programId}`
   - Usually a numeric value like `12345`

**Important Notes:**
- The Dispatcher URL must be configured to use dispatcher-related buttons
- Organization ID is required for all AEM Cloud Console tools
- Program ID is required for Environments, Pipelines, and Activity tools
- If not configured, you'll see an error with a link to the settings page

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
- 98 tests covering all major functionality including multi-project support with port-based matching
- 98% code coverage for critical utility functions
- Automated testing via GitHub Actions on every commit
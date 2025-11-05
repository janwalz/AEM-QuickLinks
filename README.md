# AEM QuickLinks Extension

[![Run Tests](https://github.com/janwalz/AEM-QuickLinks/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/janwalz/AEM-QuickLinks/actions/workflows/test.yml)

Chrome extension for quick access to AEM (Adobe Experience Manager) tools with keyboard shortcuts and multi-project support.

<img width="282" height="563" alt="image" src="https://github.com/user-attachments/assets/3b9b669f-ca3c-480a-89b3-ea886e05dfe2" />

## Features

- **AEM Tools** - CRXDE, Package Manager, OSGi Config, Groovy Console, Replication Agent, Publish Login
- **Current Page Actions** - Open in CRXDE/Author/Publish/Dispatcher/Editor, View as Published, Page Properties
- **AEM Cloud Console** - Environment Details, Environments, Pipelines, Activity (auto-extracts IDs from URLs)
- **Smart Search** - Type to filter any action
- **Keyboard Navigation** - Full keyboard support (`Ctrl+Y` to open, arrows/enter/escape)
- **Multi-Project Config** - Automatic URL pattern matching with port-aware localhost support

## Quick Start

1. Install extension in Chrome (`chrome://extensions` → Load unpacked)
2. Press `Ctrl+Y` on any page or click the extension icon
3. Navigate with keyboard or search, press Enter to execute

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Y` | Open popup |
| `↑` / `↓` | Navigate actions |
| `Enter` | Execute action |
| `Escape` | Back / Clear search / Close |
| `Home` / `End` | Jump to first/last |
| `PgUp` / `PgDn` | Skip 5 actions |

## Configuration

### Multi-Project Setup

Right-click extension icon → **Options** → **Add Project**

Configure for each AEM environment:
- **Project Name** - Friendly identifier
- **URL Pattern** - Hostname pattern (supports `*` wildcard)
- **Author/Publish Ports** - Default: 4502/4503
- **Dispatcher URL** - Base URL (e.g., `https://www.yoursite.com`)
- **Adobe Org ID** - For Cloud Manager (e.g., `1234567@AdobeOrg`)
- **AEM Cloud Program ID** - For Cloud Manager (e.g., `12345`)

### URL Pattern Matching Logic

The extension uses **first-match-wins** pattern matching:

**Pattern Syntax:**
- `*` = wildcard matching one or more characters (excluding dots)
- `*.adobeaemcloud.com` matches `author-p12345-e67890.adobeaemcloud.com`
- `*.adobeaemcloud.com` does NOT match `adobeaemcloud.com` (missing subdomain)
- `localhost` matches localhost on any port

**Matching Priority:**
1. **Hostname Match** - Pattern must match current URL hostname
2. **Port Match (localhost only)** - For `localhost` or `127.0.0.1`, the current port must match either authorPort or publishPort
3. **First Match** - First matching project in your list wins

**Examples:**

| Current URL | Pattern | Matches? | Reason |
|-------------|---------|----------|--------|
| `http://localhost:4502/...` | `localhost` (ports: 4502/4503) | ✅ Yes | Hostname and port match |
| `http://localhost:5502/...` | `localhost` (ports: 4502/4503) | ❌ No | Port doesn't match |
| `http://localhost:5502/...` | `localhost` (ports: 5502/5503) | ✅ Yes | Port matches author |
| `https://author-p12345-e67890.adobeaemcloud.com/...` | `*.adobeaemcloud.com` | ✅ Yes | Wildcard matches subdomain |
| `https://author-p12345-e67890.adobeaemcloud.com/...` | `author-p12345-*.adobeaemcloud.com` | ✅ Yes | Specific wildcard matches |

**Best Practices:**
- Order matters! Place specific patterns before wildcards
- For multiple localhost projects with different ports, use same pattern but different port configs
- Use fallback project for non-AEM URLs (set via checkbox)

### Cloud Manager ID Auto-Extraction

The extension automatically extracts Cloud Manager IDs from URLs:

**From Cloud Manager URLs (`experience.adobe.com`):**
- Org ID from: `#/@{orgId}/cloud-manager/...`
- Program ID from: `.../program/{programId}/...`

**From AEM Cloud Instance URLs (`*.adobeaemcloud.com`):**
- Program ID from: `author-p{programId}-e{envId}.adobeaemcloud.com`
- Environment ID from: `author-p{programId}-e{envId}.adobeaemcloud.com`

**Priority:** URL-extracted IDs override configured IDs. Configure IDs in settings only if not already in Cloud Manager/instance URLs.

## Development

```bash
npm install        # Install dependencies
npm test           # Run tests
npm run test:watch # Run tests in watch mode
```

**Test Coverage:** 98 tests with 98% coverage for `aemHelpers.js` (multi-project matching, URL parsing, ID extraction)

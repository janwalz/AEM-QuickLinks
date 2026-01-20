# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm install          # Install dependencies
npm run build        # Bundle popup.js → popup.bundle.js (required before testing in browser)
npm run watch        # Auto-rebuild on file changes during development
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
```

**IMPORTANT:** Always run `npm run build` after modifying any JS file. The extension loads `popup.bundle.js`, not the source files directly.

## Architecture

Chrome Manifest V3 extension for AEM (Adobe Experience Manager) quick navigation.

**Core Files:**
- `popup.js` → `aemHelpers.js` → `options.js` (bundled to `popup.bundle.js` via esbuild)
- `manifest.json` - Extension manifest (V3)
- `options.html/js` - Settings page for multi-project configuration

**Module Responsibilities:**
- `popup.js` - UI state management, keyboard navigation, button handlers. Uses `PopupState` class for menu state.
- `aemHelpers.js` - Core logic: URL matching, AEM system detection, Cloud Manager ID extraction, tab operations. Main exports: `getPortSettings()`, `matchUrlToProject()`, `openAemTool()`, `withValidAemTab()`.
- `options.js` - Chrome storage interface for projects. Exports `getProjects()`, `saveProjects()`.

**Key Patterns:**
- URL pattern matching uses `*` wildcard (matches non-dot chars): `*.adobeaemcloud.com`
- Localhost matching requires port to match configured author/publish ports
- First-match-wins for project selection
- Cloud Manager IDs auto-extracted from URLs when available

**Testing:**
- Jest with jsdom for DOM simulation
- Tests in `*.test.js` files alongside source
- Run single test: `npm test -- --testNamePattern="pattern"`

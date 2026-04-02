# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Lint JavaScript and CSS
npm run lint

# Fix lint issues automatically
npm run lint:fix

# Lint only JS
npm run lint:js

# Lint only CSS
npm run lint:css

# Build merged component JSON files
npm run build:json
```

### Local Development

Requires Node.js 18.3.x+ and AEM CLI:

```bash
npm install -g @adobe/aem-cli
aem up  # Starts local proxy at localhost:3000
```

The project does not have a standalone dev server — local development requires the AEM CLI proxy, which connects to the AEM Cloud Service backend defined in `fstab.yaml`.

## Architecture

This is an **AEM Edge Delivery Services** (Franklin/Helix) project. Content is authored in AEM Cloud Service and delivered via edge CDN. The production host is `www.xwalk.abrdns.com`.

### Block-Based Component System

Each UI component is a "block" in `/blocks/`. Blocks are self-contained:
- `blockname.js` — decorates the server-rendered HTML DOM
- `blockname.css` — scoped styles
- `_blockname.json` — content model definition for the AEM WYSIWYG editor

Blocks receive a plain HTML element and transform it in-place via `decorate(block)` exports. There is no virtual DOM or component lifecycle — it's direct DOM manipulation.

### Loading Pipeline

`scripts/scripts.js` orchestrates three loading phases:
1. **Eager** — above-the-fold content, LCP image, critical styles
2. **Lazy** — blocks, header/footer, lazy styles (after first contentful paint)
3. **Delayed** — analytics, third-party scripts (`scripts/delayed.js`)

Core utilities live in `scripts/aem.js` (loaded before `scripts.js`). This file provides `decorateBlocks()`, `loadBlock()`, `createOptimizedPicture()`, and RUM telemetry helpers.

### Content Models

Component definitions are split across per-block `_blockname.json` files and merged into root-level JSON at build time:
- `component-definition.json` — merged from `models/_component-definition.json`
- `component-models.json` — merged from `models/_component-models.json`
- `component-filters.json` — merged from `models/_component-filters.json`

Run `npm run build:json` after editing any model files. The merged output files are what AEM reads.

### Styling

Global design tokens are CSS custom properties defined in `styles/styles.css` (colors, fonts, spacing, breakpoints). Block CSS should use these variables rather than hardcoding values. Font declarations are in `styles/fonts.css`. Non-critical styles go in `styles/lazy-styles.css`.

### Content Mounting

`fstab.yaml` maps the site root to an AEM Cloud Service instance. The `paths.json` file maps AEM content paths (e.g., `/content/xwalk-test/`) to URL paths. Changes to these files affect content routing.

### CI

GitHub Actions (`.github/workflows/main.yaml`) runs `npm run lint` on every push. PRs must pass lint before merge.

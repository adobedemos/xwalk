# Project Overview

This project is built using **AEM Edge Delivery Services**. Content is authored in AEM Cloud Service and delivered through an edge CDN.

**Production host:** `www.xwalk.abrdns.com`

## Architecture

The project follows a **block-based component model**:

- Each component lives under `/blocks/`
- Blocks are self-contained and include:
  - `blockname.js` — DOM transformation logic
  - `blockname.css` — scoped styles
  - `_blockname.json` — content model for AEM authoring

Blocks receive server-rendered HTML and enhance it directly via DOM manipulation. There is no virtual DOM or framework layer.

## Loading Strategy

The main loading pipeline is managed in `scripts/scripts.js`:

1. **Eager** — critical content and styles  
2. **Lazy** — blocks, header/footer, deferred styles  
3. **Delayed** — analytics and third-party scripts  

Core utilities are provided by `scripts/aem.js`.

## Development

### Overview

This project does not include a standalone development server. Instead, local development is performed using the **AEM CLI proxy**, which connects your local environment to an AEM Cloud Service backend defined in `fstab.yaml`.

All development is done against real content coming from AEM, while frontend behavior is implemented through block-based JavaScript and CSS.

---

### Prerequisites

Ensure the following are installed:

- **Node.js 18.3.x or higher**
- **AEM CLI**

Install AEM CLI globally:

```bash
npm install -g @adobe/aem-cli
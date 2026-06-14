# GenLayer Codegen

GenLayer Codegen is a static, single-page contract generator for the GenLayer ecosystem. It turns plain-English ideas into Studio-ready contract templates and keeps the whole experience framework-free.

## What this repository contains

- [`index.html`](./index.html) - the full UI, template selector, contract builders, and download/copy logic
- [`favicon.png`](./favicon.png) - the site icon
- [`netlify/functions/oracle.js`](./netlify/functions/oracle.js) - the serverless oracle used for live condition checks
- [`netlify.toml`](./netlify.toml) - the Netlify deployment config
- [`README.md`](./README.md) - this build and repo guide

## What the app does

1. A user opens the HTML page in a browser.
2. The page presents GenLayer contract types and a custom contract flow.
3. The user picks a preset or writes a plain-English idea.
4. The client-side generators in `index.html` build the contract text directly in the browser.
5. The app can generate schema-safe contract drafts for patterns like:
   - prediction/oracle contracts
   - bounty and task contracts
   - escrow and split payments
   - multisig treasury logic
   - subscriptions, crowdfunds, timelocks, and other custom templates
6. The output can be copied or downloaded for use in GenLayer Studio.

## How it was built

This project was built as a lightweight static app instead of a framework-based application.

- The UI and all template generation live in one HTML file.
- Contract templates are assembled by plain JavaScript functions inside `index.html`.
- The app includes custom validation so the generated output stays usable for Studio.
- The `oracle.js` Netlify function handles public-data checks that some contract templates rely on.
- There is no bundler, transpiler, or frontend build pipeline.

## Oracle function

The serverless function at `netlify/functions/oracle.js` supports condition checks for:

- crypto price conditions using CoinGecko
- sports result lookups
- news/event style checks
- generic web/source checks

It returns structured JSON responses that the app can use when a template needs an external condition or fallback summary.

## File-by-file summary

- `index.html` handles the entire browser app, including:
  - template selection
  - custom idea entry
  - contract assembly
  - copy/download actions
  - theme switching
  - oracle URL construction
- `netlify/functions/oracle.js` implements the public-data oracle endpoint.
- `netlify.toml` tells Netlify to serve the root folder and the `netlify/functions` directory.
- `favicon.png` is the app branding asset.

## Local development

Because this is a static site, you can run it with any simple file server.

### Option 1: Python

```bash
python -m http.server 8000
```

### Option 2: Node-based static server

```bash
npx serve .
```

Open the local URL in a browser after starting the server.

## Oracle testing locally

If you want to run the Netlify function locally, use Netlify CLI:

```bash
npm install -g netlify-cli
netlify dev
```

That serves the static app and the `netlify/functions/oracle.js` endpoint together.

## Deployment

Deploy this repository to Netlify with:

- publish directory: repository root
- functions directory: `netlify/functions`

No build step is required. The deployable app is the checked-in HTML, the favicon, the Netlify function, and the config file.

# GenLayer Codegen

GenLayer Codegen is a static web app that generates GenLayer-ready contract templates from plain-English prompts.

## What is in this repo

- `index.html` - the full client app UI and generation workflow
- `favicon.png` - app icon
- `netlify/functions/oracle.js` - serverless function used for live oracle checks and condition handling
- `netlify.toml` - Netlify deployment config

## How it works

1. The user opens `index.html`.
2. The UI lets them choose a template or write a custom contract request.
3. The page builds a GenLayer contract draft in the browser.
4. The Netlify function at `netlify/functions/oracle.js` is available for public-data checks such as:
   - crypto price conditions
   - sports results
   - news or web checks
5. The generated output is designed to be copied into GenLayer Studio or adapted into a deployable contract file.

## Local development

This project is intentionally lightweight and does not require a framework build step.

### 1. Open the app locally

You can serve the folder with any static file server, for example:

```bash
npx serve .
```

or with Python:

```bash
python -m http.server 8000
```

Then open the local URL in a browser.

### 2. Run Netlify functions locally

If you want to test the oracle function, use the Netlify CLI:

```bash
npm install -g netlify-cli
netlify dev
```

That serves the static app and the `netlify/functions/oracle.js` endpoint together.

## Deployment

Deploy the repo to Netlify with:

- publish directory: repository root
- functions directory: `netlify/functions`

The app does not need a compile step. The build is just the checked-in HTML, assets, and serverless function.

## Notes

- The project is a single-page static generator.
- There is no frontend framework or bundler.
- The behavior lives mostly in `index.html` and `netlify/functions/oracle.js`.

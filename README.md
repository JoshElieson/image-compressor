# Squeeze

A simple, private image compressor that runs entirely in your browser. Images are never uploaded anywhere.

## Features

- Drag & drop or click to upload
- Compression levels: **High**, **Medium**, **Low** (with estimated output size for each)
- Output formats: Auto, JPEG, WebP, PNG
- Before/after preview and download

Supported inputs: JPEG, PNG, WebP, GIF, BMP, AVIF, SVG, TIFF, HEIC/HEIF (browser-dependent).

## Run locally

Open `index.html` in your browser, or serve this folder:

```bash
npx serve .
```

## Deploy

Static site — works on [GitHub Pages](https://pages.github.com/) or [Vercel](https://vercel.com/). No build step required.

## Files

- `index.html` — page structure
- `styles.css` — styles
- `app.js` — compression logic

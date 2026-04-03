# Power Automate Force `v3=false`

Minimal Chrome/Edge extension (Manifest V3) that ensures Power Automate flow and run URLs use `v3=false` when you edit or view a flow (or a run).

**Developer:** [Helvety](https://helvety.com)

## What it does

- Runs only on `https://make.powerautomate.com/*` (see `manifest.json` → `content_scripts`).
- Only changes URLs whose path contains `/flows/` or `/runs/`.
- Adds `v3=false` if missing, or sets it when the value is not already `false` (e.g. `v3=true`).
- Uses `history.replaceState` plus History API hooks so it works on first load, refresh, back/forward, and typical SPA navigation.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 metadata, `icons`, and content script registration. |
| `content.js` | URL detection and rewriting logic (vanilla JS, commented). |
| `assets/v3False_*.png` | Extension icons (16, 32, 48, 128 px) referenced by `manifest.json` → `icons`. |

## Load unpacked (development)

1. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this folder.

## Store listing vs `manifest.json`

What **comes from the manifest** (Chrome/Edge extension details):

| Field | Role |
|-------|------|
| `name` | Title in the browser’s extension management UI. |
| `version` | Version string shown in extension details. |
| `description` | Short summary (often used as the default listing description unless you override it in the store dashboard). |
| `homepage_url` | Optional link shown as the extension’s homepage / support site (here: Helvety). |
| `icons` | Maps size keys to PNG paths; used in `chrome://extensions`, install UI, and Chrome Web Store (see [Manifest icons](https://developer.chrome.com/docs/extensions/mv3/manifest/icons)). |

What **does not** live in the manifest (you set these in each store’s developer dashboard):

- **Publisher / developer display name** (e.g. “Helvety”) — tied to your **Chrome Web Store** or **Microsoft Partner Center** account, not a manifest field.
- **Screenshots, promotional images, detailed description** — uploaded in the store.
- **Promo tiles** — e.g. 440×280 small promo; not in the manifest (see [Chrome Web Store images](https://developer.chrome.com/docs/webstore/images)). Package icons (`assets/v3False_*.png` + `icons` in the manifest) cover the extension icon requirement.

The `_comment_*` keys in `manifest.json` are optional human-readable notes; Chromium ignores unknown keys. If a validator ever complains, you can remove those keys before submission.

## Implementation notes

Comments in `content.js` match the current behavior. JSON does not allow `//` comments in `manifest.json`, so explanations use `_comment_*` strings or this README.

# Power Automate Force `v3=false` and `v3survey=false`

Minimal Chrome/Edge extension (Manifest V3) that ensures Power Automate flow and run URLs use `v3=false` and normalize `v3survey=false` (when present), even when the editor is opened through different navigation paths.

**Developer:** [Helvety](https://helvety.com)

## What it does

- Runs on Microsoft Power Automate hosts:
  - `https://*.powerautomate.com/*`
  - `https://flow.microsoft.com/*`
- Only changes URLs whose path contains `/flows/` or `/runs/`.
- Adds `v3=false` if missing, or replaces it when the value is not already `false` (e.g. `v3=true`).
- If a target URL includes `v3survey`, its value is normalized to `false`.
- Uses a layered architecture for reliability:
  - **Layer 1:** `declarativeNetRequest` redirect rule with query transform (`v3=false`) on matching editor URLs.
  - **Layer 2:** background `webNavigation` fallback that applies shared URL canonicalization (`v3=false`, plus `v3survey=false` when present).
  - **Layer 3:** content-script fallback for SPA/internal route transitions using History API hooks, `popstate`, and a short-lived observer/polling window; also applies shared URL canonicalization.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 metadata, `icons`, and content script registration. |
| `rules.json` | Declarative Net Request rules that normalize editor URLs to `v3=false` before load when possible. |
| `background.js` | Imperative fallback for main-frame navigation/history updates missed by declarative rules. |
| `url-policy.js` | Shared URL targeting/canonicalization policy used by both background and content layers. |
| `content.js` | In-page fallback URL enforcement logic for SPA/internal transitions (bounded, loop-safe). |
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

## Implementation notes

Comments in JS files match the current behavior. JSON does not allow `//` comments in `manifest.json`, so implementation details are documented in this README.

## Validation checklist

Run these checks after loading unpacked:

- Direct URL open to editor page with `v3=true` -> URL becomes `v3=false`.
- Direct URL open to editor page without `v3` -> URL gains `v3=false`.
- Open flow from list/dashboard -> final URL contains `v3=false`.
- Open run detail into editor -> final URL contains `v3=false`.
- Browser back/forward into editor route -> final URL contains `v3=false`.
- Open in new tab/window (`Ctrl/Cmd+Click`, context menu) -> final URL contains `v3=false`.
- Deep link from notification/history -> final URL contains `v3=false`.
- URL variants (extra params, repeated params) -> keep other params, normalize `v3=false`.
- URL includes `v3survey=true` -> normalize to `v3survey=false`.
- URL does not include `v3survey` -> do not add `v3survey`.
- Non-target pages (no `/flows/` and no `/runs/`) -> unchanged.

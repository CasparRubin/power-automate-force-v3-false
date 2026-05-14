/**
 * Runs synchronously when the popup bundle loads (before `createRoot` in `main.tsx`), so `<html>`
 * can match OS `prefers-color-scheme` on first paint (MV3 `extension_pages` CSP disallows inline
 * scripts in HTML). Saved **Light** / **Dark** from `chrome.storage.local` is applied afterward by
 * the React app (`theme-preference.ts`).
 */
try {
  document.documentElement.classList.toggle(
    "dark",
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
} catch {
  document.documentElement.classList.add("dark");
}

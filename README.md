# Infra Inspector

A small Manifest V3 Chrome extension that reads the response headers of the
current page's main document and surfaces what they reveal about the
serving infrastructure: CDN, edge PoP, cache status, platform (e.g.
Shopify), serving-node identifiers, and Server-Timing breakdowns.

It is a local, read-only diagnostic tool. It makes no network requests of
its own, sends no data anywhere, and has no backend.

Every identifier has a copy button, and most rows have an (i) info button:
click it for a one-line explanation of what the value actually is and,
when a genuine canonical public page exists for it, a link to that page.
Fields with no single authoritative public reference (e.g. a platform's
internal request ID) get an explanation but no link - see
`src/parsers/docs.ts`, which is the one place all of that copy lives.

## 1. Architecture

```
manifest.json
src/
  background/
    service-worker.ts   # webRequest listener -> parses headers -> chrome.storage.session
  devtools/
    devtools.ts          # registers the "Infra" DevTools panel
    devtools.html
    panel.ts             # DevTools panel UI + per-tab navigation history
    panel.html / panel.css
  popup/
    popup.ts             # popup UI: reads the latest capture for the active tab
    popup.html / popup.css
  parsers/                # pure functions, no chrome.* APIs, independently testable
    types.ts              # InfrastructureInfo and friends
    serverTiming.ts        # Server-Timing header -> structured metrics
    cloudflare.ts           # cf-ray / cf-cache-status / server-timing -> CloudflareParseResult
    shopify.ts               # x-request-id / x-dc / complexity scores -> ShopifyParseResult
    generic.ts                # Fastly / Akamai / CloudFront / Vercel / Netlify signatures
    index.ts                   # combines the above into one InfrastructureInfo
    *.test.ts                   # vitest unit tests for every parser
  utils/
    headers.ts             # merges chrome/DevTools header pair lists into a map
    storage.ts              # chrome.storage.session read/write helpers
    render.ts                 # shared DOM rendering, used by both popup and panel
    clipboard.ts, format.ts
  styles/theme.css          # shared look, light/dark via prefers-color-scheme
```

**Two capture paths feed one rendering layer.** The background service
worker and the DevTools panel each turn raw response headers into the same
`InfrastructureInfo` shape (via `parsers/index.ts`), and `utils/render.ts`
renders that shape into DOM - so the popup and the DevTools panel are
visually and behaviorally identical, without either surface depending on
Cloudflare/Shopify-specific header names.

### Why two separate capture paths?

- **Popup** needs infrastructure info the instant the toolbar icon is
  clicked, for a page that may have loaded minutes ago and without DevTools
  ever being open. Only `chrome.webRequest`, running in the background
  service worker, can observe that response as it happens.
- **DevTools panel** runs only while DevTools is open, but in exchange gets
  `chrome.devtools.network`, which needs no host permissions at all and
  naturally exposes every request in the inspected tab - perfect for
  building the navigation history.

Rather than picking one and working around its gaps, the extension uses
whichever API fits each surface, and shares everything else (parsing,
labels, rendering, styling).

## 2. Required Chrome permissions

| Permission | Why |
|---|---|
| `webRequest` | Lets the background service worker read response headers (`onResponseStarted`, read-only) for the popup's data path. No `webRequestBlocking` is requested - the extension never modifies or delays a request. |
| `storage` | Used exclusively for `chrome.storage.session`, an in-memory, per-browser-session store, to hand the latest captured headers from the service worker to the popup. Nothing is written to disk. |
| `host_permissions: http://*/*`, `https://*/*` | `webRequest` only reports headers for origins the extension has host permission for. Because the extension's entire purpose is inspecting *whichever* site you're currently on, and the popup must show data the instant you click the icon (i.e. before any user gesture could grant a narrower, on-demand permission), a static broad host permission is the only way to reliably capture the real navigation's headers without an extra duplicate request. |

No other permissions are requested. In particular:

- **No `tabs` permission.** The popup calls `chrome.tabs.query` to find the
  active tab; because the extension already holds host permission for
  `http(s)://*/*`, Chrome includes the tab's `url` in the result without
  requiring the separate `tabs` permission.
- **No `<all_urls>`.** `http://*/*` + `https://*/*` covers the same origins
  `<all_urls>` would for this use case, without also matching `file://`,
  `ftp://`, or extension-internal schemes the extension has no reason to
  see.
- **The DevTools panel requests nothing extra.** `chrome.devtools.network`
  and `chrome.devtools.inspectedWindow` are available to any DevTools
  extension page without additional entries in `permissions` or
  `host_permissions`.

### Alternative considered and rejected

An `activeTab`-only design (re-`fetch()` the page when the popup opens,
instead of a persistent `webRequest` listener) was considered, since it
avoids a standing broad host permission. It was rejected because it issues
a *second*, duplicate request for every popup open - which can return
different edge/PoP/cache-status values than the actual page load (cache
state, load balancing, edge routing all vary request-to-request), directly
undermining the tool's purpose of reporting what the real navigation saw.

## 3. How response headers are captured

- **Background / popup path:** `chrome.webRequest.onResponseStarted` is
  registered with `types: ["main_frame"]` and `extraInfoSpec:
  ["responseHeaders"]`. This event fires once per top-level navigation,
  and only for the *final* response - Chrome fires `onBeforeRedirect`
  instead for 3xx hops, so intermediate redirects never pollute the
  capture. Headers are merged into a plain `Record<string, string>`
  (joining duplicate header names with `, `, matching the Fetch API's
  `Headers` behavior) and handed to `buildInfrastructureInfo`. The result
  is written to `chrome.storage.session`, keyed by tab ID, and cleared
  when that tab closes (`chrome.tabs.onRemoved`).
- **DevTools panel path:** `chrome.devtools.network.onRequestFinished`
  fires for every request in the inspected tab while the panel is open.
  The panel tracks the URL from the most recent
  `chrome.devtools.network.onNavigated` event (seeded on panel load via
  `chrome.devtools.inspectedWindow.eval("location.href")`) and treats the
  first finished request whose URL matches that navigation as the main
  document. Its response headers are parsed the same way and appended to
  an in-memory, per-panel history (capped at 25 entries).

Both paths funnel into the exact same `buildInfrastructureInfo()` pure
function in `src/parsers/index.ts`.

## 4. Limitations imposed by Manifest V3 / DevTools APIs

- **Service workers are non-persistent.** The background script can be
  killed and restarted by Chrome at any time. Captured data therefore
  lives in `chrome.storage.session` (survives worker restarts, cleared at
  browser shutdown) rather than a plain in-memory variable, which would be
  lost.
- **No response body access.** `webRequest` in MV3 (without
  `webRequestBlocking`, which this extension deliberately avoids) exposes
  headers but never response bodies - by design, since this tool only ever
  needed headers.
- **DevTools panel sees nothing before it's open.** The DevTools Network
  domain only starts recording once DevTools is opened for that tab. If a
  page was loaded before you opened the "Infra" panel, its main document
  request will not appear in the history - reload the page (or navigate
  again) after opening the panel to see it.
- **Main-document detection in DevTools is heuristic.** `onRequestFinished`
  reports every request type. The panel identifies the document response
  by matching its URL against the most recent `onNavigated` event, which
  is accurate for the common case but can (rarely) be fooled by an XHR/
  fetch made to the exact same URL as the page itself in the same
  navigation window.
- **`onResponseStarted` cannot see cached-without-revalidation responses'
  original headers** in some edge cases (e.g. back/forward-cache
  restores don't re-fire it) - a page served purely from bfcache won't
  produce a new capture until it performs a real navigation/reload.

## 5. Building

Requirements: Node.js 18+.

```bash
npm install
npm run build       # one-off build into dist/
npm run watch        # rebuild on file changes
npm run typecheck     # tsc --noEmit
npm test                # vitest run (parser unit tests)
```

`npm run build` bundles each entry point with esbuild, copies
`manifest.json`, the HTML pages, and the shared stylesheet into `dist/`.
`dist/` is a complete, loadable extension directory.

## 6. Loading as an unpacked extension

1. Run `npm install && npm run build`.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `dist/` directory produced by the
   build.
5. Pin the "Infra Inspector" icon from the extensions toolbar menu if you
   want it visible at all times.

After editing source files, either re-run `npm run build` (or leave
`npm run watch` running) and click the refresh icon on the extension's
card in `chrome://extensions`.

## 7. Testing against a Cloudflare- and Shopify-backed site

Most Shopify storefronts run behind Cloudflare, so a single store will
usually exercise both parsers at once.

1. Build and load the extension as above.
2. Visit any live Shopify storefront (for example, a store on the
   `myshopify.com` domain, or any custom domain you know is Shopify-backed).
3. Click the extension icon:
   - **Overview** should show `Provider: Cloudflare` and `Platform:
     Shopify`.
   - **Cloudflare** should show a `Ray ID` and a parsed `PoP` code (a
     3-4 letter airport code, e.g. `MXP`, `FRA`, `SJC`).
   - **Application / Origin** should show the Shopify `Request ID` and,
     when the store's response includes a `Server-Timing: servedBy=...`
     entry, a `Serving node`.
   - **Performance** should show `Processing` / `Database` / `Async DB` /
     `Render` / `Compression` whenever the response includes a
     `Server-Timing` header with those metric names.
   - Expand **Raw headers** to confirm every value shown above traces back
     to an actual response header.
4. Open DevTools (`F12` / right-click → *Inspect*) on the same page, select
   the **Infra** panel, then reload the page. A new entry (`Request 1`)
   should appear in the left-hand navigation history with a one-line
   summary (Cloudflare PoP, Shopify node, datacenter region). Navigate to
   another page on the same site (e.g. a different product) to see
   `Request 2` appear, and compare PoP/node/region across entries.
5. To sanity-check the "don't invent data" behavior, visit a site with
   neither Cloudflare nor Shopify (e.g. a plain static host). The Overview
   section should simply omit fields it has no header evidence for, rather
   than guessing.

## Privacy

- No analytics, telemetry, or remote logging of any kind.
- No network requests are made by the extension itself; it only reads
  headers from requests the browser was already making.
- Captured data lives in `chrome.storage.session` (in-memory, cleared when
  the browser closes) and is scoped to the local browser profile only.

import { buildInfrastructureInfo, parseDatacenterRegion } from "../parsers/index.js";
import type { Capture } from "../parsers/types.js";
import { mergeHeaderPairs } from "../utils/headers.js";
import { renderCapture } from "../utils/render.js";

const MAX_HISTORY = 25;

const historyListEl = document.getElementById("history-list");
const detailEl = document.getElementById("detail");
const clearBtn = document.getElementById("clear-history");

const history: Capture[] = [];
let selectedIndex: number | null = null;
let currentNavigationUrl: string | undefined;

function summaryLine(capture: Capture): string[] {
  const lines: string[] = [];
  const { info } = capture;

  if (info.cdn?.provider === "Cloudflare") {
    lines.push(`Cloudflare PoP: ${info.cdn.edgeLocation ?? "unknown"}`);
  } else if (info.cdn?.provider) {
    lines.push(`CDN: ${info.cdn.provider}`);
  }

  if (info.platform?.provider === "Shopify") {
    lines.push(`Shopify node: ${info.platform.servingNode ?? "unknown"}`);
    const dc = info.platform.datacenters?.[0];
    const region = dc ? parseDatacenterRegion(dc) : undefined;
    if (region) lines.push(`GCP region: ${region}`);
    else if (dc) lines.push(`Datacenter: ${dc}`);
  }

  if (lines.length === 0) lines.push("No known infrastructure headers detected");
  return lines;
}

function renderHistoryList(): void {
  if (!historyListEl) return;
  historyListEl.replaceChildren();

  history.forEach((capture, index) => {
    const item = document.createElement("div");
    item.className = "history-item" + (index === selectedIndex ? " selected" : "");

    const title = document.createElement("div");
    title.className = "history-item-title";
    title.textContent = `Request ${index + 1}`;

    const urlLine = document.createElement("div");
    urlLine.className = "history-item-line";
    urlLine.textContent = capture.meta.url;
    urlLine.title = capture.meta.url;

    item.append(title, urlLine);
    for (const line of summaryLine(capture)) {
      const lineEl = document.createElement("div");
      lineEl.className = "history-item-line";
      lineEl.textContent = line;
      item.append(lineEl);
    }

    item.addEventListener("click", () => selectEntry(index));
    historyListEl.append(item);
  });
}

function selectEntry(index: number): void {
  selectedIndex = index;
  renderHistoryList();
  if (detailEl) renderCapture(detailEl, history[index]);
}

function addCapture(capture: Capture): void {
  history.push(capture);
  if (history.length > MAX_HISTORY) history.shift();
  selectEntry(history.length - 1);
}

function handleRequestFinished(request: chrome.devtools.network.Request): void {
  const url = request.request.url;
  // The DevTools network API exposes every request, not just the document.
  // We identify the main document response by matching the URL the
  // inspected window most recently navigated to - simple, and accurate for
  // the common case of a single top-level navigation per history entry.
  if (!currentNavigationUrl || url !== currentNavigationUrl) return;

  const headers = mergeHeaderPairs(request.response.headers);
  const info = buildInfrastructureInfo(headers);

  addCapture({
    meta: {
      url,
      tabId: chrome.devtools.inspectedWindow.tabId,
      timestamp: Date.now(),
      statusCode: request.response.status,
    },
    info,
  });

  // Only consume one document per navigation.
  currentNavigationUrl = undefined;
}

chrome.devtools.network.onNavigated.addListener((url) => {
  currentNavigationUrl = url;
});

chrome.devtools.network.onRequestFinished.addListener(handleRequestFinished);

chrome.devtools.inspectedWindow.eval<string>("location.href", (result) => {
  if (typeof result === "string") currentNavigationUrl = result;
});

clearBtn?.addEventListener("click", () => {
  history.length = 0;
  selectedIndex = null;
  renderHistoryList();
  if (detailEl) renderCapture(detailEl, undefined);
});

if (detailEl) renderCapture(detailEl, undefined);

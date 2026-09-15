import { buildInfrastructureInfo } from "../parsers/index.js";
import type { Capture } from "../parsers/types.js";
import { clearCapture, saveCapture } from "../utils/storage.js";
import { mergeHeaderPairs } from "../utils/headers.js";

chrome.webRequest.onResponseStarted.addListener(
  (details) => {
    // onResponseStarted only fires for the final, non-redirect response, so
    // this is always the document that actually rendered - not an
    // intermediate 3xx hop.
    if (details.type !== "main_frame" || details.tabId < 0) return;

    const headers = mergeHeaderPairs(details.responseHeaders);
    const info = buildInfrastructureInfo(headers);

    const capture: Capture = {
      meta: {
        url: details.url,
        tabId: details.tabId,
        timestamp: Date.now(),
        statusCode: details.statusCode,
      },
      info,
    };

    void saveCapture(details.tabId, capture);
  },
  { urls: ["http://*/*", "https://*/*"], types: ["main_frame"] },
  ["responseHeaders"],
);

chrome.tabs.onRemoved.addListener((tabId) => {
  void clearCapture(tabId);
});

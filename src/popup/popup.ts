import { loadCapture } from "../utils/storage.js";
import { renderCapture } from "../utils/render.js";

async function main(): Promise<void> {
  const app = document.getElementById("app");
  const hostEl = document.getElementById("host");
  if (!app) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    renderCapture(app, undefined);
    return;
  }

  if (hostEl && tab.url) {
    try {
      hostEl.textContent = new URL(tab.url).host;
    } catch {
      hostEl.textContent = tab.url;
    }
  }

  const capture = await loadCapture(tab.id);
  renderCapture(app, capture);

  // If the page was still loading when the popup opened, the background
  // worker may write the capture a moment later - pick it up live instead
  // of asking the user to reopen the popup.
  chrome.storage.session.onChanged.addListener((changes) => {
    const key = `capture:${tab.id}`;
    if (key in changes) {
      renderCapture(app, changes[key]?.newValue);
    }
  });
}

void main();

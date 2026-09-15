import type { Capture } from "../parsers/types.js";

/**
 * Thin wrapper around chrome.storage.session for sharing the latest capture
 * per tab between the background service worker (writer) and the popup
 * (reader). session storage is in-memory, per-browser-session, and never
 * touches disk or leaves the device - it survives service worker restarts,
 * which plain module-level variables would not.
 */

function key(tabId: number): string {
  return `capture:${tabId}`;
}

export async function saveCapture(tabId: number, capture: Capture): Promise<void> {
  await chrome.storage.session.set({ [key(tabId)]: capture });
}

export async function loadCapture(tabId: number): Promise<Capture | undefined> {
  const result = await chrome.storage.session.get(key(tabId));
  return result[key(tabId)] as Capture | undefined;
}

export async function clearCapture(tabId: number): Promise<void> {
  await chrome.storage.session.remove(key(tabId));
}

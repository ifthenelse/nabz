export interface NameValuePair {
  name: string;
  value?: string;
}

/**
 * Merges a name/value header list (the shape used by both
 * chrome.webRequest.HttpHeader[] and DevTools HAR entry headers) into a
 * plain map. Duplicate names (legal for Server-Timing, Set-Cookie, etc.)
 * are joined with ", " to match the Fetch API's Headers behavior.
 */
export function mergeHeaderPairs(pairs: NameValuePair[] | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of pairs ?? []) {
    if (h.value === undefined) continue;
    const name = h.name.toLowerCase();
    map[name] = name in map ? `${map[name]}, ${h.value}` : h.value;
  }
  return map;
}

import type { Capture, ValueKind } from "../parsers/types.js";
import { copyToClipboard } from "./clipboard.js";
import { formatMs } from "./format.js";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function copyButton(value: string): HTMLButtonElement {
  const btn = el("button", "copy-btn", "⧉");
  btn.type = "button";
  btn.title = "Copy to clipboard";
  btn.addEventListener("click", () => {
    void copyToClipboard(value).then((ok) => {
      if (!ok) return;
      const original = btn.textContent;
      btn.textContent = "✓";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove("copied");
      }, 1000);
    });
  });
  return btn;
}

interface RowOptions {
  kind?: ValueKind;
  title?: string;
  copyable?: boolean;
}

/** Renders one "label: value" row, or null when the value is absent. */
function row(label: string, value: string | undefined, opts: RowOptions = {}): HTMLElement | null {
  if (value === undefined || value === "") return null;

  const wrapper = el("div", "row");
  const labelEl = el("span", "row-label", label);
  const group = el("div", "row-value-group");
  const valueEl = el("span", "row-value", value);
  if (opts.title) valueEl.title = opts.title;

  group.append(valueEl);

  if (opts.kind) {
    group.append(el("span", `badge badge-${opts.kind}`, opts.kind));
  }
  if (opts.copyable !== false) {
    group.append(copyButton(value));
  }

  wrapper.append(labelEl, group);
  return wrapper;
}

function section(title: string, rows: Array<HTMLElement | null>): HTMLElement | null {
  const present = rows.filter((r): r is HTMLElement => r !== null);
  if (present.length === 0) return null;

  const wrapper = el("div", "section");
  wrapper.append(el("div", "section-title", title));
  wrapper.append(...present);
  return wrapper;
}

function rawHeadersSection(headers: Record<string, string>): HTMLElement | null {
  const entries = Object.entries(headers).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return null;

  const details = el("details", "raw-headers");
  const summary = el("summary", undefined, `Raw headers (${entries.length})`);
  const pre = el("pre");
  pre.textContent = entries.map(([k, v]) => `${k}: ${v}`).join("\n");
  details.append(summary, pre);
  return details;
}

/**
 * Renders a full Capture into `container`. Shared by the popup and the
 * DevTools panel so both surfaces stay visually and behaviorally identical.
 */
export function renderCapture(container: HTMLElement, capture: Capture | undefined): void {
  container.replaceChildren();

  if (!capture) {
    container.append(
      el(
        "div",
        "empty-state",
        "No main document response captured yet for this tab. Reload the page and reopen this view.",
      ),
    );
    return;
  }

  const { info } = capture;
  const sections: Array<HTMLElement | null> = [];

  sections.push(
    section("Overview", [
      row("Provider", info.cdn?.provider, { kind: "inferred" }),
      row("Edge location", info.cdn?.edgeLocation, { kind: "parsed" }),
      row("Cache", info.cdn?.cacheStatus, { kind: "observed" }),
      row("Platform", info.platform?.provider, { kind: "inferred" }),
    ]),
  );

  if (info.cdn?.provider === "Cloudflare") {
    sections.push(
      section("Cloudflare", [
        row("Ray ID", stripPop(info.cdn.rayId, info.cdn.edgeLocation), { kind: "observed" }),
        row("PoP", info.cdn.edgeLocation, {
          kind: "parsed",
          title: "Parsed from the cf-ray header - not sent as its own header.",
        }),
        row("Cache status", info.cdn.cacheStatus, { kind: "observed" }),
      ]),
    );

    const cfServerTiming = info.serverTimingRaw.filter((m) => /^cf/i.test(m.name));
    if (cfServerTiming.length > 0) {
      sections.push(
        section(
          "Cloudflare — Server-Timing",
          cfServerTiming.map((m) =>
            row(m.name, m.description ?? (m.duration !== undefined ? formatMs(m.duration) : undefined), {
              kind: "observed",
            }),
          ),
        ),
      );
    }
  }

  sections.push(
    section("Application / Origin", [
      row("Platform", info.platform?.provider, { kind: "inferred" }),
      row("Serving node", info.platform?.servingNode, {
        kind: "observed",
        title: "Identifier for the process/node that served the request - not necessarily a physical server.",
      }),
      row("Datacenter", info.platform?.datacenters?.join(", "), { kind: "observed" }),
      row("Request ID", info.platform?.requestId, { kind: "observed" }),
    ]),
  );

  sections.push(
    section("Performance", [
      row("Processing", formatMs(info.timing?.processing), { kind: "parsed" }),
      row("Database", formatMs(info.timing?.database), { kind: "parsed" }),
      row("Async DB", formatMs(info.timing?.asyncDatabase), { kind: "parsed" }),
      row("Render", formatMs(info.timing?.render), { kind: "parsed" }),
      row("Compression", formatMs(info.timing?.compression), { kind: "parsed" }),
    ]),
  );

  if (info.serverTimingExtras) {
    const e = info.serverTimingExtras;
    sections.push(
      section("Server-Timing details", [
        row("Edge", e.edge, { kind: "observed" }),
        row("Country", e.country, { kind: "observed" }),
        row("ASN", e.asn, { kind: "observed" }),
        row("Theme", e.theme, { kind: "observed" }),
        row("Page type", e.pageType, { kind: "observed" }),
      ]),
    );
  }

  if (info.genericProviders.length > 0) {
    for (const provider of info.genericProviders) {
      if (provider.provider === info.cdn?.provider) continue;
      sections.push(
        section(provider.provider, [
          ...Object.entries(provider.details).map(([k, v]) => row(k, v, { kind: "observed" })),
        ]),
      );
    }
  }

  sections.push(rawHeadersSection(info.rawHeaders));

  const present = sections.filter((s): s is HTMLElement => s !== null);
  if (present.length === 0) {
    container.append(el("div", "empty-state", "No known infrastructure headers were found on this response."));
    return;
  }
  container.append(...present);
}

/** Cosmetic only: drops the trailing "-POP" suffix already shown in its own row. */
function stripPop(rayId: string | undefined, pop: string | undefined): string | undefined {
  if (!rayId) return undefined;
  if (!pop) return rayId;
  const suffix = `-${pop}`;
  return rayId.toUpperCase().endsWith(suffix.toUpperCase()) ? rayId.slice(0, -suffix.length) : rayId;
}

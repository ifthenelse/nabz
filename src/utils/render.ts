import type { Capture, ValueKind } from "../parsers/types.js";
import { docFor } from "../parsers/docs.js";
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

// Only one tooltip may be open at a time, across the whole page.
let openTooltip: HTMLElement | null = null;

function closeOpenTooltip(): void {
  if (openTooltip) {
    openTooltip.hidden = true;
    openTooltip = null;
  }
}

document.addEventListener("click", (e) => {
  if (!openTooltip) return;
  const target = e.target as HTMLElement;
  if (openTooltip.contains(target) || target.closest(".info-btn")) return;
  closeOpenTooltip();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeOpenTooltip();
});

/** Builds the (i) button + popover tooltip shown next to a row's label. */
function infoButton(label: string, docKey: string): HTMLElement | null {
  const doc = docFor(docKey);
  if (!doc) return null;

  const wrap = el("span", "info-wrap");
  const btn = el("button", "info-btn", "i");
  btn.type = "button";
  btn.setAttribute("aria-label", `About ${label}`);

  const tooltip = el("div", "tooltip");
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  tooltip.append(el("p", "tooltip-text", doc.description));
  if (doc.href) {
    const link = el("a", "tooltip-link", "Learn more ↗");
    link.href = doc.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    tooltip.append(link);
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasOpen = !tooltip.hidden;
    closeOpenTooltip();
    if (!wasOpen) {
      tooltip.hidden = false;
      openTooltip = tooltip;
    }
  });

  wrap.append(btn, tooltip);
  return wrap;
}

interface RowOptions {
  kind?: ValueKind;
  title?: string;
  copyable?: boolean;
  /** Key into FIELD_DOCS (src/parsers/docs.ts); adds an (i) info button when present. */
  docKey?: string;
}

/** Renders one "label: value" row, or null when the value is absent. */
function row(label: string, value: string | undefined, opts: RowOptions = {}): HTMLElement | null {
  if (value === undefined || value === "") return null;

  const wrapper = el("div", "row");
  const labelEl = el("span", "row-label");
  labelEl.append(document.createTextNode(label));
  if (opts.docKey) {
    const info = infoButton(label, opts.docKey);
    if (info) labelEl.append(info);
  }

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
  openTooltip = null;

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
      row("Provider", info.cdn?.provider, { kind: "inferred", docKey: "cdn.provider" }),
      row("Edge location", info.cdn?.edgeLocation, { kind: "parsed", docKey: "cdn.edgeLocation" }),
      row("Cache", info.cdn?.cacheStatus, { kind: "observed", docKey: "cdn.cacheStatus" }),
      row("Platform", info.platform?.provider, { kind: "inferred", docKey: "platform.provider" }),
    ]),
  );

  if (info.cdn?.provider === "Cloudflare") {
    sections.push(
      section("Cloudflare", [
        row("Ray ID", stripPop(info.cdn.rayId, info.cdn.edgeLocation), {
          kind: "observed",
          docKey: "cdn.rayId",
        }),
        row("PoP", info.cdn.edgeLocation, {
          kind: "parsed",
          title: "Parsed from the cf-ray header - not sent as its own header.",
          docKey: "cdn.edgeLocation",
        }),
        row("Cache status", info.cdn.cacheStatus, { kind: "observed", docKey: "cdn.cacheStatus" }),
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
              docKey: "servertiming.cf",
            }),
          ),
        ),
      );
    }
  }

  sections.push(
    section("Application / Origin", [
      row("Platform", info.platform?.provider, { kind: "inferred", docKey: "platform.provider" }),
      row("Serving node", info.platform?.servingNode, {
        kind: "observed",
        title: "Identifier for the process/node that served the request - not necessarily a physical server.",
        docKey: "platform.servingNode",
      }),
      row("Datacenter", info.platform?.datacenters?.join(", "), {
        kind: "observed",
        docKey: "platform.datacenter",
      }),
      row("Request ID", info.platform?.requestId, { kind: "observed", docKey: "platform.requestId" }),
    ]),
  );

  sections.push(
    section("Performance", [
      row("Processing", formatMs(info.timing?.processing), { kind: "parsed", docKey: "timing.metric" }),
      row("Database", formatMs(info.timing?.database), { kind: "parsed", docKey: "timing.metric" }),
      row("Async DB", formatMs(info.timing?.asyncDatabase), { kind: "parsed", docKey: "timing.metric" }),
      row("Render", formatMs(info.timing?.render), { kind: "parsed", docKey: "timing.metric" }),
      row("Compression", formatMs(info.timing?.compression), { kind: "parsed", docKey: "timing.metric" }),
    ]),
  );

  if (info.serverTimingExtras) {
    const e = info.serverTimingExtras;
    sections.push(
      section("Server-Timing details", [
        row("Edge", e.edge, { kind: "observed", docKey: "timing.metric" }),
        row("Country", e.country, { kind: "observed", docKey: "timing.metric" }),
        row("ASN", e.asn, { kind: "observed", docKey: "timing.metric" }),
        row("Theme", e.theme, { kind: "observed", docKey: "timing.metric" }),
        row("Page type", e.pageType, { kind: "observed", docKey: "timing.metric" }),
      ]),
    );
  }

  if (info.genericProviders.length > 0) {
    for (const provider of info.genericProviders) {
      if (provider.provider === info.cdn?.provider) continue;
      const docKey = `generic.${provider.provider}`;
      sections.push(
        section(provider.provider, [
          ...Object.entries(provider.details).map(([k, v]) => row(k, v, { kind: "observed", docKey })),
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

/**
 * Loads Terra's chart renderer, and fetches the payloads it draws.
 *
 * The renderer is not bundled here. It is served by the Graph API, next to the
 * data it renders, which is what keeps an embedded graph identical to the one
 * in Terra's dashboard and lets a rendering fix reach every embed without
 * anyone upgrading a package. (Stripe.js and the Google Maps loader are the
 * same shape, for the same reason.)
 */

/** Default Graph API base. Override per element for a regional or proxied host. */
export const DEFAULT_BASE_URL = "https://api.tryterra.co/v2";

/** The date window to render. Ranges are capped at 92 days by the API. */
export interface GraphRange {
  /** Number of days back from today, inclusive of today. */
  timeframe?: number | string;
  /** Start date, `YYYY-MM-DD` (UTC). */
  from?: string;
  /** End date, `YYYY-MM-DD` (UTC), inclusive. */
  to?: string;
}

export interface GraphSource extends GraphRange {
  /** The graph to render, from the Graphs page of the Terra dashboard. */
  sessionId: string;
  /** The Terra user whose data to render, or `example` for generated data. */
  userId: string;
  baseUrl?: string;
}

/** Colour overrides. Graphs are normally styled in the dashboard; this is for
 *  the cases a colour has to follow the host app, such as a dark-mode toggle. */
export interface GraphTheme {
  bg?: string;
  line?: string;
  text?: string;
  tick?: string;
  chartType?: "line" | "bar";
}

/** The chart payload. Its shape is the renderer's business, not the caller's. */
export type GraphPayload = Record<string, unknown> & { title?: string };

/** A failed render, carrying the trace id Terra support needs to look it up. */
export class TerraGraphError extends Error {
  readonly status: number;
  readonly traceId?: string;

  constructor(message: string, status: number, traceId?: string) {
    super(message);
    this.name = "TerraGraphError";
    this.status = status;
    this.traceId = traceId;
  }
}

export interface GraphHandle {
  ready: Promise<void>;
  setTheme(theme: GraphTheme): void;
  update(payload: GraphPayload): void;
  resize(): void;
  destroy(): void;
}

interface TerraGraphGlobal {
  mount(host: Element, payload: GraphPayload, options?: Record<string, unknown>): GraphHandle;
  version: string;
}

declare global {
  interface Window {
    TerraGraph?: TerraGraphGlobal;
  }
}

const loading = new Map<string, Promise<TerraGraphGlobal>>();

/**
 * Loads the renderer from `baseUrl`, once per page. Concurrent callers — every
 * `<terra-graph>` on the page mounts independently — share one request.
 */
export function loadRenderer(baseUrl = DEFAULT_BASE_URL): Promise<TerraGraphGlobal> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("terra-graphs: the renderer needs a browser"));
  }
  if (window.TerraGraph) return Promise.resolve(window.TerraGraph);

  const src = `${trimEnd(baseUrl)}/graphs/embed.js`;
  const pending = loading.get(src);
  if (pending) return pending;

  const promise = new Promise<TerraGraphGlobal>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () =>
      window.TerraGraph
        ? resolve(window.TerraGraph)
        : reject(new Error(`terra-graphs: ${src} loaded but registered no renderer`));
    script.onerror = () => {
      // A failed load must not be cached, or a transient network error would
      // leave every later graph on the page permanently broken.
      loading.delete(src);
      reject(new Error(`terra-graphs: could not load ${src}`));
    };
    document.head.appendChild(script);
  });

  loading.set(src, promise);
  return promise;
}

/** The render URL for a graph. Exported for callers who want to build an
 *  iframe or a link to the hosted page instead of mounting the widget. */
export function graphUrl(source: GraphSource, format?: "json"): string {
  const base = trimEnd(source.baseUrl ?? DEFAULT_BASE_URL);
  const params = new URLSearchParams();
  if (format) params.set("format", format);
  if (source.timeframe != null && source.timeframe !== "") params.set("timeframe", String(source.timeframe));
  if (source.from) params.set("from", source.from);
  if (source.to) params.set("to", source.to);
  // The API rejects a request with no window at all, and "the last week" is
  // the range the dashboard's own embed snippets default to.
  if (!params.has("timeframe") && !params.has("from") && !params.has("to")) {
    params.set("timeframe", "7");
  }
  const path = `${base}/graphs/${encodeURIComponent(source.sessionId)}/${encodeURIComponent(source.userId)}`;
  return `${path}?${params.toString()}`;
}

/** Fetches the chart payload for a graph. */
export async function fetchPayload(source: GraphSource, init?: RequestInit): Promise<GraphPayload> {
  const response = await fetch(graphUrl(source, "json"), init);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = (body ?? {}) as Record<string, string>;
    throw new TerraGraphError(
      detail["error message"] || `Terra returned ${response.status}`,
      response.status,
      detail.trace_id,
    );
  }
  return body as GraphPayload;
}

function trimEnd(url: string): string {
  return url.replace(/\/+$/, "");
}

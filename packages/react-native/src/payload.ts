import { TerraGraphError, type GraphPayload, type IsoDate } from "./types";

/** Default Graph API base. Override per graph for a regional or proxied host. */
export const DEFAULT_BASE_URL = "https://api.tryterra.co/v2";

export interface GraphSource {
  sessionId: string;
  userId: string;
  timeframe?: number;
  from?: IsoDate;
  to?: IsoDate;
  baseUrl?: string;
}

/**
 * The payload URL for a graph.
 *
 * Built by hand rather than with `URLSearchParams`: React Native ships its own
 * partial polyfill on the global, so a bundler alias cannot replace it, and on
 * older versions its `set`/`has` throw. Five lines of concatenation avoid the
 * whole question.
 */
export function payloadUrl(source: GraphSource): string {
  const base = (source.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const params: string[] = ["format=json"];
  if (source.timeframe != null) params.push(`timeframe=${encodeURIComponent(String(source.timeframe))}`);
  if (source.from) params.push(`from=${encodeURIComponent(source.from)}`);
  if (source.to) params.push(`to=${encodeURIComponent(source.to)}`);
  // The API rejects a request with no window at all, and the last week is what
  // the dashboard's own embed snippets default to.
  if (params.length === 1) params.push("timeframe=7");
  const path = `${base}/graphs/${encodeURIComponent(source.sessionId)}/${encodeURIComponent(source.userId)}`;
  return `${path}?${params.join("&")}`;
}

/** Fetches the chart payload for a graph. */
export async function fetchPayload(source: GraphSource, init?: RequestInit): Promise<GraphPayload> {
  const response = await fetch(payloadUrl(source), init);
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

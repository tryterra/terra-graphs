/**
 * `<TerraGraph />` — the `<terra-graph>` custom element with typed props.
 *
 * React 18 sets unknown props on a custom element as attributes and cannot
 * attach listeners to custom events, so a wrapper is what makes `onLoad`,
 * `onError` and the `theme` object work there. It also keeps the element's
 * registration out of the server render.
 */
import { useEffect, useRef } from "react";
import { defineTerraGraph, type GraphPayload, type GraphTheme, type TerraGraphElement } from "terra-graphs";

export type { GraphPayload, GraphTheme };
export { TerraGraphError, graphUrl } from "terra-graphs";

export interface TerraGraphProps {
  /** The graph to render, from the Graphs page of the Terra dashboard. */
  sessionId: string;
  /** The Terra user whose data to render, or `"example"` for generated data. */
  userId: string;
  /** Days back from today, inclusive of today. Defaults to 7. */
  timeframe?: number;
  /** Start date, `YYYY-MM-DD` (UTC). Use instead of, or with, `timeframe`. */
  from?: string;
  /** End date, `YYYY-MM-DD` (UTC), inclusive. */
  to?: string;
  /** Graph API base URL. Only needed for a regional or proxied host. */
  baseUrl?: string;
  /** Colour overrides, applied over the graph's dashboard configuration. */
  theme?: GraphTheme;
  className?: string;
  style?: React.CSSProperties;
  /** The graph has drawn. */
  onLoad?: (payload: GraphPayload) => void;
  /** The graph could not be drawn. `TerraGraphError` carries a support trace id. */
  onError?: (error: Error) => void;
}

// Registering during the module's evaluation would run on the server too. The
// call is a no-op there, but doing it in an effect keeps the import free of
// side effects for bundlers that care.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "terra-graph": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        "session-id"?: string;
        "user-id"?: string;
        timeframe?: string;
        from?: string;
        to?: string;
        "base-url"?: string;
      };
    }
  }
}

export function TerraGraph({
  sessionId,
  userId,
  timeframe,
  from,
  to,
  baseUrl,
  theme,
  className,
  style,
  onLoad,
  onError,
}: TerraGraphProps): React.ReactElement {
  const ref = useRef<TerraGraphElement | null>(null);

  // Callbacks live in a ref so a caller passing inline arrow functions — which
  // is most callers — doesn't detach and reattach listeners on every render.
  const handlers = useRef({ onLoad, onError });
  handlers.current = { onLoad, onError };

  useEffect(() => {
    defineTerraGraph();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const load = (e: Event) => handlers.current.onLoad?.((e as CustomEvent).detail.payload);
    const fail = (e: Event) => handlers.current.onError?.((e as CustomEvent).detail.error);
    el.addEventListener("terra-graph:load", load);
    el.addEventListener("terra-graph:error", fail);
    return () => {
      el.removeEventListener("terra-graph:load", load);
      el.removeEventListener("terra-graph:error", fail);
    };
  }, []);

  useEffect(() => {
    if (ref.current) ref.current.theme = theme;
  }, [theme]);

  useEffect(() => () => ref.current?.destroy(), []);

  return (
    <terra-graph
      ref={ref as React.Ref<HTMLElement>}
      className={className}
      style={style}
      session-id={sessionId}
      user-id={userId}
      timeframe={timeframe == null ? undefined : String(timeframe)}
      from={from}
      to={to}
      base-url={baseUrl}
    />
  );
}

export default TerraGraph;

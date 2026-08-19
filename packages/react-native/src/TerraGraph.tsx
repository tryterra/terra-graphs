/**
 * `<TerraGraph />` — a Terra graph drawn natively, with no WebView.
 *
 * The chart is the same ECharts option the web renderer builds (see
 * src/option-builder.js, generated from it), painted by
 * @wuba/react-native-echarts on Skia or SVG. The card around it — header,
 * stats, sleep breakdown — is native, because RN has no CSS to share.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from "react-native";
import * as echarts from "echarts/core";
import { BarChart, CustomChart, LineChart, PieChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";

import { buildChartOption } from "./option-builder.js";
import { Header } from "./Header";
import { SleepStages } from "./SleepStages";
import { fetchPayload, type GraphSource } from "./payload";
import { TerraGraphError, type GraphPayload, type GraphTheme, type IsoDate } from "./types";

// Registered once per app. Every component here is genuinely reachable from the
// generated builder — MarkPoint drives min/max markers, MarkArea the HR zones,
// VisualMap the baseline fill and zone tinting — so trimming this list silently
// drops decorations rather than failing loudly.
echarts.use([
  LineChart,
  BarChart,
  CustomChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
  ToolboxComponent,
  MarkPointComponent,
  MarkLineComponent,
  MarkAreaComponent,
  VisualMapComponent,
  DataZoomComponent,
]);

export interface TerraGraphProps {
  /** The graph to render, from the Graphs page of the Terra dashboard. */
  sessionId: string;
  /** The Terra user whose data to render, or `"example"` for generated data. */
  userId: string;
  /** Days back from today, inclusive of today. Defaults to 7. */
  timeframe?: number;
  /** Start date, `YYYY-MM-DD` (UTC). Not a `Date` — `toIsoDate()` converts one. */
  from?: IsoDate;
  /** End date, `YYYY-MM-DD` (UTC), inclusive. */
  to?: IsoDate;
  /** Graph API base URL. Only needed for a regional or proxied host. */
  baseUrl?: string;
  /** Colour overrides, applied over the graph's dashboard configuration. */
  theme?: GraphTheme;
  /** Chart height. The card sizes itself around it. Defaults to 220. */
  height?: number;
  style?: ViewStyle;
  /** The graph has drawn. */
  onLoad?: (payload: GraphPayload) => void;
  /** It could not be drawn. `TerraGraphError` carries a support trace id. */
  onError?: (error: Error) => void;
  /**
   * The painter. Pass `SkiaChart` from `@wuba/react-native-echarts/skiaChart`,
   * or `SvgChart` plus its `SVGRenderer`. Injected rather than imported so an
   * app only links the native module it actually uses — importing both would
   * make every app carry Skia *and* react-native-svg.
   */
  chart: React.ComponentType<{ ref?: unknown; useRNGH?: boolean; width?: number; height?: number }>;
  /** The zrender renderer matching `chart`, when using the SVG painter. */
  renderer?: unknown;
}

export function TerraGraph({
  sessionId,
  userId,
  timeframe,
  from,
  to,
  baseUrl,
  theme,
  height = 220,
  style,
  onLoad,
  onError,
  chart: ChartView,
  renderer,
}: TerraGraphProps) {
  const chartRef = useRef<unknown>(null);
  const [payload, setPayload] = useState<GraphPayload | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Callbacks live in a ref so inline arrow functions — which is most callers —
  // don't re-trigger the fetch on every render.
  const handlers = useRef({ onLoad, onError });
  handlers.current = { onLoad, onError };

  useEffect(() => {
    if (renderer) echarts.use(renderer as Parameters<typeof echarts.use>[0]);
  }, [renderer]);

  const source: GraphSource = useMemo(
    () => ({ sessionId, userId, timeframe, from, to, baseUrl }),
    [sessionId, userId, timeframe, from, to, baseUrl],
  );

  useEffect(() => {
    const abort = new AbortController();
    setError(null);
    fetchPayload(source, { signal: abort.signal })
      .then((next) => {
        if (abort.signal.aborted) return;
        setPayload(next);
        handlers.current.onLoad?.(next);
      })
      .catch((err: unknown) => {
        if (abort.signal.aborted) return;
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        handlers.current.onError?.(e);
      });
    return () => abort.abort();
  }, [source]);

  // Drawing is an effect rather than part of render: the option is built from
  // the payload and handed to an imperative chart instance.
  useEffect(() => {
    if (!payload || !chartRef.current) return;
    const instance = echarts.init(chartRef.current as never, undefined, {
      renderer: renderer ? "svg" : "canvas",
      width: undefined,
      height,
    } as never);
    try {
      instance.setOption(buildChartOption(payload, { echarts, theme, fontFamily: "System" }), {
        notMerge: true,
      });
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      handlers.current.onError?.(e);
    }
    return () => instance.dispose();
  }, [payload, theme, height, renderer]);

  const background = theme?.bg || payload?.theme?.bg || "#FFFFFF";

  if (error) {
    return (
      <View style={[styles.card, styles.centred, { backgroundColor: background, height }, style]}>
        <Text style={styles.error}>{error.message}</Text>
        {error instanceof TerraGraphError && !!error.traceId && (
          <Text style={styles.trace}>Trace ID: {error.traceId}</Text>
        )}
      </View>
    );
  }

  if (!payload) {
    return (
      <View style={[styles.card, styles.centred, { backgroundColor: background, height }, style]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: background }, style]}>
      <Header payload={payload} theme={theme} />
      <ChartView ref={chartRef as never} useRNGH height={height} />
      {payload.kind === "sleep" && <SleepStages payload={payload} theme={theme} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, overflow: "hidden", paddingVertical: 8 },
  centred: { alignItems: "center", justifyContent: "center" },
  error: { fontSize: 13, opacity: 0.7, textAlign: "center", paddingHorizontal: 24 },
  trace: { fontSize: 10, opacity: 0.45, marginTop: 6, fontVariant: ["tabular-nums"] },
});

export default TerraGraph;

/**
 * `<TerraGraph />` — a Terra graph drawn natively, with no WebView.
 *
 * The chart is the same ECharts option the web renderer builds (see
 * src/option-builder.js, generated from it), painted by
 * @wuba/react-native-echarts on Skia or SVG. The card around it — header,
 * stats, sleep breakdown — is native, because RN has no CSS to share.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native";
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
import { plainTextTooltips } from "./tooltip";
import { Header } from "./Header";
import { SleepStages } from "./SleepStages";
import { fetchPayload, type GraphSource } from "./payload";
import { TerraGraphError, type GraphPayload, type GraphTheme, type IsoDate } from "./types";

// Registered once per app. Every component here is genuinely reachable from the
// generated builder — MarkPoint drives min/max markers, MarkArea the HR zones,
// VisualMap the baseline fill and zone tinting — so trimming this list silently
// drops decorations rather than failing loudly.
//
// Note there is no painter here: `echarts/core` ships none, and the one to use
// belongs to the caller's chosen native module. See `renderer` below.
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

/** An ECharts extension, as `echarts.use` takes it. */
type Registrar = Parameters<typeof echarts.use>[0];

/**
 * The painter name a renderer registers under.
 *
 * ECharts needs the exact name at `init`, and it is not guessable: Skia
 * registers as `"skia"`, SVG as `"svg"`, and neither is the `"canvas"` a
 * browser would use. Rather than making the caller repeat it in a second prop,
 * ask the renderer — it announces the name when it registers.
 */
function painterNameOf(renderer: unknown): string {
  let name = "";
  try {
    (renderer as (r: { registerPainter: (n: string, p: unknown) => void }) => void)({
      registerPainter: (n) => {
        name = n;
      },
    });
  } catch {
    // A renderer that does something other than register a painter is not one
    // we can drive; the caller gets the clearer error from init below.
  }
  return name;
}

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
   * The chart view and its renderer, from `@wuba/react-native-echarts`:
   *
   *   chart={SkiaChart} renderer={SkiaRenderer}   // @wuba/…/skiaChart
   *   chart={SvgChart}  renderer={SVGRenderer}    // @wuba/…/svgChart
   *
   * Both are injected rather than imported here so an app links only the native
   * module it actually uses — importing both would make every app carry Skia
   * *and* react-native-svg. They must match: the renderer registers the painter
   * the chart view draws with.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- wuba types
  // `useRNGH` as a discriminated union, so no structural type accepts both of
  // its components; a narrower type here would make every call site cast.
  chart: React.ComponentType<any>;
  renderer: unknown;
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
  // Neither painter measures anything — both take their width from the init
  // options and default to 0 — so the chart is laid out before it is drawn.
  const [width, setWidth] = useState(0);

  // Callbacks live in a ref so inline arrow functions — which is most callers —
  // don't re-trigger the fetch on every render.
  const handlers = useRef({ onLoad, onError });
  handlers.current = { onLoad, onError };

  const painter = useMemo(() => {
    if (renderer) echarts.use(renderer as Registrar);
    return painterNameOf(renderer);
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
      })
      .catch((err: unknown) => {
        if (abort.signal.aborted) return;
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        handlers.current.onError?.(e);
      });
    return () => abort.abort();
  }, [source]);

  // Keyed on the theme's values, not the object's identity: callers pass an
  // inline literal, and rebuilding the chart on every parent render would
  // restart its animation and drop any pan/zoom the user had done.
  const themeKey = theme ? [theme.bg, theme.line, theme.text, theme.tick, theme.chartType].join("|") : "";
  const themeRef = useRef(theme);
  themeRef.current = theme;

  // Drawing is an effect rather than part of render: the option is built from
  // the payload and handed to an imperative chart instance.
  useEffect(() => {
    if (!payload || !chartRef.current || width <= 0) return;
    let instance: ReturnType<typeof echarts.init> | undefined;
    try {
      instance = echarts.init(chartRef.current as never, undefined, {
        renderer: painter,
        width,
        height,
      } as never);
      instance.setOption(
        plainTextTooltips(
          buildChartOption(payload, { echarts, theme: themeRef.current, fontFamily: "System" }),
        ),
        {
          notMerge: true,
        },
      );
      handlers.current.onLoad?.(payload);
    } catch (err) {
      // init throws when no painter is registered — the single most likely
      // setup mistake — so it has to be inside the try, or the app gets an
      // unhandled exception instead of the error card.
      instance?.dispose();
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      handlers.current.onError?.(e);
      return;
    }
    return () => instance?.dispose();
  }, [payload, themeKey, height, width, painter]);

  const background = theme?.bg || payload?.theme?.bg || "#FFFFFF";
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

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
    <View style={[styles.card, { backgroundColor: background }, style]} onLayout={onLayout}>
      <Header payload={payload} theme={theme} />
      {/* Only the Skia view takes width/height props; the SVG one reads them
          from the init options and its own style, so pass both.

          Deliberately not `useRNGH`: that switches the chart's touch handling to
          react-native-gesture-handler, which then requires the whole app to sit
          inside a GestureHandlerRootView and throws if it doesn't. The default
          PanResponder path needs no such setup and drives tooltips fine, including
          inside a ScrollView. */}
      {width > 0 && (
        <ChartView ref={chartRef as never} style={{ width, height }} width={width} height={height} />
      )}
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

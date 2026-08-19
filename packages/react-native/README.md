# terra-graphs-react-native

Embed a Terra graph in a React Native app, drawn natively — no WebView.

You design the graph in the [Terra dashboard](https://dashboard.tryterra.co/dashboard/graphs): pick the metric, the chart type, the colours, the header stats. This component renders it, for one user, as native views.

```bash
npm install terra-graphs-react-native @wuba/react-native-echarts @shopify/react-native-skia react-native-gesture-handler
```

```jsx
import { TerraGraph } from "terra-graphs-react-native";
import SkiaChart from "@wuba/react-native-echarts/skiaChart";

<TerraGraph
  sessionId="a1b2c3d4-0000-0000-0000-000000000000"
  userId={terraUserId}
  timeframe={30}
  chart={SkiaChart}
  height={240}
/>;
```

**Expo:** these are native modules, so they need a [development build](https://docs.expo.dev/develop/development-builds/introduction/) — they don't run in Expo Go. If you'd rather not leave Expo Go, use the WebView embed instead (see below).

## Why you pass `chart`

The painter is yours to choose, and you import it so your app links only the native module it actually uses:

| Painter | Install | Pass |
| --- | --- | --- |
| **Skia** (recommended) | `@shopify/react-native-skia` | `chart={SkiaChart}` |
| **SVG** | `react-native-svg` | `chart={SvgChart}` and `renderer={SVGRenderer}` |

```jsx
import SvgChart, { SVGRenderer } from "@wuba/react-native-echarts/svgChart";

<TerraGraph sessionId={s} userId={u} chart={SvgChart} renderer={SVGRenderer} />;
```

If the component imported both, every app would carry Skia *and* react-native-svg.

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `sessionId` | `string` | **Required.** The graph, from the dashboard. |
| `userId` | `string` | **Required.** The Terra user to render, or `"example"`. |
| `chart` | component | **Required.** `SkiaChart` or `SvgChart` (above). |
| `renderer` | — | Required with `SvgChart`: pass `SVGRenderer`. |
| `timeframe` | `number` | Days back from today, including today. Defaults to 7. |
| `from`, `to` | `IsoDate` | `YYYY-MM-DD` (UTC). `to` is inclusive. |
| `baseUrl` | `string` | Graph API base. Defaults to `https://api.tryterra.co/v2`. |
| `theme` | `GraphTheme` | Colour overrides — see below. |
| `height` | `number` | Chart height. The card sizes around it. Defaults to 220. |
| `style` | `ViewStyle` | Applied to the card. |
| `onLoad` | `(payload) => void` | The graph has drawn. |
| `onError` | `(error) => void` | It could not be drawn. |

## Dates are strings, not `Date`s

`from` and `to` take `YYYY-MM-DD`, typed as `IsoDate`, so passing a `Date` is a compile error.

That is deliberate. A graph window is a run of calendar days; a `Date` is an instant. Converting one to the other means picking a timezone, and the obvious conversion is wrong — a date picker hands you `new Date(2026, 7, 1)` for "1 August", and `.toISOString().slice(0, 10)` turns that into `2026-07-31` anywhere east of Greenwich. If you have a `Date`, convert it explicitly:

```jsx
import { toIsoDate } from "terra-graphs-react-native";

<TerraGraph sessionId={s} userId={u} from={toIsoDate(picked)} to={toIsoDate(until)} />;
```

## Choosing the dates

| Props | Renders |
| --- | --- |
| `timeframe={30}` | The most recent 30 days, including today. |
| `from` + `to` | That range, `to` included. |
| `timeframe={7} from="2026-08-01"` | Seven days from 1 August. |
| `timeframe={7} to="2026-08-31"` | The seven days ending 31 August. |

A range can span at most 92 days. Changing any of them refetches and redraws.

## Colours

Graphs are styled in the dashboard, and the app picks that up — change it there and every platform follows without a release. For colours that track the app at runtime, such as dark mode:

```jsx
const scheme = useColorScheme();

<TerraGraph
  sessionId={s}
  userId={u}
  chart={SkiaChart}
  theme={scheme === "dark" ? { bg: "#0F172A", text: "#E2E8F0", line: "#38BDF8" } : undefined}
/>;
```

## Handling failures

`onError` receives a `TerraGraphError` carrying a `traceId`. Quote it to Terra support and they can look up exactly what happened. The card also shows the message and the trace id in place.

```jsx
<TerraGraph
  sessionId={s}
  userId={u}
  chart={SkiaChart}
  onError={(error) => reportToSentry(error, { traceId: error.traceId })}
/>
```

## The WebView alternative

If you'd rather not add native modules — or you need to stay in Expo Go — the hosted graph works in a web view with no packages at all:

```jsx
import { WebView } from "react-native-webview";

<WebView
  source={{ uri: `https://api.tryterra.co/v2/graphs/${sessionId}/${userId}?timeframe=30` }}
  style={{ flex: 1 }}
/>;
```

That path always renders whatever Terra serves, so it never needs upgrading. This package trades that for native drawing and no web view.

## How the chart stays identical to the web

`src/option-builder.js` is copied verbatim out of Terra's web renderer, between markers, by `scripts/extract-option-builder.mjs` — with exactly three DOM reads replaced. It is generated, never hand-edited, and the test suite renders every chart kind through it to catch a bad extraction.

That keeps the *drawing* in step. It does not make this package self-updating: unlike the web embed, a renderer fix reaches your users only when you upgrade and ship a new build.

## Using the pieces without the component

Everything that isn't a React Native view is also published as
`terra-graphs-react-native/core` — the payload fetching, the header's numbers
and the chart-option builder — for building your own chart surface:

```js
import { fetchPayload, buildChartOption } from "terra-graphs-react-native/core";

const payload = await fetchPayload({ sessionId, userId, timeframe: 30 });
const option = buildChartOption(payload, { echarts });
```

## Docs

Full guide: [docs.tryterra.co/graphs](https://docs.tryterra.co/graphs)

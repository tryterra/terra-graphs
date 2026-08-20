# @tryterra/graphs-react-native

Embed a Terra graph in a React Native app, drawn natively — no WebView.

You design the graph in the [Terra dashboard](https://dashboard.tryterra.co/dashboard/graphs): pick the metric, the chart type, the colours, the header stats. This component renders it, for one user, as native views.

```bash
npm install @tryterra/graphs-react-native
```

```jsx
import { TerraGraph } from "@tryterra/graphs-react-native";

<TerraGraph
  sessionId="a1b2c3d4-0000-0000-0000-000000000000"
  userId={terraUserId}
  timeframe={30}
  height={240}
/>;
```

That is the whole setup. No Metro config, no `overrides` entry, no chart engine to
install or wire up.

`react-native-svg` is the one thing this needs that it cannot bundle — it is a
native module, and React Native has no drawing surface of its own. It is declared
as a peer, so npm installs it for you.

**Expo:** run `npx expo install react-native-svg` once afterwards. npm resolves the
newest release; `expo install` pins the one matching your SDK. Both are in Expo Go,
so no development build is needed.

## Using Skia instead

Skia paints faster on very dense charts. It costs two extra native modules —
`react-native-reanimated` and `react-native-worklets`, which Skia peer-requires and
throws without — so it is opt-in rather than the default:

```bash
npm install @tryterra/graphs-react-native @shopify/react-native-skia react-native-reanimated
```

```jsx
import { TerraGraph } from "@tryterra/graphs-react-native/skia";
```

Same component, same props. The chart engine sits in a shared chunk, so importing
both entries costs one engine and two painters — not two of each.

## Why the chart engine is bundled

Unusually for a React Native library, this package ships ECharts, zrender and the
painter *inside* `dist/` instead of listing them as dependencies. Two reasons,
both of which cost users a broken app otherwise:

- **tslib.** Every ECharts and zrender release, up to and including 6.1.0, pins
  `tslib` to exactly 2.3.0. That version's `exports` map resolves to an ES module
  which Metro then hands to a CommonJS `require`, so the app bundles cleanly and
  crashes on launch with `Cannot read property '__extends' of undefined`. Bundling
  resolves tslib at *our* build time, on Node, where the interop is correct.
- **One zrender.** The painter registers itself into zrender's module-level
  instance registry. If the copy it registers into is not the copy ECharts draws
  through, `init` succeeds, `setOption` succeeds, and the chart renders blank with
  no error at all. Shipping one bundle makes that failure impossible rather than
  merely unlikely.

The trade is about 271 KB gzipped in your app bundle for the default entry, or
241 KB for the Skia one (measured minified + gzipped, as a release build ships
them). That is roughly what these libraries would have cost as ordinary
dependencies, since it is the same code. If your app
*already* uses ECharts directly you will now carry two copies; tell us and we will
add a build that externalises it.

Licences for the bundled code are in [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `sessionId` | `string` | **Required.** The graph, from the dashboard. |
| `userId` | `string` | **Required.** The Terra user to render, or `"example"`. |
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
import { toIsoDate } from "@tryterra/graphs-react-native";

<TerraGraph
  sessionId={s}
  userId={u}
  from={toIsoDate(picked)}
  to={toIsoDate(until)}
/>;
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
  theme={scheme === "dark" ? { bg: "#0F172A", text: "#E2E8F0", line: "#38BDF8" } : undefined}
/>;
```

Give colours as hex (`#38BDF8`, `#3BF`) or `rgb()`/`rgba()`. Named colours and `hsl()` are not parsed off-DOM and fall back to grey.

## Handling failures

`onError` receives a `TerraGraphError` carrying a `traceId`. Quote it to Terra support and they can look up exactly what happened. The card also shows the message and the trace id in place.

```jsx
<TerraGraph
  sessionId={s}
  userId={u}
  onError={(error) => reportToSentry(error, { traceId: error.traceId })}
/>
```

## The WebView alternative

If you'd rather not add a charting library at all, the hosted graph works in a web view:

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
`@tryterra/graphs-react-native/core` — the payload fetching, the header's numbers
and the chart-option builder — for building your own chart surface:

```js
import { fetchPayload, buildChartOption } from "@tryterra/graphs-react-native/core";

const payload = await fetchPayload({ sessionId, userId, timeframe: 30 });
const option = buildChartOption(payload, { echarts }); // your own echarts instance
```

`core` deliberately holds no chart engine, so it stays small and runs under plain
Node. Pass in whichever `echarts` you are driving.

## Docs

Full guide: [docs.tryterra.co/graphs](https://docs.tryterra.co/graphs)

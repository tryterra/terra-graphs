# terra-graphs-react

Embed a Terra graph in a React app — in your own DOM, not an iframe.

You design the graph in the [Terra dashboard](https://dashboard.tryterra.co/dashboard/graphs): pick the metric, the chart type, the colours, the header stats. This component renders it, for one user, wherever you put it.

```bash
npm install terra-graphs-react
```

```jsx
import { TerraGraph } from "terra-graphs-react";

export function SleepCard({ userId }) {
  return (
    <TerraGraph
      sessionId="a1b2c3d4-0000-0000-0000-000000000000"
      userId={userId}
      timeframe={30}
      style={{ width: "100%", height: 360 }}
    />
  );
}
```

## Getting the two ids

- **`sessionId`** identifies the graph. Create one on the Graphs page of the dashboard, then use **Embed** to copy its id. One graph works for all of your users — you do not create one per person.
- **`userId`** is the Terra user whose data to draw. Use `"example"` to render generated data, which is handy while you are building the layout.

Both are safe to put in your frontend. The graph renders only for a user your account is connected to, and carries no credentials — keep your API key on your server.

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `sessionId` | `string` | **Required.** The graph, from the dashboard. |
| `userId` | `string` | **Required.** The Terra user to render, or `"example"`. |
| `timeframe` | `number` | Days back from today, including today. Defaults to 7. |
| `from`, `to` | `string` | `YYYY-MM-DD` (UTC). `to` is inclusive. |
| `baseUrl` | `string` | Graph API base. Defaults to `https://api.tryterra.co/v2`. |
| `theme` | `GraphTheme` | Colour overrides — see below. |
| `className`, `style` | | Applied to the element. |
| `onLoad` | `(payload) => void` | The graph has drawn. |
| `onError` | `(error) => void` | It could not be drawn. |

The component has no intrinsic height. Give it one through `style` or `className`.

## Choosing the dates

| Props | Renders |
| --- | --- |
| `timeframe={30}` | The most recent 30 days, including today. |
| `from="2026-08-01" to="2026-08-31"` | 1–31 August, `to` included. |
| `timeframe={7} from="2026-08-01"` | Seven days from 1 August. |
| `timeframe={7} to="2026-08-31"` | The seven days ending 31 August. |
| `from="2026-08-01"` | 1 August through today. |

A range can span at most 92 days. Changing these props redraws the existing chart rather than remounting it, so wiring a date picker straight to them does the right thing:

```jsx
const [days, setDays] = useState(30);

<>
  <RangePicker value={days} onChange={setDays} />
  <TerraGraph sessionId={sessionId} userId={userId} timeframe={days} style={{ height: 360 }} />
</>
```

## Handling failures

`onError` receives a `TerraGraphError` carrying a `traceId`. Quote it to Terra support and they can look up exactly what happened.

```jsx
<TerraGraph
  sessionId={sessionId}
  userId={userId}
  onError={(error) => reportToSentry(error, { traceId: error.traceId })}
/>
```

## Colours

Graphs are styled in the dashboard, and every embed picks that styling up — change it there and your app follows without a deploy. For colours that have to track the host app, pass `theme`:

```jsx
const dark = useDarkMode();

<TerraGraph
  sessionId={sessionId}
  userId={userId}
  theme={dark ? { bg: "#0F172A", text: "#E2E8F0", line: "#38BDF8" } : undefined}
/>
```

## Server rendering

Importing on the server is a no-op and the component renders nothing there, so Next.js (app or pages router), Remix and Astro need no `dynamic()` wrapper or `"use client"` gymnastics beyond what your own component already needs.

## Content Security Policy

The chart engine is loaded from Terra at render time, so a fix reaches every embed without you shipping an upgrade. If you run a CSP, allow:

```
script-src  https://api.tryterra.co;
connect-src https://api.tryterra.co;
font-src    https://fonts.gstatic.com;
style-src   https://fonts.googleapis.com;
```

The font entries are only needed if you keep Terra's typeface. Graphs render fine without it.

## Not using React?

[`terra-graphs`](https://www.npmjs.com/package/terra-graphs) ships the same graph as a `<terra-graph>` custom element, with notes for Vue, Svelte, Angular and plain HTML.

## Docs

Full guide: [docs.tryterra.co/graphs](https://docs.tryterra.co/graphs)

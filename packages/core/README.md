# @tryterra/graphs

Embed a Terra graph in your app — in your own DOM, not an iframe.

You design the graph in the [Terra dashboard](https://dashboard.tryterra.co/dashboard/graphs): pick the metric, the chart type, the colours, the header stats. This package renders it, for one user, wherever you put it.

```bash
npm install @tryterra/graphs
```

```html
<script type="module">
  import "@tryterra/graphs";
</script>

<terra-graph
  session-id="a1b2c3d4-0000-0000-0000-000000000000"
  user-id="e5f6g7h8-0000-0000-0000-000000000000"
  timeframe="30"
></terra-graph>
```

Using React? Install [`@tryterra/graphs-react`](https://www.npmjs.com/package/@tryterra/graphs-react) instead.

## Getting the two ids

- **`session-id`** identifies the graph. Create one on the Graphs page of the dashboard, then use **Embed** to copy its id. One graph works for all of your users — you do not create one per person.
- **`user-id`** is the Terra user whose data to draw. Use `example` to render generated data, which is handy while you are building the layout.

Both are safe to put in your frontend. The graph renders only for a user your account is connected to, and carries no credentials — keep your API key on your server.

## Sizing it

`<terra-graph>` is a block element that fills the box you give it. It has no intrinsic height, so give it one:

```css
terra-graph {
  display: block;
  width: 100%;
  height: 360px;
}
```

## Choosing the dates

| Attributes | Renders |
| --- | --- |
| `timeframe="30"` | The most recent 30 days, including today. |
| `from="2026-08-01" to="2026-08-31"` | 1–31 August, `to` included. |
| `timeframe="7" from="2026-08-01"` | Seven days from 1 August. |
| `timeframe="7" to="2026-08-31"` | The seven days ending 31 August. |
| `from="2026-08-01"` | 1 August through today. |

Dates are `YYYY-MM-DD` in UTC, and a range can span at most 92 days. With nothing set, you get the last 7 days.

Changing any of these redraws the existing chart rather than remounting it, so a date picker wired straight to the attributes does the right thing.

## Attributes

| Attribute | Required | Description |
| --- | --- | --- |
| `session-id` | yes | The graph, from the dashboard. |
| `user-id` | yes | The Terra user to render, or `example`. |
| `timeframe`, `from`, `to` | no | The date window (above). |
| `base-url` | no | Graph API base. Defaults to `https://api.tryterra.co/v2`. |

The element also sets `data-state` to `loading`, `ready` or `error`, so you can style around it, and `data-trace-id` on failure — quote that to Terra support and they can look up exactly what happened.

## Events

```js
const graph = document.querySelector("terra-graph");

graph.addEventListener("terra-graph:load", (e) => {
  console.log("drew", e.detail.payload.title);
});

graph.addEventListener("terra-graph:error", (e) => {
  console.error(e.detail.error.message, e.detail.error.traceId);
});
```

Neither event bubbles — listen on the element itself.

## Other frameworks

`<terra-graph>` is a standard custom element, so most frameworks take it as-is.

**Vue** — tell the compiler it is a custom element, in `vite.config.js`:

```js
vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === "terra-graph" } } });
```

```vue
<script setup>
import "@tryterra/graphs";
</script>

<template>
  <terra-graph :session-id="sessionId" :user-id="userId" timeframe="30" />
</template>
```

**Svelte** — no configuration needed:

```svelte
<script>
  import "@tryterra/graphs";
  export let sessionId, userId;
</script>

<terra-graph session-id={sessionId} user-id={userId} timeframe="30" />
```

**Angular** — add `CUSTOM_ELEMENTS_SCHEMA` to the module or component:

```ts
import "@tryterra/graphs";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";

@Component({ schemas: [CUSTOM_ELEMENTS_SCHEMA], template: `
  <terra-graph [attr.session-id]="sessionId" [attr.user-id]="userId" timeframe="30"></terra-graph>
` })
```

## Content Security Policy

The chart engine is loaded from Terra at render time, so a fix reaches every embed without you shipping an upgrade. If you run a CSP, allow:

```
script-src  https://api.tryterra.co;
connect-src https://api.tryterra.co;
font-src    https://fonts.gstatic.com;
style-src   https://fonts.googleapis.com;
```

The font entries are only needed if you keep Terra's typeface. Graphs render fine without it — the chart falls back to your system font stack.

## Server rendering

Importing this package on a server is a no-op: the element registers itself only in a browser. Next.js, Remix, Astro and SvelteKit need no special handling.

## Programmatic use

If you would rather drive the chart yourself than use the element:

```js
import { fetchPayload, loadRenderer, graphUrl } from "@tryterra/graphs";

const [renderer, payload] = await Promise.all([
  loadRenderer(),
  fetchPayload({ sessionId, userId, timeframe: 30 }),
]);

const chart = renderer.mount(document.getElementById("chart"), payload);
// chart.setTheme({ bg: "#0F172A", text: "#E2E8F0" })
// chart.update(nextPayload) / chart.resize() / chart.destroy()
```

`graphUrl({ sessionId, userId, timeframe: 30 })` returns the hosted page URL, if you want an iframe or a plain link after all.

## Colours

Graphs are styled in the dashboard, and every embed picks that styling up — change it there and your app follows without a deploy. For colours that have to track the host app, such as a dark-mode toggle, set the `theme` property:

```js
document.querySelector("terra-graph").theme = { bg: "#0F172A", text: "#E2E8F0", line: "#38BDF8" };
```

## Upgrading from 1.x

1.x exported a React component that rendered an iframe against the older token-based endpoint. 2.x has no iframe and no tokens:

- `<TerraGraph type token />` becomes `<terra-graph session-id user-id>` — or the React component in `@tryterra/graphs-react`.
- `type` (`DAILY_STEPS_SUMMARY` and friends) is gone. The graph and its metric are configured in the dashboard and referenced by `session-id`.
- `token` is gone. Nothing is minted per render; `user-id` names the user directly.
- `startDate` / `endDate` / `timePeriod` become `from` / `to` / `timeframe`.
- `getImg`, `imgWidth`, `imgHeight`, `getSmallTemplate` have no replacement: the server-side PNG and compact-template modes they drove are not implemented by the current Graph API.

## Docs

Full guide: [docs.tryterra.co/graphs](https://docs.tryterra.co/graphs)

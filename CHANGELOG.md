# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## 2.0.0 - 2026-08-19
### Added
- `@tryterra/graphs-react-native` — a `<TerraGraph />` that draws natively via `@wuba/react-native-echarts`, with no WebView. Its ECharts option building is generated verbatim from the web renderer, so the chart is the same one; the header, stats and sleep breakdown are native views.
- `IsoDate` — `from`/`to` are now typed as `YYYY-MM-DD` rather than `string`, so passing a `Date` is a compile error instead of an off-by-one day east of Greenwich. `toIsoDate(date)` converts one correctly.
- `<terra-graph>` validates its `from`/`to` attributes and reports a clear error, rather than forwarding a malformed date to the API.
- `@tryterra/graphs-react` — a React component, `<TerraGraph />`, with typed props, `onLoad` / `onError` callbacks, and no `dynamic()` wrapper needed for server rendering.
- `<terra-graph>` custom element, so Vue, Svelte, Angular and plain HTML embed a graph without a framework-specific package.
- `@tryterra/graphs` now exports `loadRenderer`, `fetchPayload` and `graphUrl` for driving the chart directly.
- Failures surface a Terra trace id, on the `data-trace-id` attribute and on the thrown `TerraGraphError`, so a broken graph can be looked up by support.

### Changed
- **Breaking.** Graphs render into your own DOM instead of an iframe, and are configured in the Terra dashboard rather than by graph type.
  - `<TerraGraph type token />` → `<terra-graph session-id user-id>`.
  - `type` (`DAILY_STEPS_SUMMARY` and friends) is gone: the metric, chart type and styling live on the graph you create in the dashboard.
  - `token` is gone: nothing is minted per render, and `user-id` names the user directly.
  - `startDate` / `endDate` / `timePeriod` → `from` / `to` / `timeframe`.
- The package no longer depends on React. `@tryterra/graphs-react` does.

### Removed
- **Breaking.** `getImg`, `imgWidth`, `imgHeight`, `getSmallTemplate` and `getReactNative`. These drove server-side options the current Graph API does not implement — a rendered PNG, a compact template and a React-Native-tuned one. They are gaps rather than decisions, and if they come back it will be as a server feature both this package and the hosted embed can use.

## 1.0.2 - 2022-09-01
Initial React iframe wrapper.

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `terra-graphs-react` — a React component, `<TerraGraph />`, with typed props, `onLoad` / `onError` callbacks, and no `dynamic()` wrapper needed for server rendering.
- `<terra-graph>` custom element, so Vue, Svelte, Angular and plain HTML embed a graph without a framework-specific package.
- `terra-graphs` now exports `loadRenderer`, `fetchPayload` and `graphUrl` for driving the chart directly.
- Failures surface a Terra trace id, on the `data-trace-id` attribute and on the thrown `TerraGraphError`, so a broken graph can be looked up by support.

### Changed

- **Breaking.** Graphs render into your own DOM instead of an iframe, and are configured in the Terra dashboard rather than by graph type.
  - `<TerraGraph type token />` → `<terra-graph session-id user-id>`.
  - `type` (`DAILY_STEPS_SUMMARY` and friends) is gone: the metric, chart type and styling live on the graph you create in the dashboard.
  - `token` is gone: nothing is minted per render, and `user-id` names the user directly.
  - `startDate` / `endDate` / `timePeriod` → `from` / `to` / `timeframe`.
- The package no longer depends on React. `terra-graphs-react` does.

### Removed

- **Breaking.** `getImg`, `imgWidth`, `imgHeight` and `getSmallTemplate`. The chart is live and responsive; there is no static-image mode.

## [1.0.2] - 2022-09-01

Initial React iframe wrapper.

/**
 * Everything in the package that does not touch React Native: the payload
 * fetching, the header's numbers, the chart-option builder, and the types.
 *
 * Importable on its own as `@tryterra/graphs-react-native/core` for two reasons.
 * It lets the test suite run these under plain Node — anything that reaches
 * `react-native` drags in Flow-typed source Node cannot parse — and it lets a
 * customer building their own chart surface reuse the fetching and the option
 * building without taking the component.
 */
export { DEFAULT_BASE_URL, fetchPayload, payloadUrl, type GraphSource } from "./payload";
export { formatDuration, headerStats, statFmt, type StatColumn } from "./stats";
export { TerraGraphError, toIsoDate, type GraphPayload, type GraphTheme, type IsoDate } from "./types";
export { buildChartOption } from "./option-builder.js";
export { plainTextTooltips, toPlainText } from "./tooltip";

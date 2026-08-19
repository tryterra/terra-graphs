/**
 * Types for the generated option-builder. Hand-written and checked in: the
 * generated file is copied verbatim from the web renderer, so it carries no
 * annotations and must not be edited to add any.
 */
import type { EChartsCoreOption } from "echarts/core";
import type { GraphPayload, GraphTheme } from "./types";

export interface OptionBuilderEnv {
  /** The echarts instance — the builder uses `echarts.graphic.LinearGradient`. */
  echarts: unknown;
  theme?: GraphTheme;
  fontFamily?: string;
}

/** Builds the ECharts option for a graph payload. Throws on a malformed payload. */
export function buildChartOption(payload: GraphPayload, env: OptionBuilderEnv): EChartsCoreOption;

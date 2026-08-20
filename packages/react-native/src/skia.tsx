/**
 * The Skia build, for apps that already carry `@shopify/react-native-skia` or
 * want its faster painting for very dense charts. Identical component and props
 * to the default entry — only the painter differs. See `./index.tsx` for why the
 * chart engine is bundled.
 *
 * Costs two more native modules than the default: Skia peer-requires
 * `react-native-reanimated` and `react-native-worklets`, and throws on first
 * render without them.
 *
 * The chart engine is a shared chunk, so importing this alongside the default
 * entry costs one engine and two painters rather than two of each.
 */
import SkiaChart, { SkiaRenderer } from "@wuba/react-native-echarts/skiaChart";

import { TerraGraph as Base, type TerraGraphProps as BaseProps } from "./TerraGraph";

/** Props for `<TerraGraph>`. The painter is built in, so there is none to pass. */
export type TerraGraphProps = Omit<BaseProps, "chart" | "renderer">;

/** A Terra graph, drawn with Skia. */
export function TerraGraph(props: TerraGraphProps) {
  return <Base {...props} chart={SkiaChart} renderer={SkiaRenderer} />;
}

export * from "./core";

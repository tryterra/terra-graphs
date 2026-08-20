/**
 * The default build: `<TerraGraph sessionId userId />`, drawn with
 * react-native-svg.
 *
 * React Native has no drawing surface of its own — no canvas, and ART was
 * removed from core — so a chart needs exactly one native module to paint into.
 * This entry picks the cheapest one: react-native-svg needs only React and
 * React Native, where Skia additionally drags in Reanimated and Worklets.
 * `@tryterra/graphs-react-native/skia` is there for apps that want Skia anyway.
 *
 * ECharts, zrender and the painter are bundled into this file rather than
 * resolved from the app's node_modules. That is not a packaging preference, it
 * is what makes the component installable:
 *
 *  - ECharts pins `tslib` to 2.3.0, whose package entry points resolve, under
 *    Metro, to an ES module handed to a CommonJS `require`. Bundling resolves
 *    tslib here instead, on Node, where that interop is correct.
 *  - The painter registers itself into zrender's module-level instance registry.
 *    If the app's zrender is a different copy from the one ECharts draws
 *    through, the chart initialises, reports success, and paints nothing.
 *    One bundle means one zrender, by construction.
 *
 * Import whichever entry you want; the chart engine lives in a shared chunk, so
 * importing both costs one engine and two painters, not two of each.
 */
import SvgChart, { SVGRenderer } from "@wuba/react-native-echarts/svgChart";

import { TerraGraph as Base, type TerraGraphProps as BaseProps } from "./TerraGraph";

/** Props for `<TerraGraph>`. The painter is built in, so there is none to pass. */
export type TerraGraphProps = Omit<BaseProps, "chart" | "renderer">;

/** A Terra graph, drawn with react-native-svg. */
export function TerraGraph(props: TerraGraphProps) {
  return <Base {...props} chart={SvgChart} renderer={SVGRenderer} />;
}

// The React-Native-free half is also published as
// `@tryterra/graphs-react-native/core`, for custom chart surfaces and so it can be
// tested under plain Node.
export * from "./core";

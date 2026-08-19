import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/core.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  target: "es2020",
  // Everything with a native half, plus echarts, stays external: the app links
  // one copy through its own resolution rather than carrying ours.
  external: [
    "react",
    "react-native",
    "echarts",
    "echarts/core",
    "echarts/charts",
    "echarts/components",
    "@wuba/react-native-echarts",
    "@shopify/react-native-skia",
    "react-native-svg",
  ],
});

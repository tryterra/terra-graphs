import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.tsx", "src/skia.tsx", "src/core.ts"],
  // ESM only. Code splitting is what keeps the two painter entries from each
  // carrying their own copy of ECharts, and esbuild cannot split CommonJS.
  // Metro resolves ESM from a dependency without help.
  format: ["esm"],
  splitting: true,
  dts: true,
  clean: true,
  target: "es2020",
  // Lists every module that ended up in the bundle. `npm run notices` reads it
  // so the licence file is derived from what we actually redistribute, rather
  // than from a list someone has to remember to update.
  metafile: true,
  // The chart engine ships *inside* this package. Bundling it is load-bearing,
  // not a size preference — see the comment at the top of src/index.tsx. The
  // short version: it is the only way to get correct tslib interop under Metro
  // without asking every app for a package.json override, and the only way to
  // guarantee the painter and ECharts share one zrender.
  noExternal: ["echarts", "zrender", "@wuba/react-native-echarts"],
  // Anything with a native half stays the app's to install and link.
  external: ["react", "react-native", "@shopify/react-native-skia", "react-native-svg"],
});

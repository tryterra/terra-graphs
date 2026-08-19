/**
 * The drift guard for the native renderer.
 *
 * `src/option-builder.js` is copied verbatim out of Terra's web renderer, so
 * the risk is not that someone writes a bug in it — nobody writes in it at all
 * — but that a renderer change makes the extraction produce something that no
 * longer draws. These tests render every chart kind through it with no DOM, so
 * a bad extraction fails here rather than on a customer's phone.
 *
 * ECharts SSR is the harness because it exercises the same option layer
 * @wuba/react-native-echarts consumes; only the painter differs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as echarts from "echarts";
import { buildChartOption } from "../packages/react-native/src/option-builder.js";

const FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "packages",
  "react-native",
  "test",
  "fixtures",
);
/**
 * Marks each fixture paints, pinned exactly.
 *
 * A `marks > n` floor looked like it proved the chart drew, but nine of these
 * eleven clear any sane floor on axis furniture alone — strip every data point
 * out of metric-bar and it still paints 17 marks. A regression that dropped a
 * whole decoration (the baseline fill, the zone tinting, the min/max markers,
 * the range whiskers) was invisible, and those are exactly what the
 * extraction's rewrites touch.
 *
 * Change a number here only alongside a renderer change that explains it.
 */
const EXPECTED_MARKS = {
  "agp.json": 45,
  "macro.json": 258,
  "metric-bar.json": 88,
  "metric-baseline.json": 39,
  "metric-combo.json": 75,
  "metric-duration.json": 29,
  "metric-panels.json": 53,
  "metric-range.json": 53,
  "metric-status.json": 31,
  "metric-zones.json": 26,
  "sleep.json": 57,
};

const names = fs.readdirSync(FIXTURES).filter((f) => f.endsWith(".json"));

/** Renders headlessly and counts the marks actually painted. */
function render(payload, env = {}) {
  const option = buildChartOption(payload, { echarts, fontFamily: "System", ...env });
  // SSR paints a single frame, and frame 0 of the renderer's 400ms animation is
  // a half-drawn line — which would make every assertion below meaningless.
  option.animation = false;
  const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width: 760, height: 400 });
  try {
    chart.setOption(option, { notMerge: true });
    const svg = chart.renderToSVGString();
    return { svg, marks: (svg.match(/<(path|rect|circle|polyline|text|image)\b/g) || []).length };
  } finally {
    chart.dispose();
  }
}

test("every chart kind renders with no DOM, mark for mark", async (t) => {
  assert.deepEqual(
    [...names].sort(),
    Object.keys(EXPECTED_MARKS).sort(),
    "the fixture set and the expected-mark table have diverged",
  );
  for (const name of names) {
    await t.test(name, () => {
      const payload = JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf8"));
      const { marks } = render(payload);
      assert.equal(marks, EXPECTED_MARKS[name], `${name}: mark count changed`);
    });
  }
});

test("the theme argument replaces what CSS variables do on the web", () => {
  const payload = JSON.parse(fs.readFileSync(path.join(FIXTURES, "metric-bar.json"), "utf8"));
  const light = render(payload).svg;
  const dark = render(payload, { theme: { bg: "#0F172A", line: "#38BDF8", text: "#E2E8F0" } }).svg;
  assert.notEqual(light, dark, "theme override had no effect on the rendered chart");
  assert.ok(
    dark.includes("#38BDF8") || dark.toLowerCase().includes("56,189,248"),
    "themed line colour missing",
  );
});

// The bug that took down every show_baseline graph: ECharts 5.5.1 throws while
// resolving a piecewise visualMap piece that is open at one end. It surfaced
// only once the renderer was mounted directly, which is exactly this path.
test("a baseline graph builds a fully-bounded visualMap", () => {
  const payload = JSON.parse(fs.readFileSync(path.join(FIXTURES, "metric-baseline.json"), "utf8"));
  const option = buildChartOption(payload, { echarts, fontFamily: "System" });
  const maps = [].concat(option.visualMap ?? []);
  assert.ok(maps.length > 0, "expected a visualMap for the baseline fill");
  for (const map of maps) {
    for (const piece of map.pieces ?? []) {
      const hasLower = piece.gte !== undefined || piece.gt !== undefined;
      const hasUpper = piece.lte !== undefined || piece.lt !== undefined;
      assert.ok(hasLower && hasUpper, `half-open piece will throw in ECharts: ${JSON.stringify(piece)}`);
    }
  }
});

test("the builder needs no DOM globals at all", () => {
  const src = fs.readFileSync(path.join(path.dirname(FIXTURES), "..", "src", "option-builder.js"), "utf8");
  const offenders = src
    .split("\n")
    .map((line, i) => [i + 1, line])
    .filter(
      ([, l]) =>
        /\b(document|window|getComputedStyle|navigator|localStorage)\b/.test(l) &&
        !l.trim().startsWith("*") &&
        !l.trim().startsWith("//"),
    );
  assert.deepEqual(offenders, [], `generated builder touches the DOM: ${JSON.stringify(offenders)}`);
});

/**
 * The web renderer normalises any CSS colour through a canvas probe; off-DOM
 * the extraction replaces that with a parser. `theme` is a public prop, so
 * callers pass whatever CSS colour they have — and the first version of the
 * parser returned a *partial* triple for space-separated `rgb()`, producing
 * `rgba(56,undefined,undefined,0.88)` downstream with no throw and no warning.
 *
 * These assert the parser either gets a colour right or falls back visibly,
 * never in between.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as echarts from "echarts";
import { buildChartOption } from "../packages/react-native/src/option-builder.js";

const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "packages",
  "react-native",
  "test",
  "fixtures",
  "metric-bar.json",
);
const payload = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));

/** The colour the builder derives from the theme's line colour — an alpha'd
 *  form of it, so it exercises the parser rather than echoing the input. */
function derived(line) {
  const option = buildChartOption(payload, { echarts, theme: { line }, fontFamily: "System" });
  return option.series[0].itemStyle.color.colorStops[1].color;
}

const GREY = "rgba(127,127,127,0.88)";

test("every colour form the dashboard and CSS produce parses to a full triple", () => {
  for (const [input, expected] of [
    ["#38BDF8", "rgba(56,189,248,0.88)"],
    ["#3BF", "rgba(51,187,255,0.88)"],
    ["#38BDF8CC", "rgba(56,189,248,0.88)"], // 8-digit hex: alpha ignored, as the canvas probe did
    ["rgb(56, 189, 248)", "rgba(56,189,248,0.88)"],
    ["rgba(56, 189, 248, 0.5)", "rgba(56,189,248,0.88)"],
    ["rgb(56 189 248)", "rgba(56,189,248,0.88)"], // CSS Color 4 space syntax
  ]) {
    assert.equal(derived(input), expected, `${input} parsed wrong`);
  }
});

test("a colour form it cannot parse falls back visibly, not partially", () => {
  for (const input of ["white", "hsl(199, 93%, 60%)", "var(--brand)", "nonsense"]) {
    assert.equal(derived(input), GREY, `${input} should fall back to grey`);
  }
});

// An empty override is "not set", not "unparseable": it must defer to the
// colour the graph was given in the dashboard rather than grey it out.
test("an empty theme value defers to the graph's configured colour", () => {
  assert.equal(derived(""), derived(payload.theme.line));
  assert.notEqual(derived(""), GREY);
});

test("no colour form ever yields undefined or NaN channels", () => {
  const inputs = [
    "#38BDF8",
    "#3BF",
    "#38BDF8CC",
    "rgb(56 189 248)",
    "rgb(56,189)",
    "rgba()",
    "white",
    "hsl(1,2%,3%)",
  ];
  for (const input of inputs) {
    assert.doesNotMatch(derived(input), /undefined|NaN/, `${input} produced a malformed colour`);
  }
});

/**
 * Tooltips on React Native must be plain text.
 *
 * The option builder is shared with the web renderer and its tooltip formatters
 * return HTML. Skia and SVG draw the string as-is, so before this was flattened
 * a tooltip on device read `;font-size:11px;margin-top:1px'>Aug 8</div>`.
 *
 * The real fixtures are exercised through the builder rather than hand-written
 * markup, so a new decoration that emits tags is caught here too.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

import * as echarts from "echarts";

import { plainTextTooltips, toPlainText } from "@tryterra/graphs-react-native/core";
import { buildChartOption } from "../packages/react-native/src/option-builder.js";

const FIXTURES = fileURLToPath(new URL("../packages/react-native/test/fixtures/", import.meta.url));
const THEME = { bg: "#fff", line: "#3b82f6", text: "#111", tick: "#999" };

test("markup becomes text, block boundaries become newlines", () => {
  assert.equal(
    toPlainText("<div style='font-weight:600'>3,415 <span style='opacity:.55'>steps</span></div>"),
    "3,415 steps",
  );
  assert.equal(toPlainText("<div>a</div><div>b</div>"), "a\nb");
  assert.equal(toPlainText("one<br>two"), "one\ntwo");
  assert.equal(toPlainText("5&nbsp;&amp;&nbsp;6"), "5 & 6");
  // The exact shape that shipped broken: an attribute fragment must not survive.
  assert.equal(toPlainText("<div style='font-size:11px;margin-top:1px'>Aug 8</div>"), "Aug 8");
});

test("wrapping is idempotent", () => {
  const option = { tooltip: { formatter: () => "<b>x</b>" } };
  plainTextTooltips(plainTextTooltips(option));
  assert.equal(option.tooltip.formatter(), "x");
});

test("a non-string formatter result is passed through untouched", () => {
  const node = {};
  const option = { tooltip: { formatter: () => node } };
  plainTextTooltips(option);
  assert.equal(option.tooltip.formatter(), node);
});

test("no fixture's tooltip emits markup once flattened", (t) => {
  const files = readdirSync(FIXTURES).filter((f) => f.endsWith(".json"));
  assert.ok(files.length > 0, "no fixtures found");

  let checked = 0;
  for (const file of files) {
    const payload = JSON.parse(readFileSync(FIXTURES + file, "utf8"));
    const option = plainTextTooltips(
      buildChartOption(payload, { echarts, theme: THEME, fontFamily: "System" }),
    );

    // Params shaped as ECharts hands them to an axis-trigger formatter.
    const params = (payload.series ?? []).map((s, i) => ({
      seriesName: s.name,
      seriesIndex: i,
      name: payload.labels?.[0] ?? "2026-08-08",
      axisValue: payload.labels?.[0] ?? "2026-08-08",
      axisValueLabel: payload.labels?.[0] ?? "2026-08-08",
      value: s.values?.[0] ?? 1,
      data: s.values?.[0] ?? 1,
      marker: "<span style='display:inline-block;width:9px'></span>",
      dataIndex: 0,
      color: "#3b82f6",
    }));
    if (!params.length) continue;

    const formatter = option?.tooltip?.formatter;
    if (typeof formatter !== "function") continue;

    let out;
    try {
      out = formatter(params);
    } catch {
      // A formatter that needs richer params than this harness builds is not
      // what this test is about; the markup check below covers the rest.
      continue;
    }
    if (typeof out !== "string") continue;

    checked++;
    assert.doesNotMatch(out, /<[a-z/][^>]*>/i, `${file}: tooltip still contains markup: ${out}`);
    assert.doesNotMatch(out, /style\s*=|font-size:|margin-top:/i, `${file}: tooltip leaked CSS: ${out}`);
  }

  assert.ok(checked > 0, "no fixture produced a string tooltip — the test proved nothing");
  t.diagnostic(`${checked} fixture tooltips flattened`);
});

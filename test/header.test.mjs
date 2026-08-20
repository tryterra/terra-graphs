/**
 * The native header reimplements two number formatters that also live in the
 * web renderer (`statFmt`, `formatDuration`). They are small, so copying was
 * cheaper than plumbing them out — but copies drift, and a drifted one shows up
 * as "the app says 7,630 steps and the dashboard says 7630", which reads as a
 * data bug.
 *
 * This lifts the real functions out of the renderer source and checks the
 * native header agrees with them on the values the fixtures actually contain.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { headerStats } from "@tryterra/graphs-react-native/core";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = path.join(ROOT, "packages", "react-native", "test", "fixtures");
const RENDERER = path.join(ROOT, "packages", "react-native", "src", "option-builder.js");

/** Pulls a named function out of the generated builder and evaluates it, so the
 *  comparison is against the renderer's real code rather than a restatement. */
function rendererFn(name) {
  const src = fs.readFileSync(RENDERER, "utf8");
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start > 0, `${name} not found in the renderer — has it been renamed?`);
  // Balance braces from the function's opening one.
  let depth = 0;
  let i = src.indexOf("{", start);
  const from = i;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) break;
  }
  const body = src.slice(from + 1, i);
  const args = src.slice(src.indexOf("(", start) + 1, src.indexOf(")", start));
  return new Function(args, body);
}

test("the native header formats numbers exactly as the renderer does", () => {
  const statFmt = rendererFn("statFmt");
  const values = [null, 0, 0.04, 1.25, 9.99, 10, 42, 3103.5, 7630, 12345.6, -5.5];
  for (const v of values) {
    // headerStats runs the same logic through a synthetic payload.
    const [column] = headerStats({
      kind: "metric",
      title: "t",
      headerStats: ["average"],
      stats: { average: v, unit: "" },
    });
    assert.equal(column.value, statFmt(v), `statFmt disagreed on ${v}`);
  }
});

test("the native header formats durations exactly as the renderer does", () => {
  const formatDuration = rendererFn("formatDuration");
  for (const unit of ["h", "m", "s"]) {
    for (const v of [null, 0, 0.5, 1, 7.2, 45, 90.7]) {
      const [column] = headerStats({
        kind: "metric",
        title: "t",
        headerStats: ["average"],
        stats: { average: v, unit, format: "duration" },
      });
      // The native header splits the unit into its own span; rejoin to compare.
      assert.equal(
        `${column.value}${column.unit}`.trim(),
        formatDuration(v, unit).trim(),
        `formatDuration disagreed on ${v}${unit}`,
      );
    }
  }
});

test("every fixture produces the header stats its payload asked for", () => {
  for (const name of fs.readdirSync(FIXTURES).filter((f) => f.endsWith(".json"))) {
    const payload = JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf8"));
    const columns = headerStats(payload);
    const expected = payload.kind === "sleep" ? 2 : payload.stats ? (payload.headerStats?.length ?? 0) : 0;
    assert.equal(columns.length, expected, `${name}: wrong number of stat columns`);
    for (const c of columns) {
      assert.equal(typeof c.value, "string");
      assert.notEqual(c.value, "", `${name}: an empty stat value would render a blank column`);
    }
  }
});

// A sleep graph for a night with no data arrives with no labels. This used to
// throw inside splitUnits during render — outside the card's error handling,
// so it took the screen down rather than showing the error state.
test("a sleep payload with no labels renders no stats instead of throwing", () => {
  assert.deepEqual(headerStats({ kind: "sleep", title: "t", sleep: { stages: [] } }), []);
  assert.deepEqual(
    headerStats({ kind: "sleep", title: "t", sleep: { stages: [], durationLabel: "7h 20min" } }),
    [{ value: "7h 20min", unit: "", label: "duration" }],
  );
});

// Splitting on the last letter run cut "7h 20min" into "7h 20" + "min", which
// set the "h" at heading size and only "min" as a unit. A compound label is
// left whole; a plain one still splits.
test("only a plain number-and-unit label is split", () => {
  const only = (payload) => headerStats(payload)[0];
  assert.deepEqual(only({ kind: "sleep", title: "t", sleep: { stages: [], durationLabel: "7h 20min" } }), {
    value: "7h 20min",
    unit: "",
    label: "duration",
  });
  assert.deepEqual(only({ kind: "sleep", title: "t", sleep: { stages: [], durationLabel: "45min" } }), {
    value: "45",
    unit: "min",
    label: "duration",
  });
});

// statFmt renders the null placeholder; it must not be mistaken for a unit.
test("the null placeholder is never split into a unit", () => {
  const [column] = headerStats({
    kind: "metric",
    title: "t",
    headerStats: ["average"],
    stats: { average: null, unit: "bpm" },
  });
  assert.equal(column.value, "–");
});

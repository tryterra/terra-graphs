/**
 * Generates src/option-builder.js from Terra's web renderer.
 *
 * The chart's shape lives in one place — terra-v6's `terra-graph.js` — and this
 * copies the pure half of it out verbatim, between the `terra-graph:option-builder`
 * markers. Only three lines are rewritten, all of them DOM reads that a native
 * renderer supplies directly. Nothing else is edited, by design: the moment
 * anyone hand-tunes the generated file, the mobile chart starts drifting from
 * the web one and no test can tell you which is right.
 *
 *   node scripts/extract-option-builder.mjs                       # live renderer
 *   node scripts/extract-option-builder.mjs ../../../terra-v6/... # local file
 *
 * Re-run after any renderer change and commit the result; `npm test` renders
 * every chart kind through it, so a broken extraction fails there.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "src", "option-builder.js");
const LIVE = "https://api.tryterra.co/v2/graphs/embed.js";

/**
 * Finds a marked region. The marker name must be followed by whitespace or the
 * end of the line — `option-builder` is a prefix of `option-builder-helpers`,
 * so a plain substring search silently matches the wrong marker and extracts
 * the wrong region.
 */
const region = (src, name) => {
  const at = (arrow) => {
    const m = new RegExp(`${arrow} terra-graph:${name}(?=\\s|$)`).exec(src);
    return m ? m.index : -1;
  };
  const start = at(">>>");
  const end = at("<<<");
  if (start < 0 || end < 0) {
    throw new Error(
      `no '${name}' markers in the renderer. They are comments in terra-v6's ` +
        `terra-graph.js; if they were removed, restore them rather than pinning line numbers here.`,
    );
  }
  if (end < start) {
    throw new Error(`'${name}' markers are out of order in the renderer`);
  }
  // Drop the marker's own comment line, keep everything after it.
  return src.slice(src.indexOf("\n", start) + 1, end).replace(/[ \t]*\/\/[^\n]*$/, "");
};

/** The three DOM reads, and what replaces them. Order matters: exact matches. */
const REWRITES = [
  {
    what: "theme read (getComputedStyle on the host element)",
    from: `    var cssVars = function () {
      var style = getComputedStyle(host);
      var fallback = payload.theme || {};
      return {
        bg:   style.getPropertyValue("--background-color").trim() || fallback.bg,
        line: style.getPropertyValue("--line-color").trim() || fallback.line,
        text: style.getPropertyValue("--text-color").trim() || fallback.text,
        tick: style.getPropertyValue("--tick-color").trim() || fallback.tick,
        chartType: (style.getPropertyValue("--chart-type").trim() || payload.chartType) === "bar" ? "bar" : "line"
      };
    };`,
    to: `    // On the web the live theme comes from CSS custom properties; here the
    // caller passes it in, with the payload's own theme as the fallback.
    var cssVars = function () {
      var fallback = payload.theme || {};
      var o = env.theme || {};
      return {
        bg:   o.bg   || fallback.bg,
        line: o.line || fallback.line,
        text: o.text || fallback.text,
        tick: o.tick || fallback.tick,
        chartType: (o.chartType || payload.chartType) === "bar" ? "bar" : "line"
      };
    };`,
  },
  {
    what: "colour normalisation (canvas fillStyle probe)",
    from: `    function rgb(color) {
      var probe = document.createElement("canvas").getContext("2d");
      probe.fillStyle = color;
      var hex = probe.fillStyle; // normalized #rrggbb
      return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    }`,
    to: `    // The web build normalises any CSS colour through a canvas. Off-DOM we parse
    // the forms the payload and the dashboard's theme presets produce: 3-, 6- and
    // 8-digit hex (alpha ignored, as the canvas probe did) and rgb()/rgba() with
    // either comma or space separators. Anything else — a named colour, hsl() —
    // falls back to mid-grey, which is visible but never wrong-looking. Only a
    // complete triple is returned: a partial one would yield
    // "rgba(56,undefined,undefined,0.88)" downstream, silently.
    function rgb(color) {
      var s = String(color || "").trim();
      var m = /^#([0-9a-f]{3})$/i.exec(s);
      if (m) return m[1].split("").map(function (c) { return parseInt(c + c, 16); });
      m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(s);
      if (m) return [0, 2, 4].map(function (i) { return parseInt(m[1].slice(i, i + 2), 16); });
      m = /^rgba?\\(([^)]+)\\)$/i.exec(s);
      if (m) {
        var parts = m[1].split(/[\\s,\\/]+/).filter(Boolean).slice(0, 3).map(function (p) { return parseInt(p, 10); });
        if (parts.length === 3 && parts.every(function (n) { return !isNaN(n); })) return parts;
      }
      return [127, 127, 127];
    }`,
  },
  {
    what: "chart font (computed style of the host)",
    from: `        textStyle: { fontFamily: getComputedStyle(host).fontFamily },`,
    to: `        textStyle: { fontFamily: env.fontFamily },`,
  },
];

const source = process.argv[2];
const src = source
  ? fs.readFileSync(source, "utf8")
  : await (await fetch(LIVE)).text().catch(() => {
      throw new Error(`could not fetch ${LIVE}; pass a local terra-graph.js path instead`);
    });

if (!src.includes("terra-graph:option-builder")) {
  throw new Error(
    source
      ? `${source} has no option-builder markers — is it terra-graph.js?`
      : `${LIVE} has no option-builder markers. If the renderer has not been deployed since the markers were added, pass a local terra-graph.js path.`,
  );
}

let body = region(src, "option-builder") + "\n" + region(src, "option-builder-helpers");

for (const r of REWRITES) {
  if (!body.includes(r.from)) {
    throw new Error(
      `could not rewrite the ${r.what}: the renderer no longer contains the expected code. ` +
        `Update REWRITES in this script to match, then re-run the tests.`,
    );
  }
  body = body.replace(r.from, r.to);
}

// Two classes of escape, both silent if they get through.
//
// Browser globals are the obvious one. `host` and `opts` are the subtle one:
// the marked region lives inside the renderer's `mount(host, payload, opts)`,
// but the generated wrapper supplies only `payload`, `env` and `echarts`. A
// surviving reference to either extracts cleanly, renders fine, and throws
// ReferenceError on a customer's phone the first time that path runs — a
// tooltip formatter, say, which no test here ever invokes.
const FORBIDDEN = /\b(document|window|globalThis|getComputedStyle|navigator|localStorage|host|opts)\b/;
const leaks = body
  .split("\n")
  .map((line, i) => [i + 1, line])
  .filter(([, l]) => FORBIDDEN.test(l) && !l.trim().startsWith("//") && !l.trim().startsWith("*"));
if (leaks.length) {
  throw new Error(
    "the extracted builder references something the native wrapper does not provide,\n" +
      "so it would fail at runtime rather than here:\n" +
      leaks.map(([n, l]) => `  line ${n}: ${l.trim()}`).join("\n"),
  );
}

fs.writeFileSync(
  OUT,
  `/**
 * GENERATED — do not edit. Run scripts/extract-option-builder.mjs.
 *
 * Copied verbatim from Terra's web renderer (terra-v6 terra-graph.js) between
 * its \`terra-graph:option-builder\` markers, with three DOM reads replaced:
${REWRITES.map((r) => ` *   - ${r.what}`).join("\n")}
 *
 * Editing this file by hand makes the native chart differ from the web one,
 * which is indistinguishable from a data bug. Change the renderer instead.
 */

/**
 * Builds an ECharts option from a Terra graph payload.
 *
 * @param {object} payload  the chart payload, from \`?format=json\`
 * @param {{echarts: object, theme?: object, fontFamily?: string}} env
 */
export function buildChartOption(payload, env) {
  env = env || {};
  if (!env.fontFamily) env.fontFamily = "System";
  // The builder reaches for echarts.graphic.LinearGradient, so the caller
  // supplies the instance rather than this module importing a second copy.
  var echarts = env.echarts;
  {
${body}
    return buildOption();
  }
}
`,
);

console.log(
  `wrote ${path.relative(process.cwd(), OUT)} (${body.split("\n").length} lines from the renderer)`,
);

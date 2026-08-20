/**
 * Guards on the *built* React Native bundle.
 *
 * Both invariants here fail silently at runtime, which is why they are asserted
 * against the artifact rather than left to review:
 *
 *  - A surviving `tslib` import means the app crashes on launch under Metro
 *    ("Cannot read property '__extends' of undefined"), because Metro resolves
 *    tslib 2.3.0's exports map to an ES module and hands it to a `require`.
 *  - A second zrender copy means the painter registers into an instance ECharts
 *    does not draw through. `init` succeeds, `setOption` succeeds, `onLoad`
 *    fires, and the chart is blank. Nothing throws. This has happened twice.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const DIST = fileURLToPath(new URL("../packages/react-native/dist/", import.meta.url));
const js = () => readdirSync(DIST).filter((f) => f.endsWith(".js"));
const read = (f) => readFileSync(DIST + f, "utf8");

test("the bundle carries no tslib import", () => {
  const files = js();
  assert.ok(files.length > 0, "dist is empty — did the build run?");
  for (const f of files) {
    assert.doesNotMatch(
      read(f),
      /(?:from|require\()\s*["']tslib["']/,
      `${f} imports tslib; Metro will resolve it to the wrong module format and the app will crash on launch`,
    );
  }
});

test("exactly one zrender is bundled", () => {
  const all = js().map(read).join("\n");

  // zrender's module-level instance registry. One declaration per copy; esbuild
  // renames the second to painterCtors2, which is the tell.
  const registries = all.match(/^var painterCtors\d* = \{\}/gm) ?? [];
  assert.equal(
    registries.length,
    1,
    `found ${registries.length} zrender instance registries (${registries.join(", ")}) — ` +
      "the painter and ECharts must share one zrender or every chart renders blank",
  );

  const paths = new Set((all.match(/^\/\/ .*zrender\/lib\/zrender\.js$/gm) ?? []).map((s) => s.trim()));
  assert.equal(paths.size, 1, `zrender resolved from ${paths.size} paths: ${[...paths].join(", ")}`);
});

test("each painter entry pulls only its own native module", () => {
  assert.doesNotMatch(
    read("skia.js"),
    /react-native-svg/,
    "the Skia entry must not drag in react-native-svg",
  );
  assert.doesNotMatch(
    read("index.js"),
    /@shopify\/react-native-skia/,
    "the default (SVG) entry must not drag in Skia",
  );
});

test("nothing but native modules is left for the app to resolve", () => {
  const allowed = new Set([
    "react",
    "react/jsx-runtime",
    "react-native",
    "@shopify/react-native-skia",
    "react-native-svg",
  ]);
  // Anchored at a line-leading `import`, so a bare string inside ECharts that
  // happens to follow the word "from" is not mistaken for a dependency.
  const IMPORTS = /^import\s(?:[^;"]*?from\s*)?"([^"]+)"/gm;

  let checked = 0;
  for (const f of js()) {
    for (const m of read(f).matchAll(IMPORTS)) {
      const spec = m[1];
      if (spec.startsWith("./") || spec.startsWith("../")) continue;
      checked++;
      assert.ok(
        allowed.has(spec),
        `${f} expects the app to provide "${spec}"; only native modules may stay external`,
      );
    }
  }
  assert.ok(checked > 0, "no bare imports found at all — the matcher is broken, not the bundle");
});

/**
 * The extraction script is the only thing standing between a renderer change
 * and a silently-broken native chart, so these break the renderer on purpose
 * and check it refuses.
 *
 * A guard that has never fired has proven nothing — one of these caught a real
 * bug: `option-builder` is a prefix of `option-builder-helpers`, so a substring
 * marker search matched the wrong marker and extracted the wrong region.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKG = path.join(ROOT, "packages", "react-native");
const SCRIPT = path.join(PKG, "scripts", "extract-option-builder.mjs");
const RENDERER = path.resolve(
  ROOT,
  "..",
  "terra-v6",
  "services",
  "api",
  "dist",
  "static",
  "graphs",
  "terra-graph.js",
);

const available = fs.existsSync(RENDERER);
const opts = { skip: available ? false : "needs a terra-v6 checkout beside this repo" };

/** Runs the extractor against a mutated renderer; resolves to its stderr. */
async function extractFails(mutate) {
  const src = mutate(fs.readFileSync(RENDERER, "utf8"));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "terra-graph-"));
  const file = path.join(dir, "terra-graph.js");
  fs.writeFileSync(file, src);
  // The generated file is committed; restore it whatever happens.
  const committed = fs.readFileSync(path.join(PKG, "src", "option-builder.js"), "utf8");
  try {
    await run("node", [SCRIPT, file], { cwd: PKG });
    return null; // it should not have succeeded
  } catch (err) {
    return String(err.stderr ?? err.message);
  } finally {
    fs.writeFileSync(path.join(PKG, "src", "option-builder.js"), committed);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("refuses a renderer whose markers were removed", opts, async () => {
  const stderr = await extractFails((s) => s.replace(">>> terra-graph:option-builder —", "REMOVED"));
  assert.ok(stderr, "extraction should have failed");
  assert.match(stderr, /markers/, stderr.slice(0, 300));
});

test("refuses a DOM reference inside the marked region", opts, async () => {
  const stderr = await extractFails((s) =>
    s.replace(
      "    var cssVars = function () {",
      "    var sneaky = document.title;\n    var cssVars = function () {",
    ),
  );
  assert.ok(stderr, "extraction should have failed");
  assert.match(stderr, /touches the DOM/, stderr.slice(0, 300));
});

test("refuses when a DOM read it rewrites has changed shape", opts, async () => {
  const stderr = await extractFails((s) =>
    s.replace(
      "textStyle: { fontFamily: getComputedStyle(host).fontFamily },",
      "textStyle: { fontFamily: hostFont() },",
    ),
  );
  assert.ok(stderr, "extraction should have failed");
  assert.match(stderr, /could not rewrite/, stderr.slice(0, 300));
});

test("regenerating from the real renderer reproduces the committed file", opts, async () => {
  const before = fs.readFileSync(path.join(PKG, "src", "option-builder.js"), "utf8");
  await run("node", [SCRIPT, RENDERER], { cwd: PKG });
  const after = fs.readFileSync(path.join(PKG, "src", "option-builder.js"), "utf8");
  if (before !== after) {
    fs.writeFileSync(path.join(PKG, "src", "option-builder.js"), before);
    assert.fail(
      "src/option-builder.js is out of date with the renderer — re-run " +
        "scripts/extract-option-builder.mjs and commit the result",
    );
  }
});

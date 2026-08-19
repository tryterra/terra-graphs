/**
 * The extraction script is the only thing standing between a renderer change
 * and a silently-broken native chart, so these break a renderer on purpose and
 * check it refuses.
 *
 * A guard that has never fired has proven nothing — one of these caught a real
 * bug: `option-builder` is a prefix of `option-builder-helpers`, so the
 * substring marker search matched the wrong marker and extracted the wrong
 * region, silently.
 *
 * The mutations run against a small stand-in renderer so they work anywhere,
 * including CI. Two further tests use the real one and skip without it: whether
 * the guards work is checkable in isolation, whether the real renderer still
 * matches is not.
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
const GENERATED = path.join(PKG, "src", "option-builder.js");
const FAKE = path.join(PKG, "test", "fake-renderer.js");
const REAL = path.resolve(
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

/** Runs the extractor over a mutated renderer, restoring the committed output
 *  whatever happens. Returns stderr, or null if it wrongly succeeded. */
async function extract(source, mutate = (s) => s) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "terra-graph-"));
  const file = path.join(dir, "terra-graph.js");
  fs.writeFileSync(file, mutate(fs.readFileSync(source, "utf8")));
  const committed = fs.readFileSync(GENERATED, "utf8");
  try {
    await run("node", [SCRIPT, file], { cwd: PKG });
    return null;
  } catch (err) {
    return String(err.stderr ?? err.message);
  } finally {
    fs.writeFileSync(GENERATED, committed);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("the stand-in renderer is one the extractor accepts", async () => {
  // Otherwise every mutation below would "pass" for the wrong reason.
  assert.equal(await extract(FAKE), null, "the unmutated stand-in should extract cleanly");
});

test("refuses a renderer whose markers were removed", async () => {
  const stderr = await extract(FAKE, (s) => s.replace(">>> terra-graph:option-builder —", "REMOVED"));
  assert.ok(stderr, "extraction should have failed");
  // Specifically "no markers", not "out of order": a substring marker search
  // matches `option-builder-helpers` here and fails the other way, which is the
  // bug this whole file exists to catch.
  assert.match(stderr, /no 'option-builder' markers/, stderr.slice(0, 300));
});

test("refuses a DOM reference smuggled into the marked region", async () => {
  const stderr = await extract(FAKE, (s) =>
    s.replace(
      "    var cssVars = function () {",
      "    var sneaky = document.title;\n    var cssVars = function () {",
    ),
  );
  assert.ok(stderr, "extraction should have failed");
  assert.match(stderr, /touches the DOM/, stderr.slice(0, 300));
});

test("refuses when a DOM read it rewrites has changed shape", async () => {
  const stderr = await extract(FAKE, (s) =>
    s.replace(
      "textStyle: { fontFamily: getComputedStyle(host).fontFamily },",
      "textStyle: { fontFamily: hostFont() },",
    ),
  );
  assert.ok(stderr, "extraction should have failed");
  assert.match(stderr, /could not rewrite/, stderr.slice(0, 300));
});

test("refuses markers that appear out of order", async () => {
  const stderr = await extract(FAKE, (s) =>
    s
      .replace(">>> terra-graph:option-builder —", "@@START@@")
      .replace("<<< terra-graph:option-builder", ">>> terra-graph:option-builder")
      .replace("@@START@@", "<<< terra-graph:option-builder"),
  );
  assert.ok(stderr, "extraction should have failed");
  assert.match(stderr, /out of order/, stderr.slice(0, 300));
});

// --- Against the real renderer, when it is checked out beside this repo -----

const real = { skip: fs.existsSync(REAL) ? false : "needs a terra-v6 checkout beside this repo" };

test("the real renderer still extracts cleanly", real, async () => {
  assert.equal(await extract(REAL), null, "the real renderer no longer extracts");
});

test("the committed builder is up to date with the real renderer", real, async () => {
  const before = fs.readFileSync(GENERATED, "utf8");
  await run("node", [SCRIPT, REAL], { cwd: PKG });
  const after = fs.readFileSync(GENERATED, "utf8");
  if (before !== after) {
    fs.writeFileSync(GENERATED, before);
    assert.fail("src/option-builder.js is stale — re-run scripts/extract-option-builder.mjs and commit it");
  }
});

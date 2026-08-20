import { test } from "node:test";
import assert from "node:assert/strict";

// Next.js and every other server renderer evaluates the import graph on the
// server, where there is no HTMLElement to extend and no customElements to
// register against. Importing has to be free there, or an app crashes before it
// ever reaches a browser. Running under plain node is the check.
test("importing on the server does not touch the DOM", async () => {
  assert.equal(typeof globalThis.window, "undefined", "this test is only meaningful without a DOM");

  const mod = await import("@tryterra/graphs");
  assert.equal(typeof mod.defineTerraGraph, "function");
  assert.doesNotThrow(() => mod.defineTerraGraph(), "defineTerraGraph must no-op on the server");
});

test("the React wrapper imports on the server too", async () => {
  const mod = await import("@tryterra/graphs-react");
  assert.equal(typeof mod.TerraGraph, "function");
});

test("loading the renderer on the server rejects rather than throwing", async () => {
  const { loadRenderer } = await import("@tryterra/graphs");
  await assert.rejects(loadRenderer(), /browser/);
});

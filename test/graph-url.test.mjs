import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BASE_URL, graphUrl } from "@tryterra/graphs";

const parse = (url) => {
  const u = new URL(url);
  return { path: u.pathname, params: Object.fromEntries(u.searchParams) };
};

test("defaults to the last week when no window is given", () => {
  // The API answers a window-less request with an error, so the package has to
  // pick one; 7 days is what the dashboard's own embed snippets use.
  const { path, params } = parse(graphUrl({ sessionId: "s1", userId: "u1" }, "json"));
  assert.equal(path, "/v2/graphs/s1/u1");
  assert.deepEqual(params, { format: "json", timeframe: "7" });
});

test("passes a date range through without adding a default timeframe", () => {
  const { params } = parse(graphUrl({ sessionId: "s", userId: "u", from: "2026-08-01", to: "2026-08-14" }));
  assert.deepEqual(params, { from: "2026-08-01", to: "2026-08-14" });
});

test("keeps timeframe and an anchor date together", () => {
  // timeframe + from means "seven days starting on that date" — one must not
  // silently drop the other.
  const { params } = parse(graphUrl({ sessionId: "s", userId: "u", timeframe: 7, from: "2026-08-01" }));
  assert.deepEqual(params, { timeframe: "7", from: "2026-08-01" });
});

test("omits an empty timeframe rather than sending it blank", () => {
  // An unset HTML attribute reaches the loader as "" via getAttribute.
  const { params } = parse(graphUrl({ sessionId: "s", userId: "u", timeframe: "" }));
  assert.deepEqual(params, { timeframe: "7" });
});

test("escapes ids into the path", () => {
  const { path } = parse(graphUrl({ sessionId: "a/b", userId: "c d" }));
  assert.equal(path, "/v2/graphs/a%2Fb/c%20d");
});

test("honours a custom base url and tolerates a trailing slash", () => {
  const a = graphUrl({ sessionId: "s", userId: "u", baseUrl: "https://eu.example.com/v2/" });
  const b = graphUrl({ sessionId: "s", userId: "u", baseUrl: "https://eu.example.com/v2" });
  assert.equal(a, b);
  assert.ok(a.startsWith("https://eu.example.com/v2/graphs/s/u?"));
});

test("renders the hosted page URL when no format is asked for", () => {
  const url = graphUrl({ sessionId: "s", userId: "example", timeframe: 30 });
  assert.ok(url.startsWith(`${DEFAULT_BASE_URL}/graphs/s/example?`));
  assert.ok(!url.includes("format="));
});

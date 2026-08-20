/**
 * `payloadUrl` in the React Native package is a deliberate reimplementation of
 * the web package's `graphUrl`: React Native ships its own partial
 * `URLSearchParams` on the global, which a bundler alias cannot replace and
 * whose `set`/`has` throw on older versions.
 *
 * A reimplementation is a copy, and copies drift — so these check the two agree
 * on every combination, rather than each being separately "reasonable".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { graphUrl } from "@tryterra/graphs";
import { payloadUrl } from "@tryterra/graphs-react-native/core";

const CASES = [
  { sessionId: "s", userId: "u" },
  { sessionId: "s", userId: "u", timeframe: 30 },
  { sessionId: "s", userId: "u", from: "2026-08-01" },
  { sessionId: "s", userId: "u", from: "2026-08-01", to: "2026-08-31" },
  { sessionId: "s", userId: "u", timeframe: 7, from: "2026-08-01" },
  { sessionId: "s", userId: "u", timeframe: 7, to: "2026-08-31" },
  { sessionId: "a/b", userId: "c d" },
  { sessionId: "s", userId: "u", baseUrl: "https://eu.example.com/v2" },
  { sessionId: "s", userId: "u", baseUrl: "https://eu.example.com/v2/" },
];

/** Compare by parts: the two build their query strings independently, so key
 *  order is not part of the contract. */
const parts = (url) => {
  const u = new URL(url);
  return { path: u.pathname, params: Object.fromEntries([...u.searchParams].sort()) };
};

test("the native URL builder agrees with the web one", () => {
  for (const source of CASES) {
    assert.deepEqual(
      parts(payloadUrl(source)),
      parts(graphUrl(source, "json")),
      `disagreed on ${JSON.stringify(source)}`,
    );
  }
});

test("the native builder always asks for the payload, not the page", () => {
  for (const source of CASES) {
    assert.match(payloadUrl(source), /[?&]format=json(&|$)/, JSON.stringify(source));
  }
});

test("a window-less request still gets one, since the API rejects none", () => {
  assert.match(payloadUrl({ sessionId: "s", userId: "u" }), /timeframe=7/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { toIsoDate } from "terra-graphs";

// The whole reason `from`/`to` are strings rather than `Date`s: the obvious
// conversion silently shifts the day for most of the world. A date picker hands
// you local midnight, and `toISOString()` reads that in UTC.
test("toIsoDate keeps the day a date picker actually selected", () => {
  const picked = new Date(2026, 7, 1); // what a picker gives for "1 August"
  assert.equal(toIsoDate(picked), "2026-08-01");

  // Demonstrate the trap this exists to avoid. In any timezone ahead of UTC the
  // naive conversion loses a day; assert the two disagree there, and that
  // toIsoDate is the one that matches the calendar.
  const naive = picked.toISOString().slice(0, 10);
  if (picked.getTimezoneOffset() < 0) {
    assert.notEqual(naive, "2026-08-01", "expected toISOString to shift the day east of UTC");
  }
});

test("toIsoDate zero-pads single-digit months and days", () => {
  assert.equal(toIsoDate(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(toIsoDate(new Date(2026, 11, 31)), "2026-12-31");
});

test("toIsoDate round-trips through graphUrl", async () => {
  const { graphUrl } = await import("terra-graphs");
  const url = graphUrl({ sessionId: "s", userId: "u", from: toIsoDate(new Date(2026, 7, 1)) });
  assert.ok(url.includes("from=2026-08-01"), url);
});

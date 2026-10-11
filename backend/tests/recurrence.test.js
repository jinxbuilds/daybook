import { test } from "node:test";
import assert from "node:assert/strict";
import { nextOccurrence, isValidDate } from "../src/lib/recurrence.js";

test("next occurrence", () => {
  assert.equal(nextOccurrence("2026-10-11", "daily"), "2026-10-12");
  assert.equal(nextOccurrence("2026-10-11", "weekly"), "2026-10-18");
  assert.equal(nextOccurrence("2026-10-10", "weekdays"), "2026-10-12"); // Sat -> Mon
  assert.equal(nextOccurrence("2026-01-31", "monthly"), "2026-02-28");
  assert.equal(nextOccurrence("2028-01-31", "monthly"), "2028-02-29");
  assert.equal(nextOccurrence("2026-12-15", "monthly"), "2027-01-15");
  assert.equal(nextOccurrence("2026-10-11", "none"), null);
});

test("date validation", () => {
  assert.ok(isValidDate("2026-10-11"));
  assert.ok(!isValidDate("2026-02-30"));
  assert.ok(!isValidDate("11/10/2026"));
});

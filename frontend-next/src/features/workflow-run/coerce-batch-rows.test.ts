/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import { coerceBatchRows } from "./coerce-batch-rows";
import type { WorkflowBatchRow } from "./types";

test("coerces image columns to positive integers", () => {
  const rows: WorkflowBatchRow[] = [{ prompt: "hi", hero: "123" }];
  expect(coerceBatchRows(rows, ["hero"])).toEqual({ rows: [{ prompt: "hi", hero: 123 }], errors: [] });
});

test("text columns stay strings", () => {
  const rows: WorkflowBatchRow[] = [{ prompt: "hi", num: "42" }];
  expect(coerceBatchRows(rows, [])).toEqual({ rows: [{ prompt: "hi", num: "42" }], errors: [] });
});

test("rejects empty image value with actionable row/column error", () => {
  const rows: WorkflowBatchRow[] = [{ prompt: "hi", hero: "" }];
  const res = coerceBatchRows(rows, ["hero"]);
  expect(res.errors).toEqual(['Row 1, column "hero": image asset ID is required.']);
  expect(res.rows[0].hero).toBe(""); // original preserved (preview honest)
});

test("rejects non-numeric image value", () => {
  const rows: WorkflowBatchRow[] = [{ hero: "abc" }];
  expect(coerceBatchRows(rows, ["hero"]).errors).toEqual([
    'Row 1, column "hero": "abc" is not a valid positive integer source asset ID.',
  ]);
});

test("rejects zero and negative image values", () => {
  const rows: WorkflowBatchRow[] = [{ a: "0", b: "-5" }];
  const res = coerceBatchRows(rows, ["a", "b"]);
  expect(res.errors).toEqual([
    'Row 1, column "a": "0" is not a valid positive integer source asset ID.',
    'Row 1, column "b": "-5" is not a valid positive integer source asset ID.',
  ]);
});

test("rejects float image values (integer required)", () => {
  expect(coerceBatchRows([{ hero: "1.5" }], ["hero"]).errors).toEqual([
    'Row 1, column "hero": "1.5" is not a valid positive integer source asset ID.',
  ]);
});

test("reports correct 1-based row index across multiple rows", () => {
  const rows: WorkflowBatchRow[] = [{ hero: "1" }, { hero: "x" }, { hero: "2" }];
  const res = coerceBatchRows(rows, ["hero"]);
  expect(res.rows.map((r) => r.hero)).toEqual([1, "x", 2]); // bad cell untouched
  expect(res.errors).toEqual(['Row 2, column "hero": "x" is not a valid positive integer source asset ID.']);
});

test("reports multiple bad cells in one row in column order", () => {
  const rows: WorkflowBatchRow[] = [{ a: "x", b: "y" }];
  const res = coerceBatchRows(rows, ["a", "b"]);
  expect(res.errors).toEqual([
    'Row 1, column "a": "x" is not a valid positive integer source asset ID.',
    'Row 1, column "b": "y" is not a valid positive integer source asset ID.',
  ]);
});

test("ignores imageFields not present in any row (no spurious errors)", () => {
  expect(coerceBatchRows([{ prompt: "hi" }], ["hero"])).toEqual({ rows: [{ prompt: "hi" }], errors: [] });
});

test("returns empty rows/errors for empty input", () => {
  expect(coerceBatchRows([], ["hero"])).toEqual({ rows: [], errors: [] });
});

test("does not mutate input rows", () => {
  const rows: WorkflowBatchRow[] = [{ hero: "123" }];
  coerceBatchRows(rows, ["hero"]);
  expect(rows[0].hero).toBe("123"); // original untouched
});

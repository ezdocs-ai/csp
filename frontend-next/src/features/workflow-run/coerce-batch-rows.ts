/** Copyright 2026 Google LLC — Apache-2.0
 * Pure coercion of parsed CSV batch rows: image columns -> positive integer
 * sourceAssetId, text columns stay string. Returns actionable row/column errors
 * for bad image values. No React, no side effects.
 *
 * Backend image arg union accepts a bare int sourceAssetId; text args are strings.
 */
import type { WorkflowBatchRow } from "./types";

export type CoerceResult = { rows: WorkflowBatchRow[]; errors: string[] };

/** Coerce image columns to positive integers; reject invalid values with a
 * row/column error. Text and other columns pass through unchanged. Rows are
 * preserved (errors block submission upstream); bad image cells keep their
 * original value so the preview stays honest. */
export function coerceBatchRows(rows: readonly WorkflowBatchRow[], imageFields: readonly string[]): CoerceResult {
  const errors: string[] = [];
  const imageSet = new Set(imageFields);
  const out: WorkflowBatchRow[] = rows.map((row, rowIndex) => {
    const next: WorkflowBatchRow = { ...row };
    for (const [name, raw] of Object.entries(row)) {
      if (!imageSet.has(name)) continue; // text stays string
      if (raw === null || raw === undefined || raw === "") {
        errors.push(`Row ${rowIndex + 1}, column "${name}": image asset ID is required.`);
        continue;
      }
      const num = Number(raw);
      if (!Number.isInteger(num) || num <= 0) {
        errors.push(`Row ${rowIndex + 1}, column "${name}": "${String(raw)}" is not a valid positive integer source asset ID.`);
        continue;
      }
      next[name] = num;
    }
    return next;
  });
  return { rows: out, errors };
}

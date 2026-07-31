/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useCallback } from "react";
import { coerceBatchRows } from "../coerce-batch-rows";
import type { WorkflowBatchRow } from "../types";

type CsvResult = { headers: string[]; rows: WorkflowBatchRow[]; errors: string[] };

function parseLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { fields.push(field.trim()); field = ""; }
    else field += char;
  }
  fields.push(field.trim());
  return fields;
}

export function useCsvParser(inputFields: string[], imageFields: readonly string[] = []) {
  return useCallback((text: string): CsvResult => {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
    if (!lines.length) return { headers: [], rows: [], errors: ["CSV is empty."] };
    const headers = parseLine(lines[0]);
    const errors = headers.length !== new Set(headers).size ? ["CSV headers must be unique."] : [];
    const missing = inputFields.filter((field) => !headers.includes(field));
    const unexpected = headers.filter((header) => !inputFields.includes(header));
    if (missing.length) errors.push(`Missing input fields: ${missing.join(", ")}.`);
    if (unexpected.length) errors.push(`Unknown input fields: ${unexpected.join(", ")}.`);
    const rawRows = lines.slice(1).flatMap((line, index) => {
      const values = parseLine(line);
      if (values.length !== headers.length) { errors.push(`Row ${index + 2} has ${values.length} values; expected ${headers.length}.`); return []; }
      return [Object.fromEntries(headers.map((header, valueIndex) => [header, values[valueIndex]]))];
    });
    const { rows, errors: coerceErrors } = coerceBatchRows(rawRows, imageFields);
    return { headers, rows, errors: [...errors, ...coerceErrors] };
  }, [inputFields, imageFields]);
}

/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import {
  batchResponseToUi,
  executionResponseToUi,
  toBatchRequest,
  toExecuteArgs,
  toExecuteDto,
} from "../mapper";

test("toExecuteArgs injects workspace_id (snake) when provided", () => {
  expect(toExecuteArgs({ prompt: "hi" }, 7)).toEqual({ prompt: "hi", workspace_id: 7 });
});

test("toExecuteArgs omits workspace_id when not provided", () => {
  expect(toExecuteArgs({ prompt: "hi" })).toEqual({ prompt: "hi" });
  expect(toExecuteArgs({ prompt: "hi" }, null)).toEqual({ prompt: "hi" });
});

test("toExecuteDto wraps inputs as {args}", () => {
  expect(toExecuteDto({ prompt: "hi" }, 3)).toEqual({ args: { prompt: "hi", workspace_id: 3 } });
});

test("toBatchRequest builds {items:[{row_index, args}]} with per-row workspace_id", () => {
  const req = toBatchRequest([{ a: "1" }, { a: "2" }], 9);
  expect(req).toEqual({
    items: [
      { row_index: 0, args: { a: "1", workspace_id: 9 } },
      { row_index: 1, args: { a: "2", workspace_id: 9 } },
    ],
  });
});

test("executionResponseToUi maps {execution_id} to a running UI execution", () => {
  expect(executionResponseToUi({ execution_id: "ex-1" }, "wf-1")).toEqual({
    id: "ex-1",
    workflowId: "wf-1",
    status: "running",
  });
});

test("batchResponseToUi maps SUCCESS->completed, FAILED->failed and carries error", () => {
  const ui = batchResponseToUi(
    {
      results: [
        { row_index: 0, execution_id: "e0", status: "SUCCESS" },
        { row_index: 1, status: "FAILED", error: "boom" },
      ],
    },
    "wf-1",
  );
  expect(ui.executions).toEqual([
    { id: "e0", workflowId: "wf-1", status: "completed", result: undefined },
    { id: "1", workflowId: "wf-1", status: "failed", result: { error: "boom" } },
  ]);
});

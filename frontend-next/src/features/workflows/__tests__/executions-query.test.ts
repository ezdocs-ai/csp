/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import {
  buildExecutionsQuery,
  mapExecutionStateToStatus,
  normalizeExecution,
  parseExecutionsResponse,
} from "../hooks/executions-query";

test("mapExecutionStateToStatus maps backend ACTIVE/SUCCEEDED/FAILED to UI running/completed/failed", () => {
  expect(mapExecutionStateToStatus("ACTIVE")).toBe("running");
  expect(mapExecutionStateToStatus("SUCCEEDED")).toBe("completed");
  expect(mapExecutionStateToStatus("FAILED")).toBe("failed");
  expect(mapExecutionStateToStatus("active")).toBe("running"); // case-insensitive
  expect(mapExecutionStateToStatus("STATE_SUCCEEDED")).toBe("completed"); // STATE_ prefix stripped
});

test("mapExecutionStateToStatus maps legacy/unknown states consistently", () => {
  expect(mapExecutionStateToStatus("RUNNING")).toBe("running");
  expect(mapExecutionStateToStatus("PENDING")).toBe("running");
  expect(mapExecutionStateToStatus("COMPLETED")).toBe("completed");
  expect(mapExecutionStateToStatus("CANCELLED")).toBe("stopped");
  expect(mapExecutionStateToStatus("UNEXPECTED")).toBe("stopped");
});

test("normalizeExecution maps backend fields to UI shape and stashes duration on result", () => {
  const ui = normalizeExecution({ id: "ex-9", state: "SUCCEEDED", start_time: "2026-01-01T00:00:00Z", duration: 42 }, "wf-1");
  expect(ui).toEqual({ id: "ex-9", workflowId: "wf-1", status: "completed", startTime: "2026-01-01T00:00:00Z", result: { duration: 42 } });
});

test("normalizeExecution prefers explicit result and folds step_entries into result when no result", () => {
  // Explicit result wins; step_entries ignored when result present.
  const withResult = normalizeExecution(
    { execution_id: "ex-2", state: "FAILED", end_time: "2026-01-02T00:00:00Z", result: { error: "boom" }, step_entries: [{ stepId: "s1", status: "FAILED" }] },
    "wf-3",
  );
  expect(withResult.id).toBe("ex-2");
  expect(withResult.status).toBe("failed");
  expect(withResult.endTime).toBe("2026-01-02T00:00:00Z");
  expect(withResult.result).toEqual({ error: "boom" });

  // No result -> step_entries + duration folded into result.
  const folded = normalizeExecution({ id: "ex-4", state: "SUCCEEDED", duration: 7, step_entries: [{ stepId: "s1" }] }, "wf");
  expect(folded.result).toEqual({ duration: 7, step_entries: [{ stepId: "s1" }] });
});

test("normalizeExecution tolerates empty/null raw", () => {
  expect(normalizeExecution(null, "wf")).toEqual({ id: "", workflowId: "wf", status: "stopped" });
});

test("parseExecutionsResponse reads {executions, next_page_token}", () => {
  expect(parseExecutionsResponse({ executions: [{ id: 1 }, { id: 2 }], next_page_token: "tok" })).toEqual({ executions: [{ id: 1 }, { id: 2 }], nextPageToken: "tok" });
});

test("parseExecutionsResponse falls back to items/data arrays and bare arrays", () => {
  expect(parseExecutionsResponse({ items: [{ id: 1 }] })).toEqual({ executions: [{ id: 1 }], nextPageToken: null });
  expect(parseExecutionsResponse({ data: [{ id: 1 }] })).toEqual({ executions: [{ id: 1 }], nextPageToken: null });
  expect(parseExecutionsResponse([{ id: 1 }])).toEqual({ executions: [{ id: 1 }], nextPageToken: null });
  expect(parseExecutionsResponse({})).toEqual({ executions: [], nextPageToken: null });
  expect(parseExecutionsResponse(null)).toEqual({ executions: [], nextPageToken: null });
});

test("parseExecutionsResponse ignores empty/whitespace token", () => {
  expect(parseExecutionsResponse({ executions: [], next_page_token: "" }).nextPageToken).toBeNull();
});

test("buildExecutionsQuery always sets limit and forwards page_token + non-ALL status", () => {
  const qs = buildExecutionsQuery({ limit: 20, pageToken: "tok", status: "FAILED" });
  expect(qs).toBe("limit=20&page_token=tok&status=FAILED");
});

test("buildExecutionsQuery omits page_token when absent and drops ALL status", () => {
  expect(buildExecutionsQuery({ limit: 10, status: "ALL" })).toBe("limit=10");
  expect(buildExecutionsQuery({ limit: 10, pageToken: "", status: "ACTIVE" })).toBe("limit=10&status=ACTIVE");
});

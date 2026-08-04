/** Copyright 2026 Google LLC — Apache-2.0 */
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "bun:test";

import type { ApiClient } from "@/src/lib/api/client";
import { WorkspaceProvider, useWorkspace } from "@/src/lib/workspace/context";
import type { Workspace } from "@/src/lib/workspace/api";

// Server render must not touch localStorage. useSyncExternalStore's
// getServerSnapshot covers SSR *and* hydration, so this markup is exactly what
// the client produces on its first pass — no hydration mismatch, no effect.
const WORKSPACES: Workspace[] = [
  { id: "w1", name: "Private", scope: "private", ownerId: null },
  { id: "w2", name: "Public", scope: "public", ownerId: null },
];

function Probe() {
  const { activeWorkspace, activeSource } = useWorkspace();
  return <span data-source={activeSource}>{activeWorkspace?.id ?? "none"}</span>;
}

function render(children: React.ReactNode, initialUrlWorkspaceId: string | null = null) {
  return renderToStaticMarkup(
    <WorkspaceProvider
      api={{} as ApiClient}
      initialWorkspaces={WORKSPACES}
      initialUrlWorkspaceId={initialUrlWorkspaceId}
    >
      {children}
    </WorkspaceProvider>,
  );
}

test("server render picks the first public workspace with no localStorage available", () => {
  const html = render(<Probe />);
  expect(html).toContain("w2");
  expect(html).toContain('data-source="default"');
});

test("server render honours the URL workspace id over the default", () => {
  const html = render(<Probe />, "w1");
  expect(html).toContain("w1");
  expect(html).toContain('data-source="url"');
});

/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";
import { Button } from "@/src/components/ui";

export function SelectionBar({ selection, onAction, canRestore = false }: { selection: string[]; onAction: (action: string) => void; canRestore?: boolean }) {
  if (!selection.length) return null;
  return <section aria-label="Selected gallery media actions" className="sticky bottom-[var(--tri-space-4)] z-10 flex flex-wrap items-center gap-[var(--tri-space-2)] rounded-[var(--tri-button-radius)] bg-[var(--tri-bg-surface)] p-[var(--tri-space-2)] shadow-[var(--tri-dialog-shadow)]"><span className="mr-[var(--tri-space-2)] font-[var(--tri-font-weight-semibold)]">{selection.length} selected</span><Button variant="danger" onClick={() => onAction("delete")}>Delete</Button><Button variant="secondary" onClick={() => onAction("download")}>Download ZIP</Button><Button variant="secondary" onClick={() => onAction("copy")}>Copy to workspace</Button><Button variant="secondary" onClick={() => onAction("tag")}>Tag</Button>{canRestore && <Button variant="secondary" onClick={() => onAction("restore")}>Restore</Button>}<Button variant="ghost" onClick={() => onAction("clear")}>Clear</Button></section>;
}

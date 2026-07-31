/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { Button, Dialog, Toast, Tooltip } from "@/src/components/ui";

export function InteractiveFeedbackSpecimens() {
  return (
    <div className="mt-4 flex gap-3">
      <Tooltip content="Static tooltip specimen">
        <Button variant="secondary">Hover or focus</Button>
      </Tooltip>
      <Toast
        id="fixture-toast"
        message="Media exported successfully."
        onDismiss={() => undefined}
        tone="success"
      />
    </div>
  );
}

export function DialogSpecimen() {
  return (
    <Dialog onClose={() => undefined} open title="Dialog specimen">
      <p className="mt-[var(--tri-space-3)] text-[var(--tri-text-secondary)]">
        Keyboard support: Escape closes interactive dialogs.
      </p>
      <div className="mt-[var(--tri-space-5)] flex gap-[var(--tri-space-3)]">
        <Button>Confirm</Button>
        <Button variant="secondary">Cancel</Button>
      </div>
    </Dialog>
  );
}

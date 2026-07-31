# Workflow canvas v3 — compact single-port nodes

Date: 2026-07-30
Status: IMPLEMENTATION STARTED

User-directed UX:
- Compact horizontal nodes matching reference: icon, title, subtitle/model only.
- Remove order number, field rows, inline validation.
- Exactly one boundary input handle (`in`) on left and one output handle (`out`) on right where applicable.
- Multiple incoming edges share the same left port.
- Canonical backend source output/target field retained as edge metadata, not RF handle IDs.
- Typed unique targets auto-resolve; ambiguous image targets are selected explicitly in the floating inspector.
- Model/aspect/resolution properties become backend-driven dropdowns where option APIs exist.
- Brand Guidelines becomes a separate canvas-only workspace-default node; its edges compile to target `brand_guidelines: true` for image/edit/video. Specific guideline IDs are not currently supported by backend.
- All properties/validation stay in floating inspector.

Constraints:
- Config refs/boolean settings remain canonical.
- No virtual/canvas metadata in backend DTO.
- No implicit dependency without explicit edge.
- Form editor remains removed.
- Full-screen floating overlay architecture preserved.
- No commits.
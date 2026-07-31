# Workflow canvas v2 — independent input nodes

Date: 2026-07-30
Status: IMPLEMENTED, REVIEWED, AND VALIDATED — NO RELEASE BLOCKERS

Decisions:
- Use canvas-only `canvasKind`/variant metadata; do not widen backend/UI StepType.
- Virtual input node ID: `<singletonStepId>__ui__<normalizedOutput>`.
- Hide execution-order badge on virtual inputs.
- Always retain exactly one hidden backend user_input step at index 0; zero outputs allowed.
- Layout storage version bumps to v2; one-time local layout reset accepted.
- Ingredients to Image maps to existing generate_image and is inferred from non-empty input_images on reload; empty Ingredients node is save-blocking until connected.
- Remove Form editor route fallback/button/components after canvas migration is complete.

Desired UX:
- Visible Text Input and Image Input are separate nodes; multiple of each allowed.
- Remove singleton multi-parameter User Input node from canvas UX.
- Remove Form editor button and `?view=form` dependency.
- Nodes are independent unless an explicit edge connects them.
- All node properties/configuration live in a floating inspector sidebar.
- Add distinct Ingredients to Image visual node.
- Example graph interpretation:
  - Text Input B -> Generate Text.
  - Generate Text output -> Ingredients to Image prompt.
  - Image Input A -> Ingredients to Image ingredient input.
  - Ingredients/generated image -> Generate Video image/reference input.
  - Image Input C -> the same Generate Video image/reference list.
- Canvas itself spans the full viewport underneath floating toolbar/palette/inspector and existing studio chrome; panels must not consume canvas layout width.

Backend compatibility strategy to validate:
- Keep exactly one serialized backend `user_input` step.
- Expand each user-input output into one virtual canvas node with stable derived ID.
- Compile virtual-node edges back to `{step: singletonUserInputStepId, output: parameterName}`.
- Re-expand on load; no backend canvas metadata in P1.
- Distinct Ingredients to Image may map to existing `generate_image`, inferred on reload from non-empty `input_images`.

Constraints:
- No implicit dependencies.
- Config refs remain source of truth.
- Ordinary save never silently reorders.
- Preserve identifier-safe parameter/step IDs and model capability limits.
- No commits.
- Workflows navigation removed from the grouped Tools flyout and promoted to its own role-gated top-level item in the floating studio sidebar.

## Implemented result
- Text Input and Image Input are independent repeatable virtual canvas nodes, each with one output handle and its own inspector properties.
- Exactly one hidden backend user_input step is normalized to index 0; virtual edges compile to singleton `{step, output}` refs and re-expand on load.
- Multiple legacy user_input steps merge atomically with ref rewrites.
- Ingredients to Image is a distinct canvas variant mapped to backend generate_image; empty ingredients save-blocks, connected workflows infer the variant on reload.
- Generate Video accepts ordered multi-image fan-in from generated images and independent Image Input nodes.
- Form editor component/button/query fallback removed; routes are canvas-only.
- ReactFlow is absolute inset-0 full viewport. Toolbar, palette, inspector, mobile controls float as overlays and do not reserve canvas dimensions.
- Studio Sidebar/WorkspaceSwitcher remain above the canvas. Palette/toolbar are positioned to avoid unusable overlap.
- Mobile drawers portal above studio chrome, inert background, trap/restore focus.
- Connection handles have 28px hit boxes with compact 11px dots; directional edges remain visible and focusable.
- Layout storage v2 includes virtual output IDs; v1 local layouts reset once.
- Validation/save accepts human display names and normalizes output identifiers at save.
- Legacy Form presentation components deleted; core workflow hooks/types/mappers retained.

## Validation
- Frontend unit suite: 621 passed, 0 failed.
- ESLint clean.
- Next 16 production build passed; 59/59 pages generated.
- Workflow/canvas source diagnostics: no errors.
- Independent compiler and mobile/a11y re-reviews: SHIP, no blocker/high findings.
- Playwright v2 graph scenario added; unauthenticated test passed, authenticated graph test remains gated on real workflow-role storage state.
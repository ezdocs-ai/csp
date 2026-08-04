# Creative Studio (Next.js vs Angular) UI/UX Improvement Audit & Parity Roadmap

## Overview
Comparative analysis between Next.js (`http://localhost:3000`) and reference Angular (`http://localhost:4200`) implementations. This memory documents exact gaps, layout defects, missing primitives, state discrepancies, technical bugs, and actionable recommendations to achieve full design parity and superior UX in Next.js.

---

## 1. Navigation Shell & Topbar Layer (`/components/navigation/*`)

### Current Gaps in Next.js
- **Workspace Switcher**: Reduced to a plain native `<select>` dropdown (`workspace-switcher.tsx`). Missing:
  - Scope icons (`public` vs `private`).
  - Active workspace badge & status indicators.
  - Shell actions: `Create New Private Workspace` modal trigger, `Invite Users` modal trigger (role-gated), `Brand Guidelines` dialog trigger (with inline spinner for background processing), and `Feedback` link.
- **Sidebar Ergonomics**:
  - Tools submenu uses hand-rolled hover delay logic with visible glitches.
  - Tooltips rely on inline CSS positioning instead of accessible tooltip primitives (`aria-describedby`, keyboard focus).
  - Unlabeled theme toggle icon button (missing `aria-label`).
  - Missing desktop hover-pin state persistence and user avatar dropdown menu.
- **Top Bar, Progress & Footer**:
  - Missing global top indeterminate loading progress bar during route transitions/API requests.
  - Missing legal/branding footer ("Powered by Vertex AI", Privacy Policy, Terms of Service).

### Actionable Improvements
1. **Rebuild `WorkspaceSwitcher`**: Upgrade to a floating glass trigger with a rich menu containing scope icons, section dividers, and modal triggers for Workspace Creation, User Invites, Brand Guidelines, and Feedback.
2. **Enhance `Sidebar`**: Implement accessible Tooltip primitives, add `aria-label` to theme toggle, improve submenu hover stability, and persist pin state.
3. **Add `TopProgressBar` & `Footer`**: Add top loading bar tied to Next.js route transitions and mount fixed legal footer.

---

## 2. Studio Pages (Image, Video, Audio, VTO, Upscale)

### Image Studio (`/` & `/imagen-upscale`)
- **Current Defect**: Results render in a side-by-side card (`ResultPanel`) using emoji icons (🔄, ✏️, 🎬, 👕, 🗑️) instead of standard icon buttons. Cross-studio remix callbacks (`onSendToVideo`, `onSendToVto`) are un-wired. Options bar lacks Google Search, Brand Guidelines, and Enhance Prompt toggles. Negative prompt is plain text instead of interactive chip grid. Missing Ingredients mode and reference image slots.
- **Improvement**: Standardize output onto `MediaLightbox` primitive with photo-zoom, tag assignment, share menu, and wired cross-studio navigation buttons. Upgrade option bar with popover chips and interactive negative prompt chips.

### Video Studio (`/video`)
- **Current Defect**: Uses flattened two-column grid (`lg:grid-cols-[1fr_1fr]`) with permanent native `<select>` dropdowns for Model, Mode, Resolution, Aspect, Duration, Count. Reference media uses separate modal instead of inline slots. Missing Concatenate Video, Extend Video, and Ingredients modes.
- **Improvement**: Adopt `flow-prompt-box` primitive with contextual popover chips, inline reference slots, background hero video preview, and `MediaLightbox` output.

### Audio Studio (`/audio`)
- **Current Defect**: Renders native browser `<audio controls>`, lacking custom styled player controls, seek bar, timecode, and visual waveform/pulse indicators.
- **Improvement**: Build custom Audio Player primitive with circular play/pause, timestamp display, seek slider, and pulsing waveform graphics.

### Virtual Try-On (`/vto`) & Imagen Upscale (`/imagen-upscale`)
- **Current Defect**: VTO step-2 processing state and gender radio sync with preset models differ from Angular's inline state transition flow. Upscale lacks side-by-side split image comparison slider (`clipInset` comparison view).
- **Improvement**: Restore split-view comparison slider in Upscale lightbox and align VTO inline step-2 processing overlays.

---

## 3. Gallery, Workbench & Content Surfaces

### Gallery (`/gallery`, `/gallery/[id]`)
- **Current Defect**: Uses flat 12-column grid with fixed positional spans ignoring asset aspect ratios. Missing date-grouped headers (Today, Yesterday, Mon D - D, Month YYYY). Uses numbered pagination instead of infinite scroll. Selection model is un-wired. Media cards lack hover-to-play video previews, selection glass circle, tag chip overlays, and item type badges.
- **Improvement**: Implement aspect-ratio-driven dense masonry grid (`grid-flow-dense`), date section headers, "Load more" / infinite scroll observer, Shift/Cmd multi-selection bar, and rich media cards with hover video preview and tag chips.

### Workbench (`/workbench`)
- **Current Defect**: Renders basic timeline, preview canvas, and transport controls, but completely omits the left Assets panel (Gallery/Audio tabs, cloud asset picker) and right Properties panel (Exposure, Contrast, Highlights, Shadows, Temp, Tint, Saturation sliders via `studio-slider`).
- **Improvement**: Re-introduce left Assets panel and right Properties/Edit adjustments panel to reach feature parity with Angular.

---

## 4. Workflows & Admin Layer

### Workflows (`/workflows`, `/workflows/new`, `/workflows/[id]`)
- **Current Defect**: The `/workflows` page lacks a "New Workflow" CTA button, breaking the creation flow unless navigating directly via URL. Uses plain browser `confirm()` modal for deletion. Missing inline Outputs panel in editor, missing input parameter schema builder, and missing drag handles.
- **Improvement**: Add role-gated "New Workflow" CTA button to `/workflows` header. Restore inline step execution Outputs panel, input parameter schema builder, confirmation dialog primitive, and `cdkDropList`-equivalent drag-and-drop handles.

### Admin Panel (`/admin/**`)
- **Current Defect**:
  - **CSRF Bug**: `use-admin-users.ts` looks for `csrf-token=` in `document.cookie` while `session.ts` sets `csp_csrf`, causing CSRF validation errors on admin mutations (POST/PATCH/DELETE).
  - **Dashboard**: Missing "Media per Workspace" chart, "Monthly Active Users" chart, superAdmin role restriction view, and date range selector.
  - **Users**: Table lacks user avatar column, email filter, `include-deleted` toggle, paginator, and multi-role selection dropdown (uses single-role select).
  - **Media Gallery & Templates**: Single search box instead of 7-column filter grid; templates lack thumbnail preview, mimeType tags, and pagination.
  - **Tags & AI Registry**: Tags lack color pickers and inline editing rows. Providers/Models use text "Yes/No" labels and modal editing instead of inline `<mat-slide-toggle>` switches.
- **Improvement**: Fix CSRF cookie key name mismatch (`csp_csrf`), enable multi-role selection in User Edit dialog, add multi-column filter grids to Media Gallery & Template tables, add inline toggle switches for AI Providers/Models, and add dashboard analytics charts.

---

## Priority Parity Implementation Order
1. **P0 (Critical)**: Rebuild `WorkspaceSwitcher` shell actions & modals; Standardize Studio outputs on `MediaLightbox`; Fix CSRF cookie mismatch in Admin; Add "New Workflow" CTA button to `/workflows`.
2. **P1 (High)**: Implement `flow-prompt-box` primitive for Image & Video studios; Dense masonry layout & date grouping in Gallery; Re-introduce Assets & Properties panels in Workbench; Add multi-role select and filter grids in Admin.
3. **P2 (Medium)**: Custom Audio Player primitive; Top route loading progress bar; Fixed legal footer; Responsive mobile bottom bar.

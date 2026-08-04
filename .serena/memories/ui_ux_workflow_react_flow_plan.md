# React Flow Workflows UI/UX Enhancement Plan

## Overview
Comprehensive plan for transforming the Workflows menu (`/workflows`) and the React Flow editor (`/workflows/new`, `/workflows/[id]/edit`) in Next.js into a world-class, visual node-based workflow builder.

---

## 1. Workflow Management & List Page (`/workflows`)

### UI/UX Improvements
1. **Primary Action & Header**:
   - Add a prominent, role-gated `+ New Workflow` primary button in the page header.
   - Display total workflow count and active workspace filter pill.
2. **Search & Filtering**:
   - Add a search input with clear icon button (`×`), debounced filtering, and category tag filters.
3. **Card & Card Grid**:
   - Upgrade workflow list cards to a 2-column or 3-column bento grid.
   - Each card features:
     - Workflow Name & Description.
     - Node count badge (e.g., `4 Nodes`).
     - Status indicator (`Draft`, `Ready`, `Executing`).
     - Last modified relative timestamp (`formatTimeAgo`) with `suppressHydrationWarning`.
     - Action menu dropdown (`...` icon): `Open Canvas`, `Run`, `Duplicate`, `Export JSON`, `Delete`.
4. **Modals & Dialogs**:
   - Accessible `ConfirmDialog` for deletion.
   - `DuplicateWorkflowModal` for instant cloning.

---

## 2. React Flow Canvas & Editor (`/workflows/new`, `/workflows/[id]/edit`)

### Top Floating Toolbar (`CanvasToolbar`)
1. **Header & Status**:
   - Editable workflow title and description with inline edit triggers.
   - Live validation status pill (e.g., `✓ Valid` or `! 2 Errors` clicking opens Inspector error list).
2. **Toolbar Actions**:
   - **Auto-Layout Button**: Single click auto-arranges nodes using a clean horizontal graph layout (Dagre algorithm).
   - **Undo / Redo Buttons**: Stack with `Cmd+Z` / `Cmd+Shift+Z` support.
   - **Save & Run CTAs**: Primary `Save` and `Run Workflow` buttons with loading states.

### Floating Canvas Controls & Utilities
1. **Zoom & Navigation Bar**:
   - Floating bottom-left toolbar containing: `Zoom In (+)`, `Zoom Out (-)`, `Fit View (⛶)`, `Toggle Grid`, `Toggle MiniMap`.
2. **Quick-Add Command Palette (`Cmd+K` / Canvas Right-Click)**:
   - Floating search popover on canvas right-click or `Cmd+K` to search step types and insert directly under cursor.

### Step Palette Rail (`StepPaletteRail`)
1. **Categorized Step Cards**:
   - Group palette items into distinct visual sections:
     - 📥 **Inputs**: Text Input, Image Input, User Parameters.
     - ✍️ **Generative Text**: Generate Text (Gemini).
     - 🎨 **Image & Edit**: Generate Image, Edit Image, Imagen Upscale.
     - 🎬 **Video & Motion**: Generate Video (Veo), Extend Video.
     - 👕 **VTO & Audio**: Virtual Try-On, Generate Audio.
2. **Interaction Modes**:
   - Drag-and-drop onto canvas with live ghost preview.
   - Single click or double click to auto-spawn node at canvas center.

### Visual Canvas Nodes (`BaseWorkflowNode`)
1. **Color-Coded Handles & Port Types**:
   - Data-type colored port handles (`Text` = Cyan/Blue, `Image` = Violet/Purple, `Video` = Amber/Gold, `Audio` = Emerald/Green).
   - Multi-connection handles (`ref-list`) feature distinct triple-ring indicators.
   - Required handle ports feature a subtle accent ring.
2. **Node Body & Header Aesthetics**:
   - Smooth glassmorphism container with semantic accent dots.
   - Step execution order badge (`#1`, `#2`, `#3`) top-right.
   - Mini preview thumbnail or text excerpt inside configured nodes.
3. **Handle Hover & Connection Guide**:
   - Pulsing glow on compatible target handles when dragging a connection wire.

### Node Inspector & Properties (`NodeInspector`)
1. **Tabbed Inspector**:
   - **Config Tab**: Step parameters (Model, Prompt, Temperature, Aspect Ratio, Resolution) with sliders and rich selects.
   - **Connections Tab**: Connected input chips with explicit `Disconnect (×)` controls.
   - **Outputs & Validation Tab**: Output schema preview and step validation messages.
2. **Prompt Builder & Token Insertion**:
   - Interactive reference pill buttons inside prompt textareas to insert variables like `{{text_input.value}}`.

### Execution & Outputs Drawer (`/workflows/[id]/run`)
1. **Real-Time Execution Drawer**:
   - Bottom/side drawer showing step-by-step execution timeline with status spinners (`Pending`, `Running`, `Completed`, `Failed`).
   - Inline media result cards (Images, Videos, Audio) with one-click download and lightbox inspect.

---

## Priority Implementation Roadmap
- **Phase 1 (Core Navigation & Canvas Usability)**: Add `+ New Workflow` CTA to `/workflows`; Implement `Auto-Layout` and Zoom/Fit-View controls on canvas; Add color-coded port handles.
- **Phase 2 (Palette & Node Editing)**: Implement `Cmd+K` Quick-Add popover; Add tabbed Node Inspector; Enhance prompt variable reference insertion.
- **Phase 3 (Execution & Management)**: Add `Run Workflow` inline drawer; Add workflow duplication and JSON export.

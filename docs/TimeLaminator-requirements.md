# TimeLaminator — Requirements & Design Specification

> **Document purpose**: This document defines the functional requirements and UI/design system specification for a web application that converts binarized video footage into a 3D solid (STL) by projecting the time axis onto the Z axis. It is intended for human review and as a machine-readable specification for AI coding agents. Section anchors and tables are structured for direct reference during implementation.

---

## 1. Project concept

### 1.1 Core transformation

The application performs a **spatialization of the temporal axis**. A binarized video (or image sequence) is treated as a time-series of 2D binary functions, and is transformed into a single 3D voxel volume by mapping time directly to the Z axis.

```
Input:  f(x, y, t) ∈ {0, 1}   — binary frame sequence
Output: V(x, y, z) ∈ {0, 1}   — voxel grid, where z = t
Rule:   white pixels (value 1) become "material present" voxels
```

### 1.2 Primary deliverable

The application outputs **3D-printable STL data**. This constraint shapes priority decisions throughout this document: any feature that does not serve the goal of producing a clean, manufacturable mesh is explicitly deprioritized or excluded.

### 1.3 Out of scope (explicitly deprioritized for this phase)

The following were considered during requirements discussion and explicitly excluded or deprioritized. AI agents implementing this spec should NOT build these unless instructed otherwise in a future revision:

| Feature | Reason for exclusion |
|---|---|
| Grayscale / mid-tone mapping to Z displacement or voxel density | Input is assumed pre-binarized; mid-tone projection is conceptually incompatible with the binary STL output goal |
| Multi-channel boolean overlay (union / difference / intersection of multiple video sources) | Low priority for current implementation phase |
| Reverse playback / "rescan" animation preview | Low priority for current implementation phase |
| Non-linear (eased / logarithmic / periodic) Z-axis time mapping | Low priority for current implementation phase |
| Tailwind CSS | Explicitly excluded — see Section 5 |

---

## 2. Functional requirements

### 2.1 Input module

| Requirement | Detail |
|---|---|
| Video file input | `.mp4`, `.mov` via WebCodecs API, with `ffmpeg.wasm` fallback for unsupported codecs |
| Image sequence input | PNG sequence, including ZIP archive upload |
| Binarization fallback | Threshold (0–255) control for grayscale / mid-tone source material that has not been pre-binarized |

### 2.2 Parameter module

| Parameter | Detail | Status |
|---|---|---|
| Layer pitch (Z scale) | Z-axis distance per frame, in mm | **User-specified requirement** |
| Stack direction invert | Toggle time-forward / time-reverse stacking | **User-specified requirement** |
| Frame range | In/out point trimming | Required |
| Frame step (decimation in time) | Sample every Nth frame. Conceptually distinct from layer pitch: pitch redefines the *unit* of Z, frame step changes the *sampling frequency* and introduces aliasing artifacts of a different character. Present as a separate control. | Required |
| Noise removal | Morphological erosion / dilation per frame | Required |
| Speckle removal | Connected-component analysis to discard isolated voxel clusters below a size threshold | Required |

### 2.3 Optimization module

This module exists specifically to address the **polygon count / file size problem** identified during prototyping with a prior Python script. Marching Cubes resolution is directly coupled to mesh complexity, and binary video sources produce pronounced staircase artifacts that generate large numbers of geometrically meaningless polygons.

| Feature | Detail | Priority |
|---|---|---|
| Adaptive voxel resolution | XY resolution and Z pitch are suggested by reverse-calculating from a user-specified target physical size and target printer resolution (e.g. FDM 0.2–0.4 mm, resin ~0.05 mm). Resolution beyond what the printer can physically reproduce is pure waste. | High |
| Mesh decimation | Quadric edge-collapse decimation (Garland & Heckbert, 1997) via `meshoptimizer` (WASM `simplify`), targeting either a polygon count or an error tolerance | High |
| Vertex welding | Merge coincident/near-coincident vertices generated at voxel-cell boundaries by Marching Cubes, run automatically as a post-process before decimation | Medium (automatic, no UI control needed) |
| Pre-blur | Gaussian blur applied to each frame before re-thresholding, to soften staircase edges prior to mesh generation. Improves decimation results. | Medium |
| Surface Nets algorithm option | Alternative to Marching Cubes; produces sparser topology (~1/3–1/2 the polygon count) and fewer staircase artifacts due to single shared vertex per voxel cell | Low (future extension) |

#### Recommended processing pipeline

```
1. Input frames (binary or thresholded)
        ↓
2. Frame range + frame step applied
        ↓
3. Pre-blur → re-threshold (edge smoothing)
        ↓
4. Noise removal (erosion / dilation, speckle removal)
        ↓
5. Adaptive voxel resolution (reverse-calculated from target physical size)
        ↓
6. Voxelization + Z-axis stacking (layer pitch, direction invert applied)
        ↓
7. Mesh generation: Marching Cubes (default) / Surface Nets (future)
        ↓
8. Vertex welding (automatic)
        ↓
9. Quadric decimation (to target polygon count)
        ↓
10. Preview (three.js viewport, cross-section, statistics)
        ↓
11. Export: STL (primary) / OBJ / glTF / STEP (low priority)
```

### 2.4 Mesh generation module

- **Marching Cubes** (default algorithm)
- **Surface Nets** (future extension — selectable alongside Marching Cubes once implemented)

### 2.5 Preview module

| Feature | Detail |
|---|---|
| 3D viewport | three.js + OrbitControls |
| Render mode toggle | Shaded / Wireframe / Normals |
| Cross-section view | Z-axis clipping plane — lets the user inspect the cross-sectional shape at any point along the time axis. This is a core experiential feature of the tool. |
| Mesh statistics | Vertex count, face count, estimated file size, estimated print time — displayed persistently, not just on export |
| Real-time optimization feedback | Statistics update live as decimation / resolution parameters change |

### 2.6 Export module

| Format | Detail | Priority |
|---|---|---|
| STL | Binary or ASCII, selectable | High (primary output) |
| OBJ / glTF | For preview sharing and DCC tool handoff | Medium |
| STEP | Mesh → BREP conversion via `occt-import-js` (OpenCascade WASM) | **Low** |

#### STEP export — implementation notes (low priority)

If implemented, the following constraints apply:

- Present as a separate "Advanced Export" section in the UI, decoupled from the main STL-focused workflow.
- A decimated mesh converted to BREP becomes a "collection of flat patches," not a smooth parametric surface. The UI must communicate this — do not imply STEP output will be a smooth NURBS surface.
- Load `occt-import-js` via dynamic import so users who never touch STEP export are not penalized with a larger initial bundle.

### 2.7 Project management module

| Feature | Detail |
|---|---|
| Save / load project | Serialize input file reference, all parameters, and viewport state to JSON |
| Trial-and-error record | Parameter change history (future extension, not required for initial implementation) |

---

## 3. Technology stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Vue 3 (Composition API) | |
| Styling | Scoped CSS / CSS Modules + CSS custom properties (design tokens). **Tailwind CSS is explicitly excluded.** | See Section 5 |
| State management | Pinia | Chosen partly for clean serialization compatibility with the project save/load feature |
| Video decoding | WebCodecs API, `ffmpeg.wasm` fallback | |
| Mesh generation | Marching Cubes implementation; `isosurface` (npm) as a candidate for future Surface Nets support | |
| Mesh optimization | `meshoptimizer` (WASM) | |
| 3D viewport | three.js + OrbitControls (TresJS as a Vue-idiomatic alternative) | |
| STEP conversion | `occt-import-js` (OpenCascade WASM), dynamic import | Low priority |

---

## 4. Development phasing

| Phase | Content | Parallelizable? |
|---|---|---|
| 1 | Input module (video decode) + preview foundation (three.js render) | Two independent tracks, can start in parallel |
| 2 | Parameter UI + voxelization processing | After Phase 1 |
| 3 | Marching Cubes implementation + optimization module (decimation, vertex welding) | Mesh generation and optimization can be developed independently |
| 4 | STL export + project management (save/load) | After Phase 3, internally parallelizable |
| 5 | OBJ/glTF export, pre-blur, adaptive resolution suggestion | Parallelizable |
| 6 (low priority) | STEP export (`occt-import-js` integration) | Fully independent, can be deferred indefinitely |

**Time-intensive items requiring particular attention**: Phase 3 (Marching Cubes correctness + decimation performance tuning) and Phase 6 (`occt-import-js` WASM binding and data structure verification).

---

## 5. UI / Design system specification

### 5.1 Design language reference

The visual design follows **Apple Human Interface Guidelines (HIG)** conventions: clarity, deference to content, depth through subtle layering rather than decoration. Flat surfaces, minimal borders, generous whitespace, no gradients or drop shadows except functional focus rings.

**Tailwind CSS must not be used.** Styling is implemented via Scoped CSS / CSS Modules with a CSS custom-property–based design token system. This is a hard constraint — do not introduce a utility-class framework as a substitute.

### 5.2 Typography

- **Primary typeface: IBM Plex Sans**, loaded via `@font-face` or a `<link>` to Google Fonts (`fonts.googleapis.com`). This must be explicitly declared in the application's font stack — it is not a system default and will not load automatically.
- Two weights only for UI text: **400 (regular)** and **500 (medium)**. Avoid 600/700 — they read as visually heavy against a HIG-style flat interface.
- Sentence case throughout. No Title Case, no ALL CAPS, except for small uppercase section labels (see token table) where letter-spacing compensates for legibility.

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500&display=swap');

:root {
  --font-sans: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
}
```

### 5.3 Design tokens (CSS custom properties)

```css
:root {
  /* Color — light mode */
  --color-background-primary: #ffffff;
  --color-background-secondary: #f5f5f4;
  --color-background-tertiary: #ececea;
  --color-background-info: #e6f1fb;

  --color-text-primary: #1c1c1a;
  --color-text-secondary: #6b6b68;
  --color-text-tertiary: #9c9c98;
  --color-text-info: #0c447c;

  --color-border-tertiary: rgba(0, 0, 0, 0.08);
  --color-border-secondary: rgba(0, 0, 0, 0.16);
  --color-border-primary: rgba(0, 0, 0, 0.24);

  /* Radius */
  --border-radius-md: 8px;
  --border-radius-lg: 12px;
  --border-radius-xl: 16px;

  /* Spacing scale */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;

  /* Typography */
  --font-size-label: 11px;
  --font-size-caption: 12px;
  --font-size-body: 13px;
  --font-size-section: 15px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-background-primary: #1c1c1a;
    --color-background-secondary: #262624;
    --color-background-tertiary: #2f2f2d;
    --color-background-info: #0c447c;

    --color-text-primary: #f5f5f4;
    --color-text-secondary: #b4b2a9;
    --color-text-tertiary: #888780;
    --color-text-info: #b5d4f4;

    --color-border-tertiary: rgba(255, 255, 255, 0.08);
    --color-border-secondary: rgba(255, 255, 255, 0.16);
    --color-border-primary: rgba(255, 255, 255, 0.24);
  }
}
```

### 5.4 Layout structure

A three-column layout, designed for a desktop-first viewport (≥ 1280px). Below this breakpoint, the side panels should collapse into off-canvas drawers.

```
┌─────────────────────────────────────────────────────────────────┐
│  Toolbar: project name · Open / Save / Export                    │
├───────────────┬─────────────────────────────────┬────────────────┤
│                │                                  │                │
│  LEFT PANEL    │       CENTER: PREVIEW            │  RIGHT PANEL   │
│  (220px)       │       (flexible width)           │  (240px)       │
│                │                                  │                │
│  Project-level │  - Render mode toggle            │  Per-pass      │
│  settings:     │    (Shaded / Wireframe /          │  property      │
│  - Source file │     Normals)                      │  controls:     │
│  - Frame range │  - Cross-section clip plane      │  - Layer pitch │
│  - Threshold   │  - 3D viewport (three.js)         │  - Direction   │
│  - Target size │  - Mesh statistics bar            │    invert      │
│  - Project     │    (faces / vertices / size /     │  - Frame step  │
│    save/load   │     est. print time)              │  - Pre-blur    │
│                │                                  │  - Speckle     │
│                │                                  │    removal     │
│                │                                  │  - Decimation  │
│                │                                  │  - Algorithm   │
└───────────────┴─────────────────────────────────┴────────────────┘
```

#### Column rationale

- **Left panel — project-level settings**: parameters that act on the whole project and are changed infrequently (source file, time range, threshold fallback, target physical size for adaptive resolution, save/load).
- **Center — preview**: the 3D viewport is the primary focus. Statistics are shown persistently at the bottom so that adjustments made in the right panel have immediately visible consequences, both visually and numerically.
- **Right panel — per-property controls**: parameters mapped to the processing pipeline order (top to bottom): stacking → sampling → cleanup → mesh optimization. This ordering mirrors the pipeline defined in Section 2.3 and should be preserved if the panel is reorganized.

### 5.5 Component tokens

| Component | Spec |
|---|---|
| Borders | `0.5px solid var(--color-border-tertiary)` default; `var(--color-border-secondary)` on hover/emphasis |
| Card corner radius | `var(--border-radius-lg)` |
| Control corner radius | `var(--border-radius-md)` |
| Panel padding | `1rem` |
| Section label | 12px, weight 500, `var(--color-text-secondary)`, uppercase, `letter-spacing: 0.04em` |
| Buttons | Transparent background, `0.5px solid var(--color-border-secondary)`, hover → `var(--color-background-secondary)`, active → `scale(0.98)` |
| Primary action button (Export) | `background: var(--color-background-info)`, `color: var(--color-text-info)`, no border |
| Range sliders | 4px track, 18px thumb, value readout shown inline at the right of the label |
| Inputs / selects | 36px height (desktop), built-in hover/focus state using a focus ring (`box-shadow: 0 0 0 2px ...`) — no drop shadows elsewhere |
| Shadows | None, except focus rings |
| Gradients | None |

### 5.6 Reference mockup

A wireframe mockup implementing this layout and token system was produced during the design discussion (three-column layout: 220px project settings / flexible preview / 240px property controls, IBM Plex Sans typography, flat HIG-influenced surfaces, no Tailwind). Refer to that mockup as the visual baseline when implementing components.

### 5.7 Open design questions

- **Timeline scrubber**: whether a frame-scrubbing timeline should be a persistent element beneath the center preview, or integrated into the left panel's frame-range control. Decision should be driven by expected workflow frequency of source material switching vs. range adjustment.
- **Color semantics**: the current palette is intentionally neutral/grayscale, echoing the binary (black/white) nature of the source material. Introducing color (e.g. to distinguish pre/post-optimization mesh states, or to differentiate Marching Cubes vs. Surface Nets output) is a deferred decision.

---

## 6. Notes for implementing agents

- This document supersedes informal discussion; where this document and prior conversation conflict, this document is authoritative.
- Section 2.3 (Optimization module) exists to solve a problem encountered in a prior prototype (excessive polygon count / file size from a naive Marching Cubes pipeline). Do not treat it as optional polish — it is a primary design driver.
- Do not implement any item listed in Section 1.3 (Out of scope) without an explicit instruction in a future revision of this document.
- STEP export (Sections 2.6, 2.3) is intentionally low priority. Do not block other export functionality on STEP support, and do not let `occt-import-js` become a hard dependency of the main bundle.
- The Tailwind CSS exclusion (Section 5.1) is a hard constraint, not a stylistic suggestion.

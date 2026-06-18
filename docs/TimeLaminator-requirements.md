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

---

## 7. PWA化計画 (PWA implementation plan)

This section defines the plan for adding Progressive Web App (PWA) capability to TimeLaminator. The primary goals are **offline usability after first load** and **installability** (home-screen / standalone app), not merely faster repeat-visit caching. Implementation uses `vite-plugin-pwa` (Workbox-based); a hand-rolled service worker is explicitly excluded as an approach.

This is additive to Section 4's phasing — it can be scheduled independently and does not block or get blocked by Sections 2/3 feature work, except where noted (7.2's caching-strategy phase depends on the research spike in 7.1).

### 7.1 Key constraint discovered during investigation

`FFmpegVideoProcessor.ts` loads `ffmpeg-core.js` / `ffmpeg-core.wasm` (~30MB) from a **cross-origin CDN** (`https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm`) at runtime via `toBlobURL()`, not as a bundled build-time asset. This has consequences that must be designed around, not discovered late:

- These files cannot be Workbox-**precached** (the precache manifest only covers same-origin build output). They must be handled by a **runtime caching route** scoped to the `unpkg.com` origin.
- A user who has never triggered the `ffmpeg.wasm` fallback path (e.g. only ever used WebCodecs-compatible files) will **not** have this asset cached, and the fallback path will be unavailable offline until first successful online use. This is an acceptable, explicitly-documented limitation — not a bug to "fix" by forcing a precache of a 30MB cross-origin blob into the install step.
- `meshoptimizer`'s WASM is inlined as base64 within its JS module — it is automatically covered by normal JS precaching, no special handling needed. `isosurface` is currently pure JS (Surface Nets is a deferred feature per Section 3) and has no WASM footprint yet; revisit this table if/when Surface Nets is implemented.

| Asset | Origin | Build-time bundled? | Caching treatment |
|---|---|---|---|
| `ffmpeg-core.js` / `ffmpeg-core.wasm` | Cross-origin (`unpkg.com`) | No — fetched at runtime via `toBlobURL()` | Runtime cache, `CacheFirst`, long expiration, separate cache bucket |
| `meshoptimizer` WASM | Same-origin (inlined base64 in JS bundle) | Yes | Covered by default precache (no special config) |
| `isosurface` (future Surface Nets) | Same-origin (currently pure JS) | Yes | Covered by default precache; re-evaluate if a WASM build is introduced |
| App shell (JS/CSS/HTML, Vue chunks, three.js) | Same-origin | Yes | Precache (Workbox `globPatterns`) |
| Fonts (IBM Plex Sans via Google Fonts) | Cross-origin (`fonts.googleapis.com` / `fonts.gstatic.com`) | No | Runtime cache, `CacheFirst`, long expiration |
| User-supplied video/image input files | N/A (local `File`/Blob, never fetched) | N/A | Not a service-worker concern — already entirely client-side/in-memory; no caching needed |
| Saved projects (Section 2.7 JSON) | N/A (local serialization target) | N/A | Out of scope for SW caching; see 7.6 |

**Research spike resolved**: the CDN approach is kept. `@ffmpeg/core` is ~62MB unpacked; vendoring it as a same-origin npm dependency would add that weight to the build output and GitHub Pages deploy/repo size for a one-time precache gain that most users (those who never hit the ffmpeg fallback path) would never benefit from. The CDN fetch + `runtimeCaching` rule (7.1 table above) is the better trade-off; the documented offline limitation (first use of the fallback path must happen online) is accepted as-is.

### 7.2 Phasing

| Phase | Content | Parallelizable? |
|---|---|---|
| 7.1 | Tooling setup: install `vite-plugin-pwa`, base config (`registerType`, `injectRegister`, `base`/`scope` aligned to `/TimeLaminator/`), manifest skeleton. Spike: confirm CDN-vs-vendored decision for `@ffmpeg/core` (see 7.1 research item) | Can start immediately, independent of Sections 2–6 feature work |
| 7.2 | Icon asset generation: produce raster icons (192×192, 512×512, maskable variant, `apple-touch-icon`) from the existing `favicon.svg` / `icons.svg` source; wire into manifest `icons` array and `index.html` `<link>` tags | Parallel with 7.1 |
| 7.3 | Caching strategy implementation: Workbox `globPatterns` for app-shell precache; `runtimeCaching` rules for the `unpkg.com` ffmpeg-core origin and Google Fonts origin (per table in 7.1); verify behavior under the `/TimeLaminator/` GitHub Pages base path (precache URL prefixing, `navigateFallback`) | After 7.1; depends on the CDN-vs-vendored spike outcome |
| 7.4 | Update UX: implement chosen `registerType` (see 7.3 decision below) and any associated UI (update-available toast / install-prompt affordance), styled per Section 5 tokens | After 7.1; can run parallel to 7.3 |
| 7.5 | Testing & verification: Lighthouse PWA audit, offline smoke test (load app with network disabled, run a project end-to-end where possible), install test on at least one desktop and one mobile platform, regression check that GitHub Pages deploy still serves manifest/SW correctly | After 7.2–7.4 |
| 7.6 (low priority / deferred) | Re-evaluate offline project save/load (Section 2.7) against the service worker's storage scope once IndexedDB or File System Access usage (if any) is introduced for project persistence; not required for initial PWA rollout since current save/load already work via local JSON without network dependency | Deferred — only relevant if Section 2.7's storage backend changes from "download a JSON file" to a persisted browser storage API |

**Time-intensive items requiring particular attention**: 7.1's CDN-vs-vendored research spike (affects 7.3's design directly) and 7.5's offline/install testing across platforms (Workbox + GitHub Pages base-path interactions are easy to get subtly wrong and hard to detect without manual device testing).

### 7.3 Update UX decision

| Option | Behavior | Decision |
|---|---|---|
| `autoUpdate` | New service worker activates and takes control silently on next load; no user-facing interruption | **Not selected.** TimeLaminator may hold large in-memory state (loaded video, in-progress mesh) that an unannounced reload would destroy |
| `prompt` | New service worker installs and waits; app shows an update-available affordance, user controls when to reload | **Selected.** A minimal toast/banner ("Update available — Reload to apply"), styled with existing Section 5.3 tokens (`--color-background-info` / `--color-text-info` for the action, `--border-radius-lg`, no shadows/gradients), placed as a non-blocking overlay near the toolbar. Reload is user-initiated only, never automatic. |

### 7.4 Manifest specification

| Field | Value | Notes |
|---|---|---|
| `name` | `TimeLaminator` | |
| `short_name` | `TimeLaminator` | Fits standard home-screen label width without truncation |
| `start_url` | `/TimeLaminator/` | Must match Vite `base` / GitHub Pages subpath |
| `scope` | `/TimeLaminator/` | Must match `start_url`; constrains SW control to the deployed subpath |
| `display` | `standalone` | No browser chrome; matches "installable app" goal over "just a tab" |
| `background_color` | `#ffffff` | Matches `--color-background-primary` (light mode) |
| `theme_color` | `#ffffff` | Reuses `--color-background-primary`; see dark-mode note below |
| `orientation` | Not constrained (`any`) | Desktop-first per Section 5.4; no rationale to lock orientation |
| `icons` | 192×192, 512×512 (`purpose: "any"`), 512×512 (`purpose: "maskable"`) | Generated per Phase 7.2 from existing SVG source |
| `description` | Short one-line description of the STL-from-video transformation (Section 1.1) | For app-store-like install UI surfaces |

**Dark mode note**: Section 5.3 defines `--color-background-primary` as `#1c1c1a` under `prefers-color-scheme: dark`. The manifest's static `theme_color` cannot media-query; if matching the OS chrome color in dark mode is desired, add a second `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1c1c1a">` tag in `index.html` alongside the default light-mode tag (`vite-plugin-pwa` does not auto-generate this — it must be added directly to `index.html`). Treat as optional polish, not a blocking requirement.

### 7.5 Testing / verification approach

| Check | Method |
|---|---|
| PWA installability & manifest validity | Lighthouse PWA audit (Chrome DevTools or CLI), target a passing installability score |
| Offline app-shell load | DevTools "Offline" network throttling, full reload, verify app shell renders and is interactive |
| Offline core workflow | With network disabled post-first-visit: load a previously-processed local video via WebCodecs path (no ffmpeg fallback needed), run pipeline through to STL export, confirm no network-dependent failure |
| ffmpeg fallback offline caveat | Explicitly verify and document (not "fix") that the ffmpeg.wasm fallback path requires one prior online use before it works offline, per 7.1 |
| Install flow | Manual test: install via browser "Install app" affordance on at least one desktop browser (Chrome/Edge) and one mobile platform (Android Chrome at minimum; iOS Safari "Add to Home Screen" as best-effort, since iOS PWA support has known limitations) |
| Update flow | Deploy a build with a trivial change, confirm the update-available toast (7.3) appears on next visit and reload applies the new version without silent data loss |
| GitHub Pages base-path regression | Confirm manifest, service worker registration, and all precached asset URLs resolve correctly under `/TimeLaminator/` in the deployed (not just local dev) environment |

### 7.6 Out of scope / deferred

| Item | Reason |
|---|---|
| Push notifications | No server/backend exists to originate pushes; app is fully client-side. Not applicable. |
| Background sync | No queued network requests exist to sync — all processing is local/in-memory. Not applicable. |
| Periodic background sync | Same rationale as above |
| Dedicated offline fallback page/route | App is a single-view SPA (Section 5.4 layout); a generic "offline" route adds no value over the app shell itself loading from cache |
| Vendoring `@ffmpeg/core` as a same-origin dependency | Deferred pending the Phase 7.1 research spike outcome; may be picked up later as a follow-up if CDN runtime-caching proves unreliable in practice |
| Persisting project save/load (Section 2.7) via IndexedDB/File System Access for true offline project continuity | Current implementation already works offline (local JSON file download/upload, no network dependency); revisit only if Section 2.7 is redesigned around a browser-storage backend (tracked as Phase 7.6) |

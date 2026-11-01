# Design system: readable infrastructure observability

The interface uses a calm, low-chroma neutral surface hierarchy with purpose-specific color accents. Both light and dark modes are provided because there is **no single scientifically proven most comfortable color scheme for every user**. Readability and user control take precedence over decorative glow.

## Evidence-based foundations

1. [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) specifies a **4.5:1** minimum contrast ratio for ordinary text and **3:1** for large text and meaningful non-text components. Color must not be the sole means of conveying information.
2. [IBM Carbon color guidance](https://www.carbondesignsystem.com/building-blocks/foundations/color/overview) describes a neutral-layered interface with color reserved for functional emphasis.
3. [IBM Carbon data visualization palettes](https://www.carbondesignsystem.com/building-blocks/data-visualization/color-palettes) recommend distinct categorical colors instead of arbitrary rainbow series.

The application includes explicit labels for severity, data origin, and selected states. It supports keyboard focus and reduced-motion preferences. Chart series use text labels and tooltips.

## Verified palette contrast

Contrast below is calculated using WCAG relative luminance against primary card backgrounds (rounded to two decimals).

| Theme | Role | Foreground | Card | Contrast |
| --- | --- | --- | --- | --- |
| Dark | Primary text | `#F3F7FC` | `#141F2B` | **15.49:1** |
| Dark | Secondary text | `#B4C6D3` | `#141F2B` | **9.49:1** |
| Dark | Low-emphasis text | `#93AABC` | `#141F2B` | **6.91:1** |
| Dark | Chart blue | `#64B8FF` | `#141F2B` | **7.81:1** |
| Dark | Warm gold | `#E5C78F` | `#141F2B` | **10.23:1** |
| Light | Primary text | `#1C2C3A` | `#FFFFFF` | **14.28:1** |
| Light | Secondary text | `#455E70` | `#FFFFFF` | **6.80:1** |
| Light | Low-emphasis text | `#5D7486` | `#FFFFFF` | **4.87:1** |
| Light | Chart blue | `#146EAC` | `#FFFFFF` | **5.45:1** |

These checks support specific color combinations, **not** certification of the whole interface. Full WCAG conformance requires testing of all controls, charts, states and responsive layouts.

## Chart semantics

* **Blue:** performance trend and navigation focus.
* **Teal:** live host readings and healthy state.
* **Gold:** storage capacity and deliberate emphasis.
* **Amber:** threshold warning.
* **Red:** threshold critical.
* **Violet:** additional categorical data.

Severity, live/simulated provenance and selection also appear as words and shapes. Unverified predictive risk scores and invented real-device deltas are omitted.

## Interface architecture

* Five views: Overview, Storage Arrays, Host Telemetry, Performance, Incidents.
* Responsive summary cards, capacity rings, gradient line areas, per-device bars, historical heatmap, array drawer, illustrative topology and threshold observations.
* Keyboard-accessible controls, CSV export, theme toggle and refresh controls.
* `prefers-reduced-motion` suppresses decorative transitions.
* Consistent charcoal and champagne gold branding, with restrained blue and teal for separate data categories.

# CareerTwin design system

Researched and adopted 2026-09-17, replacing an interface that had tokenised colour but no scale for
type, spacing or radius. Every size in the stylesheet was a hand-picked number, and 82 type rules sat
between 8px and 11px, below any readable floor.

## Sources

- [Design Systems, Spacing, grids, and layouts](https://www.designsystems.com/space-grids-and-layouts/)
- [Atlassian Design, Spacing foundations](https://atlassian.design/foundations/spacing)
- [freeCodeCamp, 8-Point Grid: Typography On The Web](https://www.freecodecamp.org/news/8-point-grid-typography-on-the-web-be5dc97db6bc/)
- [Cieden, Typographic scale types](https://cieden.com/book/sub-atomic/typography/different-type-scale-types)
- [Typography Master, Type scale systems](https://www.typographymaster.com/guide/type-scale-systems)
- [ColorContrast, WCAG-compliant dark UI guide](https://www.colorcontrast.org/blog/dark-mode-contrast-accessibility-guide/)
- [Material Design, Dark theme](https://m2.material.io/design/color/dark-theme.html)
- [Fourzerothree, Designing a scalable and accessible dark theme](https://www.fourzerothree.in/p/scalable-accessible-dark-mode)
- [Zoho Analytics, Types of charts for data visualization](https://www.zoho.com/analytics/insightshq/types-of-charts.html)
- [Fuselab Creative, Data visualization best practices](https://fuselabcreative.com/data-visualization-best-practices/)

## Type

Base **16px**, Major Third ratio **1.25**. 16px is the browser default and the practical WCAG 2.1 AA
minimum for body text. The Major Third is the standard choice for dense product UI: large enough to
separate levels, small enough not to blow up a workbench layout.

Line heights land on the **4pt baseline** so the type rhythm aligns with the 8pt spatial grid.

| Token | Size | Line height | Use |
|---|---|---|---|
| `--text-2xs` | 12px | 16px | Legal, dense table meta. Never body |
| `--text-xs` | 13px | 20px | Badges, captions, axis labels |
| `--text-sm` | 14px | 20px | Secondary text, table cells |
| `--text-base` | 16px | 24px | **Body. The default** |
| `--text-lg` | 20px | 28px | Card titles, section leads |
| `--text-xl` | 25px | 32px | Panel headings |
| `--text-2xl` | 31px | 40px | Page headings |
| `--text-3xl` | 39px | 48px | Display |

**Floor: 12px, and only for non-essential meta.** Nothing readable renders below it.

## Spacing

The **8pt grid**, with a 4pt half step. 8 divides by 1, 2, 4 and 8, and scales to 1.5x, 2x and 3x
densities without fractional pixels.

| Token | Value |
|---|---|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 24px |
| `--space-6` | 32px |
| `--space-7` | 48px |
| `--space-8` | 64px |

**Arbitrary spacing is rejected back to the system.** A request for 9px, 11px or 17px is a request to
pick the nearest token. Those three values alone appeared dozens of times in the original stylesheet and
are the reason nothing aligned to a rhythm.

## Radius and elevation

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 8px | Inputs, chips, small controls |
| `--radius-md` | 12px | Buttons, list rows |
| `--radius-lg` | 16px | Cards, panels |
| `--radius-xl` | 24px | Stages, modals |
| `--radius-full` | 999px | Pills, avatars |

## Colour

Two independent palettes, not one inverted. A hue that passes 4.5:1 on white can fall to 2.3:1 on a dark
canvas, so each theme is verified as its own system.

Targets: **4.5:1 for body text, 3:1 for large text and non-text UI** including borders and focus rings.

Semantic tokens carry purpose, not appearance: `--accent` (primary action), `--positive`, `--warning`,
`--critical`, `--info`. Components reference the semantic token so a theme change never edits a component.

**Focus visibility is a first-class requirement.** The most common dark-mode accessibility failure is not
body contrast; it is invisible form fields and focus indicators. Every interactive element carries a
focus ring at 3:1 against its own background.

## Charts

Chart type is chosen by the question, never by appearance. The most expensive visualisation mistake is
picking the wrong form.

| Question | Form |
|---|---|
| How do these options rank? | **Horizontal bars, sorted high to low.** The gold standard for comparing categories |
| What is the headline number? | KPI scorecard with one figure and its unit |
| Where are the gaps? | Status-grouped list or small multiples, not a radar |
| How did this change over time? | Line |
| What is the composition? | Stacked bar |

**Rejected for this product**: force-directed network graphs and adjacency matrices as primary surfaces.
They signal "knowledge graph" and answer no question a candidate asks. A ranked bar comparison answers
"which role should I pursue" in one glance; a force layout never does, and its node positions carry no
meaning at all.

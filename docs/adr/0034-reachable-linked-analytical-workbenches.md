# 0034: Reachable, linked analytical workbenches

Status: accepted, 2026-10-04.

## Context

A fixed document viewport is not proof that its content is reachable. The Opportunities analytical
panel clipped overflow, so expanding the landscape table moved its final rows outside the panel.
Programmatic focus could scroll a hidden container and hide its header, while wheel input could
not reach the same content. Graph alternatives had the same containment risk. Mobile skill filters
also exceeded their row width, and secondary editors lacked a consistent modal keyboard contract.

## Decision

1. Preserve the fixed document and approved shared authenticated shell. The analytical panel owns
   its vertical overflow, with zero intrinsic minimum size and contained overscroll. Long graph
   tables additionally own a bounded table region with sticky column headings.
2. Bound chart height independently of its children's output and expanded tables. Short-height
   viewports retain a minimum useful working area through the existing main content scroller.
3. Treat tables as complete analytical views. Rank at most 18 chart signals, retain every filtered
   signal in the table and state both counts. Search/minimum-occurrence filters do not alter the
   percentage denominator, which remains the entire saved opportunity set.
4. Bar and table selections inspect the actual saved roles behind a facet, then open the selected
   role's existing requirement workbench. No inferred employer salary, global-market coverage,
   application event or hiring probability is introduced by this interaction.
5. Every secondary modal contains forward/backward focus, includes dynamically added form controls,
   closes on Escape and restores its opener. Closed copilot controls are inert. The copilot remains
   a non-modal complementary tool and preserves its real provider-availability restrictions.
6. Acceptance uses real API data in an isolated synthetic seeker and actual pointer/wheel input.
   Check fixed document geometry, the final expanded row, role navigation, responsive controls,
   graph alternatives, short-height fallback, dialogs, bilingual themes and console failures.
   DOM/component tests alone cannot establish visual reachability.

## Consequences

Expandable content can exceed a panel without becoming inaccessible or resizing its canvas.
Filters and linked selection answer a practical question instead of providing decorative motion.
The primary mobile navigation stays a single row; dense editing tools remain secondary dialogs.
No schema, matching policy, tenant permissions or canonical profile fields change.

## References

- [WCAG reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
- [WAI-ARIA modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- [HTML inert attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inert).

# ADR 0029: Decision-grade experience and visualization contract

Status: accepted in 0.5.0.

## Context

CareerTwin already exposed broad profile, opportunity, match, and pipeline functionality, but visual
novelty alone did not make the system easy to learn or safe to interpret. The dashboard had no
single first-use path. The career timeline plotted isolated dates instead of durations. Opportunity
facets mixed different questions in one chart. The match radar did not identify the weakest
supported category. Graph alternatives did not share the inspector, some matrix targets were only
16 CSS pixels, chart colors were bound to the dark theme, and the visible `Ctrl K` affordance did not
have a keyboard handler.

These are product-contract failures: a technically rendered chart can still hide denominators,
invent temporal meaning, strand keyboard users, or imply more certainty than the stored evidence.

## Decision

Adopt a decision-grade experience contract:

1. The authenticated dashboard presents four evidence-derived, directly actionable milestones:
   profile, target opportunity, match, and next action. It is guidance, not a forced wizard.
2. Each analytical surface answers one named question at a time, publishes its universe or
   denominator, and preserves unknown data instead of manufacturing values.
3. Career history uses bounded, zoomable duration ranges. Opportunity patterns use selectable
   ranked lenses. Match categories add a lowest-supported-first explanation with score, coverage,
   and requirement count.
4. Professional and opportunity graphs use deterministic bounded ForceAtlas2 coordinates and stop
   after layout. Network, matrix, and table lenses all select the same metadata/relationship
   inspector. Fit and neighborhood-focus controls restore orientation.
5. Every chart reads theme tokens, reacts to theme and container changes, disables animation when
   reduced motion is requested, enables ECharts ARIA/decal metadata, and has an exact table or list
   fallback. User-controlled tooltip text is escaped.
6. Interactive targets meet the WCAG 2.2 24 CSS pixel minimum where the exception does not apply,
   focus indication remains visible, `Ctrl/Command+K` is functional, and account-menu state is
   exposed programmatically and dismissible with Escape.
7. The release gate runs axe without disabling color contrast on login and also audits the
   authenticated shell. Component tests cover analytical lens switching, duration-table fallback,
   priority-gap ordering, chart ARIA/reduced-motion behavior, and shell keyboard behavior.

## Consequences

- A visualization change is incomplete unless its question, denominator, uncertainty, theme,
  motion, keyboard path, and nonvisual fallback remain truthful.
- ForceAtlas2 adds a small maintained MIT dependency and bounded main-thread work for at most 350
  entities. Larger graphs retain deterministic starting coordinates rather than risking a frozen UI.
- Tables are first-class product views, not degraded accessibility copies; they participate in the
  same entity-selection workflow.
- Automated accessibility remains incomplete. A release still requires rendered desktop/phone,
  dark/light, English/Spanish, keyboard, zoom, and contrast inspection; inability to obtain a browser
  must be recorded rather than converted into a passing claim.

## References

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [WCAG 2.2 target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [Apache ECharts ARIA](https://echarts.apache.org/handbook/en/best-practices/aria/)
- [Graphology ForceAtlas2](https://graphology.github.io/standard-library/layout-forceatlas2.html)

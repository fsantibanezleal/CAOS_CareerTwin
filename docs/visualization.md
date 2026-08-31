# Visualization system

## Questions before charts

Each view answers a user decision:

- **Professional constellation**: what entities support the person's current story, and which capabilities lack evidence?
- **Career river**: how did experience and education unfold over time?
- **Evidence matrix**: which skills have level, confidence, and confirmed claims?
- **Opportunity landscape**: what recurs within the user's saved set?
- **Opportunity knowledge graph**: which roles share requirements, employers, industries, seniority,
  locations, work modes, and explicit target scenarios?
- **Match shape/bridge**: which requirement families align, which are unknown, and what evidence supports each status?
- **Pipeline board/agenda/funnel**: what must happen next and what has happened in the user's own process?

## Atalaya review

CAOS Atalaya demonstrated useful principles: multiple genuinely different analytical lenses; stable/baked layouts; strength/degree encoding; theme versus mined-cluster color; searchable highlighting; accessible SVG/table alternatives; artifact decimation; and pausing force/WebGL loops when hidden. It also showed that “clean,” “glow,” and 3-D skins are not different analyses, and later added adjacency-matrix and arc views to reduce network occlusion.

CareerTwin carries forward evidence-bearing edges, stable IDs, legends, alternative tables, bounded payloads, and question-specific views. Both primary graphs provide three genuinely different lenses: a hover-isolated/searchable node-link view, a degree-ranked adjacency matrix for dense relationships, and a complete table. The node inspector is shared by all three lenses and exposes exact metadata and typed neighboring edges. It does not ship decorative 3-D: a single person's graph is smaller, sensitive, and frequently used on phones; depth/orbit adds interaction and accessibility cost without a new career question.

The node-link lens starts from deterministic positions and runs a bounded synchronous ForceAtlas2
layout for graphs of at most 350 entities. The resulting coordinates are frozen; there is no
continuous force loop consuming the user's device. The profile node remains anchored, degree and
evidence strength affect size, and selected-neighborhood focus plus fit-to-view controls make dense
graphs recoverable. Matrix targets are at least 26 CSS pixels and the complete table is the
keyboard/screen-reader inspection path.

## Engines evaluated

- **Sigma.js + Graphology** selected for performant interactive node-link rendering and explicit graph data structures.
- **Apache ECharts modular core** selected for radar, bar, custom duration, timeline, and future Sankey/calendar views with accessible text adjacent to every chart.
- **React Flow** selected only for inspectable architecture/process diagrams, not canonical career data.
- **Cytoscape.js** remains a strong alternative for compound graphs and algorithms; not needed for the first-alpha graph size.
- **D3** offers maximum grammar control but would require more custom interaction/accessibility code.
- **Cosmograph/GraphXR/3-D force graphs** were considered for scale or novelty but rejected for CareerTwin's privacy, device, and accessibility requirements.

Current primary references are the official [Sigma.js](https://www.sigmajs.org/docs/),
[Graphology](https://graphology.github.io/), [Cytoscape.js](https://js.cytoscape.org/),
[Cosmos.gl](https://github.com/cosmosgl/graph), and
[Apache ECharts](https://echarts.apache.org/en/cheat-sheet.html) documentation. Sigma's WebGL
renderer is intended for thousands of nodes/edges; Graphology provides the eventful graph model and
algorithm/layout standard library. Cytoscape.js would become preferable if CareerTwin adds nested
compound taxonomies. Cosmos.gl is designed for GPU-scale networks far beyond a comprehensible
single-person graph. Those capability differences, not aesthetic preference, drive the selection.

## Rules

- Every color also has text/status/icon encoding.
- Unknown and missing are different states.
- All network views offer an accessible table or list.
- Charts state their denominator and universe.
- Reduced-motion disables nonessential animation.
- No chart implies precision beyond stored evidence.
- Graph/layout data is a projection; editing occurs through domain forms and review gates.
- The opportunity graph's universe is only saved user research. Shared requirement nodes indicate
  recurrence inside that set, never labor-market prevalence.

## Implemented interaction contract

- The dashboard gives a four-milestone path from profile evidence through a target role, evidence
  match, and candidate-owned next action. Each milestone links to the exact work surface and derives
  completion only from persisted workspace signals.
- Career history is a zoomable duration range, not a scatter plot. Records without a valid start
  remain in the adjacent table instead of receiving an invented date.
- The opportunity landscape has user-selected skills, seniority, and industry lenses. Every lens is
  sorted by occurrence, reports the saved-role denominator, and has a table with exact counts and
  shares.
- Match analysis retains the category radar but follows it with a gap-first breakdown containing
  score, evidence coverage, and requirement count. The first card is the lowest-supported category;
  it is not a prediction of rejection.
- ECharts reads active CSS design tokens after a theme change, publishes an ARIA description and
  decal encoding, disables animation for reduced-motion users, and resizes with its container.
- Dynamic labels supplied by a seeker are escaped before an HTML tooltip is constructed.
- `Ctrl/Command+K` opens the career copilot and the account menu exposes expanded/menu semantics and
  closes on Escape.

These contracts follow [WCAG 2.2](https://www.w3.org/TR/WCAG22/), the
[24 CSS pixel target-size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html),
[ECharts ARIA guidance](https://echarts.apache.org/handbook/en/best-practices/aria/), and the
[Graphology ForceAtlas2 API](https://graphology.github.io/standard-library/layout-forceatlas2.html).
Automated axe, unit, type, lint, and build gates are a floor. Keyboard, zoom, contrast, themes,
languages, and phone-scale behavior still require a rendered release review.

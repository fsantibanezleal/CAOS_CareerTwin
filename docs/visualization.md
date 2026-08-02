# Visualization system

## Questions before charts

Each view answers a user decision:

- **Professional constellation**: what entities support the person's current story, and which capabilities lack evidence?
- **Career river**: how did experience and education unfold over time?
- **Evidence matrix**: which skills have level, confidence, and confirmed claims?
- **Opportunity landscape**: what recurs within the user's saved set?
- **Match shape/bridge**: which requirement families align, which are unknown, and what evidence supports each status?
- **Pipeline board/agenda/funnel**: what must happen next and what has happened in the user's own process?

## Atalaya review

CAOS Atalaya demonstrated useful principles: multiple genuinely different analytical lenses; stable/baked layouts; strength/degree encoding; theme versus mined-cluster color; searchable highlighting; accessible SVG/table alternatives; artifact decimation; and pausing force/WebGL loops when hidden. It also showed that “clean,” “glow,” and 3-D skins are not different analyses, and later added adjacency-matrix and arc views to reduce network occlusion.

CareerTwin carries forward evidence-bearing edges, stable IDs, legends, alternative tables, bounded payloads, and question-specific views. It does not ship decorative 3-D: a single person's graph is smaller, sensitive, and frequently used on phones; depth/orbit adds interaction and accessibility cost without a new career question.

## Engines evaluated

- **Sigma.js + Graphology** selected for performant interactive node-link rendering and explicit graph data structures.
- **Apache ECharts modular core** selected for radar, bar, scatter, timeline, and future Sankey/calendar views with accessible text adjacent to every chart.
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

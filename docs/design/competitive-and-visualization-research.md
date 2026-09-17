# What comparable tools actually build, and what to visualise with

Researched 2026-09-17, after the Profile visualisations were rejected. This answers two questions the
earlier design research did not: what do competing career tools put on screen, and which library gives
genuinely rich interaction.

## Sources

- [Huntr vs Teal, 2026](https://huntr.co/blog/huntr-vs-teal)
- [Careerflow, Teal vs Jobscan vs Careerflow](https://www.careerflow.ai/blog/teal-vs-jobscan-vs-careerflow)
- [Jobscan vs Teal](https://www.jobscan.co/blog/jobscan-vs-teal/)
- [Sprad, Top 5 Teal alternatives for skills-based job search](https://sprad.io/blog/top-5-teal-alternatives-for-smarter-skills-based-job-search-without-spam)
- [Prentus, Best job tracker apps 2026](https://prentus.com/blog/we-found-the-5-best-job-tracker-tools-on-the-market)
- [Strapi, Best chart libraries for developers 2026](https://strapi.io/blog/chart-libraries)
- [Querio, Choosing the best charting library for React in 2026](https://querio.ai/blogs/charting-library-for-react)
- [LightningChart, Best D3.js alternatives in 2026](https://lightningchart.com/blog/best-d3-js-alternatives-in-2026/)

## What the competition actually ships

| Tool | Core surface | Noted strength |
|---|---|---|
| **Teal** | Keyword gap analysis per job description, checklists, detailed breakdowns | Strongest for people who want gaps surfaced and deliberate action pushed |
| **Jobscan** | ATS and skills-gap keyword analysis | Detects the specific applicant system in use (Workday, Greenhouse, Taleo) and gives system-specific advice |
| **Huntr** | Job match with skill suggestions | Match output rated materially better because it is **"more consistently actionable and easier to verify against real job requirements"** |
| **Careerflow** | Kanban tracker, LinkedIn profile review | Profile optimisation |

**The finding that matters most.** Huntr beats Teal on match quality not because of nicer charts, but
because its output is **actionable and verifiable against the real requirements**. The competitive axis is
the usefulness of the statement, not the richness of the picture.

**Not one of them ships a force-directed network, a constellation or an adjacency matrix.** The entire
category converges on gap lists, keyword comparison, checklists and kanban. CareerTwin shipped a 109-node
hairball that no competitor considered worth building, and omitted the per-requirement actionable output
that every competitor treats as the product.

## Implication for CareerTwin

The engine already produces what the category competes on: per-requirement status with evidence, and a
deterministic coverage figure. That is Jobscan's gap analysis plus Teal's breakdown plus Huntr's
verifiability, and it is stronger than any of them because each line traces to a source.

The failure is entirely in presentation. The correct surfaces are:

1. **Per-requirement gap, ranked, with the evidence behind each line.** The category standard. Built as
   the coverage workbench.
2. **A labelled career timeline.** Replaces the unlabelled two-lane river.
3. **Capability strength by evidence count.** Replaces the constellation.
4. **A pipeline board.** Already present.

## Visualisation libraries

| Library | Character | Verdict for this product |
|---|---|---|
| **Apache ECharts** | Already a dependency. Broad chart set, canvas renderer | **Keep**, but wire its interaction. `DataZoomComponent` and `LegendComponent` are imported and never configured, and the wrapper exposes no event handlers |
| **visx** (Airbnb) | React wrapper over D3 primitives, ~15KB with modular imports, maximum customisation | **Best fit for bespoke interactive views.** Write React, not raw D3, and keep bundle small |
| **Observable Plot** | Grammar of graphics from D3's author, canvas-based, far less code than raw D3 | Strong for fast analytical charts |
| **Nivo** | Beautiful defaults, good interactivity, SSR | Good if defaults matter more than control |
| **Highcharts** | 40+ types, best-in-class accessibility and keyboard navigation | **Rejected: commercial licence required** |
| **Sigma + graphology** | Force-directed network | **Remove.** No competitor ships this, node position carries no meaning, and 109 nodes render as an unreadable hairball |

## The interaction defect to fix in code

`EChart.tsx` is the wrapper every figure passes through and it forecloses interaction:

- It accepts only an `option` prop. No `onEvents`, no click or selection callback. A grep finds **zero**
  interaction wiring in the wrapper.
- The container is rendered as `role="img"` with an `aria-label`, declaring every chart to be a **static
  picture**.
- It calls `setOption(..., { notMerge: true })` on every update, discarding all chart state, so selection
  could not persist even if it existed.
- `DataZoomComponent` and `LegendComponent` are registered into the bundle and never used.

Rich interaction therefore requires changing the wrapper, not the call sites: emit events, keep state
across updates, drop `role="img"` in favour of real semantics, and enable the zoom and legend components
already being paid for in bundle size.

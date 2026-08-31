# ADR 0012: Sigma/Graphology, modular ECharts, and React Flow

- Status: Accepted
- Date: 2026-08-01

## Decision

Use Sigma.js with Graphology for the professional evidence network, modular Apache ECharts for analytical charts, and React Flow only for architecture/process diagrams. Provide stable IDs, legends, visible denominators, accessible table/list fallbacks, themes, and reduced motion. Do not ship decorative 3-D.

## Consequences

The stack supports novel, high-impact views without one visualization engine controlling the domain. Vendor chunks are lazy-loaded. Contributors must preserve nonvisual equivalents and truthful semantic labels when adding a lens.

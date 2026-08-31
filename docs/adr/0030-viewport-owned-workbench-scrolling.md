# ADR 0030: Own scrolling inside the workbench viewport

Status: accepted for 0.5.3.

## Context

CareerTwin routes can contain long evidence lists, analytical views, timelines, and administration
controls. A shell sized only with `min-height: 100vh` lets that content increase the browser document
height. The result leaves two possible scroll owners, moves fixed navigation relative to a document
that should remain stable, and violates the CAOS rendered-workbench acceptance contract.

Mobile navigation also needs bottom safe-area clearance. Adding that clearance to the outer shell
increases the document box; it does not protect the final content inside the intended scroller.

## Decision

The browser document (`html`, `body`, and `#root`) is exactly viewport-sized and never scrolls. The
authenticated `WorkbenchShell` is a `100dvh`, zero-minimum grid whose main column is the single
vertical scroll owner. The header remains sticky inside that owner and the sidebar remains fixed.

At mobile widths the fixed bottom navigation consumes no outer-shell padding. Equivalent clearance,
including the device safe-area inset, belongs to the route content inside the main scroller. Login and
boot screens are independent viewport-sized surfaces and own any overflow they require.

## Consequences

- Rendered acceptance must measure `document.scrollWidth === window.innerWidth` and
  `document.scrollHeight === window.innerHeight` at every supported viewport.
- Long-route verification must additionally show that the main workbench element can scroll while
  the document cannot.
- Static CSS contract tests protect the ownership declarations; real browser checks remain required
  because CSS parsing alone cannot prove rendered geometry.
- The minimum supported width remains 320 CSS pixels; zoom and narrow-device gates still test for
  horizontal overflow independently.

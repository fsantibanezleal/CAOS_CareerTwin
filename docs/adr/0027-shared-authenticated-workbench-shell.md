# ADR 0027: Consume the shared authenticated workbench shell

Status: accepted in 0.4.0.

## Context

CareerTwin implemented a complete local authenticated frame because the published CAOS shell exposed
only a prose/header layout and supported React Router through major 7. The local frame contains five
seeker routes, responsive desktop/sidebar and mobile/bottom navigation, command search, locale/theme
preferences, account administration, chat, architecture, and password controls. Replacing it with a
nested generic header or downgrading Router 8 would create visible regressions rather than conformance.

`@fasl-work/caos-app-shell` 0.5.0 introduces a typed `WorkbenchShell` over the stable `react-router`
core contract for majors 6, 7, and 8. It owns route rendering, active-link semantics, responsive frame
classes, and the main-content landmark while exposing product-owned slots.

## Decision

CareerTwin consumes the exact public npm package `@fasl-work/caos-app-shell@0.5.0` and renders every
authenticated view through `WorkbenchShell`. CareerTwin supplies its existing brand, trust and
architecture controls, command search, locale/theme/account/chat actions, security banner, overlays,
and route content through typed slots.

The package owns reusable frame/navigation semantics. CareerTwin continues to own authentication,
authorization, preferences persisted through its API, translations, product theme tokens, account
policy, chat state, architecture content, and canonical commands. Its product stylesheet refines the
shared semantic classes; it does not import the shell's optional prose/KaTeX design-system stylesheet.

## Consequences

- The dependency is a registry-pinned public artifact, not a workspace link, Git URL, copied source,
  nested shell, or unreleased tarball.
- Five seeker destinations retain active-link and mobile behavior; the superuser route remains an
  account-menu action rather than exposing administration to normal seekers.
- Router 8 remains the single application router; no DOM/core major mixing or downgrade is allowed.
- Component, accessibility, type, lint, build, package-audit, and rendered viewport/theme/language
  checks guard upgrades. An installed dependency without `WorkbenchShell` in the authenticated DOM is
  not conformance evidence.

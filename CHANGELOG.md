# Changelog

All notable changes follow Keep a Changelog. CareerTwin uses semantic versioning.

## [Unreleased]

## [0.14.4] - 2026-09-26

### Added

- A `guards` job in CI: the base-integrity checks (no tracked `.env`, no leaked local path), the
  ADR-0067 content standard (no em-dash, no emoji) and the ADR-0074 CI budget gate, run with the same
  scripts the product archetype ships.

### Changed

- Base images re-pinned to their current digests: `cgr.dev/chainguard/python:latest` and
  `:latest-dev`, `cgr.dev/chainguard/wolfi-base:latest`, and `node:24.21-alpine` (Dependabot #128).
- Dependabot routine groups: frontend (11 updates, #213), Python (10 updates, #214), GitHub Actions
  (7 updates, #215). These four Dependabot pull requests landed on `main` directly on 2026-09-26: the
  repository default branch had just been changed from `develop` to `main` and Dependabot retargeted
  them on rebase. `develop` was fast-forwarded to `main` afterwards, and `.github/dependabot.yml` now
  pins `target-branch: develop` for every ecosystem so it cannot recur.
- `js-yaml` 4.3.2 in the frontend (Dependabot alert 7, high).
- CI and CD follow the ADR-0074 budget rules: push triggers only on `develop` and `main`, no
  `pull_request` or `schedule` triggers, a concurrency group and a timeout on every job.

### Removed

- The `dependency-review` job in the Security workflow, which was gated on `pull_request` and so could
  never run under those triggers.

### Security

- CVE-2026-19499 (`glibc-2.44 2.44-r6`, High) no longer blocks the container gate: on 2026-09-26 the
  refreshed Grype database stopped matching it and code scanning marks both alerts fixed. The package
  is unchanged and `security/openvex.json` still holds no statements; see
  `docs/security/container-vulnerability-assessments.md`.

## [0.14.3] - 2026-09-18

### Removed

- The `ProfileConstellation` and `CareerRiver` visualizations, which no page has rendered since the
  profile rebuild replaced them with the skill map and the career timeline (#210), with their
  imports, helper and chart rule. The Sigma theming test they carried now covers
  `OpportunityNetwork`, the graph the Opportunities page renders.

## [0.14.2] - 2026-09-18

### Changed

- Requirement details on Opportunities and Matches list the confirmed claims behind an
  assessment as their statements, under "Backed by", instead of a count (#189). They read
  "Evidence 0" beside "Met" whenever a profile record such as a degree or a role answered the
  requirement; they now say that the record named in the explanation answered it.
- The profile's claims are one cache shared by every page and loaded when Opportunities and
  Matches open, so a detail opens with its evidence in place.

### Verification

- Tests for the evidence list: quoted statements from the shared cache, the note for a met
  requirement that a profile record answered, and nothing for an unanswered one. 61 frontend
  tests pass; the Opportunities and Matches gate phases pass on the built app with live data.

## [0.14.1] - 2026-09-18

### Changed

- Collapse the navigation rail to a 72px column of icons between 901px and 1366px (#188). At
  1280x800 the full rail took 238px, 19% of the screen for five links and two cards, and held the
  opportunity brief to 47% of the screen against ADR-0071 section 8's 50% floor. Every page gains
  166px at that size; the brief is 58% of the screen. Each label stays in the accessibility tree
  and appears beside its icon on hover and keyboard focus.

### Verification

- The workbench gate fails any opportunity brief under half the screen. A build without the rail
  failed it at 48%; with it, 195 checks pass across the five workbenches.

## [0.14.0] - 2026-09-18

### Changed

- Rebuild Today against ADR-0071 (#203), the last page of #187. Measured on v0.13.0 it overflowed
  by 587px at 1280x800 and 461px at 1600x900, beneath a marketing headline and a 324px guided
  workflow that was complete for the workspace. It now fits the viewport at every size.
- The page's instrument is a map of the roles by fit and salary ask. Each role draws its ask as a
  range, the market's central range behind it and its floor as a tick, coloured by its pipeline
  stage and labelled by employer; roles at the same fit are set side by side and labels are placed
  clear of every other mark. Selecting a role shows its stage, days in stage, fit with met and gaps,
  and its compensation band, with links to the role and its application. No role's fit or ask
  appeared on the page before.
- Needs attention lists, from recorded facts only, overdue tasks, open applications by days in
  their stage with the next legal step, tasks due within a week, evidence waiting for review and
  skills without confirmed evidence, each opening the place to act. It replaces a task list that
  was empty while three applications waited.
- Key figures in one row: portfolio fit, roles, applications by stage drawn to scale, confirmed
  claims and skills with evidence. "Profile completeness", which counted five filled text fields
  and read 100% beside 41 unbacked skills, is no longer a headline figure.
- Recent activity shows the latest stage changes and tasks. The guided workflow shows only while
  something is left to set up.
- Pipeline opens an application from a link (`?application=`); a linked application shows even
  when the board's filters would hide it.
- Stage colours are design tokens, shared by the pipeline and Today.

### Removed

- The stat card component and the rules for the old dashboard grid, guided-workflow card, stage
  ribbon, pulse list and task list, which nothing renders any more.

### Verification

- The model behind the map and the attention list is tested directly: placement, round axis
  ticks, side-by-side dodging, collision-free labels in the live cluster, attention order and the
  next legal step. 58 frontend tests pass.
- `scripts/workbench-gate.mjs` gains a Today phase: the key figures against the API, and every
  role on the map read back through the drawn axis labels to its fit and ask. The portfolio
  figure drawn one point high and ask ranges drawn 5% off each failed it. 195 checks pass across
  the five workbenches.

## [0.13.0] - 2026-09-18

### Changed

- Rebuild the pipeline against ADR-0071 (#199). Measured at 1280x800, the board overflowed the page
  by 309px and ran 1,183px sideways: nine columns of at least 230px, still 670px sideways at 2560.
  The agenda overflowed by 416px and connections by 543px. Every view now fits the viewport under
  one bar with the view switcher.
- The board is journeys and a detail pane. A stage strip counts the applications in each open
  stage, drawn to scale, and filters by stage; it replaces a funnel whose bar widths came from each
  stage's position in the list rather than its count. One row per application carries the role,
  its fit and salary ask, and its journey, drawn either across the six open stages with the date
  each was reached and the days in the current one, or along the calendar as one bar per stage, as
  long as the time spent in it. Rows sort by furthest along, best fit, highest ask or longest
  waiting; closed applications are behind a toggle.
- Selecting an application shows its fit with met requirements and gaps, the compensation band,
  the legal next moves, its stage history with dates and notes, its tasks, its people and its
  notes, with a link to the role. A move names what it does and asks to confirm, and closing moves
  say they cannot be undone; the card offered a select that moved the application on change.
- Calendar replaces the agenda: a month grid of stage changes, tasks, meetings and deadlines, and a
  day pane with the counts ahead, what is coming up and the most recent activity. With no tasks
  recorded, the agenda was an empty state while nine dated stage changes went unshown.
- People replaces the contacts panel: contacts grouped by application, and a detail with role,
  email, notes, the application's stage, fit and ask, and the tasks with that person. Deleting
  asks to confirm.
- Task and contact creation move into dialogs and name applications by role and employer rather
  than "Application 1a2b3c4d", and open from the detail pane already bound to its application.
- Connections sits in two columns with its cards restacked for the half width.
- Opportunities opens a role from a link (`?role=`), which the pipeline's Open role uses.

### Added

- `GET /api/pipeline/events` returns every stage event in the workspace, oldest first, so the
  journeys and the calendar need one request rather than one per application. Tested for order,
  agreement with the per-application history, and tenant isolation.
- A compact compensation band for side panes, about 100px tall where the panel takes 338px.

### Fixed

- Twenty-six Spanish strings shipped without accents (#200), two of them different words: "Anos"
  for "Años" and "ano de experiencia" for "año de experiencia". A test now fails on any Spanish
  entry containing a form that always carries an accent in interface copy.
- Remove the board, agenda, funnel and contact-form rules that nothing renders any more.

### Verification

- `scripts/workbench-gate.mjs` covers the pipeline: every view and both board modes at 1280x800,
  1600x900 and 2560x1440 in both themes, reading the strip's counts, each journey's stage, fit,
  reached stages and time segments, each detail pane's history and band, the calendar's items per
  day and the people list against the API, and checking that Open role lands on the same role. It
  reads what is drawn rather than data attributes, and three deliberate breaks in a build each
  failed it. `CAREERTWIN_GATE_ONLY` runs a single page's phase. 177 checks pass across the four
  workbenches.

## [0.12.0] - 2026-09-18

### Changed

- Rebuild the profile against ADR-0071. Measured at 1280x800, every tab overflowed, the overview by
  4,740px, beneath a headline that wrapped to three lines at 39px. One bar now carries the title
  and the tabs, and each tab is sized to the viewport.
- The overview is read, not edited: headline, narrative and facts as text, with editing in a
  dialog. It opened as an edit form.
- One skill map replaces the capability cards and the 73-row evidence matrix, which drew the same
  skills twice and led both with a level that sits between 90 and 98 for nearly every skill.
  Skills are grouped by category in balanced columns, each row carrying years of use as its bar
  and an evidence mark filled when a confirmed claim backs the skill. A filter isolates the 41 of
  73 skills that no confirmed claim backs, and selecting a skill lists the claims behind it.
- STAR stories become a list and a reading pane. Seven fully expanded stories stacked under a
  creation form took 3,392px.
- The career timeline keeps its content in compact rows; date labels sit inside a bar only when
  it can hold them and move to the side with room, so recent roles no longer read "2025-3now" or
  "2022-20". The experience and education editors open from Edit career.
- Artifacts split into stories, resume versions, communication, and import and export.

### Fixed

- A skill's evidence count counts confirmed claims only, as the matcher and the endpoint's own
  description always meant; the count used to include any linked claim. The skill API also returns
  the confirmed claim identifiers, so a reader can see what backs a skill.
- Unstyled small text fell to the browser's "smaller", 11.7px, below the 12px floor; it now has a
  13px element default.
- Remove em-dashes from product copy across five pages and both languages, and enforce ADR-0067
  with a test that names any line that reintroduces one.
- Remove the evidence matrix component and the rules for the old tabs, profile layout and matrix,
  which nothing renders any more.

### Verification

- `scripts/workbench-gate.mjs` covers the profile: every tab and artifact sub-tab at 1280x800,
  1600x900 and 2560x1440 in both themes, with the skill map's totals checked against the API and
  its rows checked for being visible. 120 checks pass across the three workbenches.

## [0.11.0] - 2026-09-18

### Changed

- Rebuild the matches page against ADR-0071. Measured at 1280x800 it overflowed by 2,365px: a
  serif headline, a portfolio panel that was an empty selector whenever no portfolio existed, a
  ranking block, a filter toolbar wrapping onto several lines, a requirement matrix of 29 rows at
  55px, and a saved-roles index that repeated the ranking. It is now one instrument: the matrix's
  header row is the ranking, one column per role with its fit and a fit bar, best fit first.
  Requirements are split by importance into tabs so each group fits without scrolling; only "All"
  may scroll, inside the matrix. The page opens on the gaps when there are any. Cells are labelled
  status pills rather than unlabelled dots, and hatched where a role does not ask for the
  requirement. The per-role detail, with its alignment shape, improvement actions and tracking,
  opens in a drawer from a column header. The portfolio panel appears only when a portfolio exists.
- Verified on the built app against the live data before release: every size, both themes, every
  importance tab with the gap view on and off, header fits equal to the API's. The committed gate
  `scripts/workbench-gate.mjs` now covers the matches page as well.

### Fixed

- Dim dialogs with a dark scrim in both themes. The backdrop was derived from `--text`, which is
  near-white on charcoal, so in the dark theme a modal dimmed its page with a light haze. It now
  has its own `--scrim` token.
- Remove the rules for the saved-roles index, the empty radar illustration and the unscored
  marker, which nothing renders any more.

## [0.10.1] - 2026-09-17

### Fixed

- Rank roles by fit on the matches page. The cross-role ranking in the coverage workbench sorted by
  coverage, the share of requirements the matcher could evaluate, and printed it as the ranked
  value. Every role read 100%, so the ranking compared nothing: an 82% fit sat level with 99% fits.
  It now sorts and labels by fit, with coverage in the tooltip, and the matrix columns follow the
  same best-fit-first order. v0.10.0 fixed the same defect on the opportunities page and missed
  this one. `CoverageWorkbench.test.tsx` holds every role at full coverage so that a regression to
  coverage fails immediately; reintroducing the coverage sort fails two of its three tests.

## [0.10.0] - 2026-09-17

### Fixed

- Headline fit, not coverage. Every role showed "100%", which was coverage: the share of
  requirements the matcher could evaluate, a data-quality measure. The run also carries the fit
  score, and Ultranav is an 82% fit with a missing requirement and four partials that read "100%"
  beside roles at 99%. The ring and the comparison list now show fit, labelled, and coverage moves
  to a tooltip. The list sorts best fit first.
- Never render a loading state as a verdict. The brief fetched its own run and, until it returned,
  rendered "0/18 met, 18 unknown, eligibility unknown", indistinguishable from a disastrous result.
  It now takes the run from the list the page has already loaded, and the page waits for it.
- Eligibility requirements rendered grey, uppercase and indented: a bare `.eligibility` rule from
  the matches page matched the column class. Importance is now a data attribute.

### Changed

- Rebuild the opportunity workbench against ADR-0071. Measured at 1440x800, about 400px of an
  800px screen was chrome before the first requirement. One bar replaces the marketing headline,
  its description and the toolbar. The card gallery becomes a comparison list carrying fit and the
  salary ask per role. Compensation is a single-row strip. Requirements are split by importance
  into columns, per ADR-0071 section 6: content that does not fit is split, not scrolled. The
  selected requirement opens as an overlay.
- Verified on the built app against the live data before release, across every saved role at
  1280x800, 1600x900 and 2560x1440 in both themes: no document scroll, no control cut off the bar,
  every requirement inside the visible brief, no clipped label, no text under 12px, and the fit
  shown in both list and brief equal to the stored score on first paint.
- Remove sixteen rules that styled the card gallery and the selection hint, which nothing renders.

## [0.9.2] - 2026-09-17

### Fixed

- Fit the opportunity workbench to laptop viewports. v0.9.1 fitted at 1600x950 and overflowed by
  211px at 1440x800. The containment chain was sound; the waste was in what it held: a 187px
  two-line marketing headline, a 50px full-width row for a secondary tool, a 161px brief head whose
  title wrapped because three columns shared about 190px, and a 338px salary band in an auto row
  that spilled out of a 124px rail. The requirement grid, which is the point of the screen, got
  82px. The rules were simulated against the live page before being written and give zero overflow
  with all twelve requirements visible at 1600x950, 1440x800 and 1366x768.

### Changed

- The target-portfolio composer opens as a modal from the toolbar rather than occupying a row of
  the working surface.
- Posting and Edit move from the brief head into the filter row, so the role title stays on one
  line.
- The workbench header is set at the display face's `xl` step with a single-line description. A
  workbench header states where you are; it does not sell the product.

## [0.9.1] - 2026-09-17

### Fixed

- Size the opportunity page to the viewport. It stacked a tall hero, an always-expanded portfolio
  composer, a toolbar and the working area, overflowing the viewport by 678px before a single
  requirement had been read. Measured in a browser at 1600x950. The header and toolbar are now
  intrinsic, the working area takes the remainder, and the only scrollable regions are the card list
  and the requirement grid.

### Changed

- Move the target-portfolio composer into a drawer, closed by default. It is a secondary tool and
  was occupying a third of the working surface on every visit.

## [0.9.0] - 2026-09-17

### Fixed

- Carry accomplishments through the profile interchange. The module is called "Lossless profile
  interchange" and dropped an entire entity: the accomplishment bank, which holds the STAR record
  behind every achievement bullet. Export and reimport silently emptied it, which is why the
  deployed workspace held eleven experiences, four education records and zero accomplishments.
  Schema moves to 1.1; 1.0 documents still import, since they simply carry no bank. The
  losslessness test asserted an exact counts dict and never created an accomplishment, so it stayed
  green while the data was discarded; it now round-trips one and checks its evidence is remapped.
- Apply the visual redesign, which shipped three releases ago and never rendered. `tokens.css`
  defined the warm paper canvas and the single ink-blue accent, but `styles.css` still declared the
  entire previous palette in its own `:root` block and is imported after it. At equal specificity
  the later file wins, so the deployed app kept its slate-navy canvas and neon teal accent. The one
  token `styles.css` did not redeclare, `--font-display`, came through, which is why headings turned
  serif while nothing else moved. `tokens.css` is now the only file permitted to declare a palette
  token, guarded by `frontend/src/theme.test.ts`.
- Move 60 literal colours in `styles.css` onto the theme tokens. Changing a token did nothing for
  declarations that named the previous hues directly: the primary button's neon teal-to-blue
  gradient, the violet avatar, every status tint, the login hero's hardcoded `#080d18` canvas. They
  kept rendering the old design whatever `tokens.css` said, which is most of why the redesign
  appeared not to have happened. `styles.css` now contains no literal colour at all.
- Put the graph palette on tokens. `Visualizations.tsx` carried its own full palette: node-type hues
  in the previous teal and violet, and graph surfaces hardcoded to a `#0e1421` navy. Its own comment
  instructed the reader to keep those values aligned with the stylesheet by hand, a sync that was
  never performed and became impossible once the palette moved. Every graph therefore rendered the
  old design on an old canvas whatever the theme said. A categorical `--viz-1` to `--viz-8` scale is
  now authored per theme in `tokens.css` and resolved at runtime, the way `EChart` already did it.
- Give the login hero its own tokens. It inverts the canvas by design, so once the palette actually
  applied, the light theme put near-black heading text on a hardcoded dark panel and the headline
  became unreadable.
- Remove `--muted: #4d5a४b` from the light palette. The hex contained a Devanagari digit, so the
  browser discarded the declaration and the token was never set.
- Resolve requirements against evidence with containment instead of token Jaccard similarity.
  Jaccard divides by the union of both token sets, so a short requirement label compared against a
  full profile record scored lower the richer that record was. "Engineering degree" peaked at 0.091
  against a genuine B.Sc. in Electronics Engineering and a Ph.D. in Electrical Engineering, under a
  0.40 threshold, and the workbench reported it unresolved. Every requirement expressed as a phrase
  rather than a single term was affected the same way, which is why coverage read as thin evidence
  rather than as a broken metric. Matching policy moves to `match-v1.1.0`.
- Treat abbreviated credentials as words. `normalize_label` keeps periods so that `node.js` and
  `.net` survive, which left `b.sc.` and `ph.d.` matching nothing.
- Drop filler terms before comparing. "experience in leadership" and "experience in cooking" shared
  half their tokens before a single meaningful term was compared.
- Search wider evidence when a requirement's category does not resolve it. Categories are assigned
  heuristically at extraction and are frequently wrong; a degree filed as a skill was searched only
  against the skill list and reported as a gap while the education record sat in the same workspace.
- Repin the PostgreSQL base-image guard, which still asserted package revisions superseded by the
  OpenSSL advisory updates, and record the release in README so the packaging contract holds.

### Added

- `careertwin rematch` recomputes every opportunity's alignment under the current matching
  policy. Runs are immutable and keyed by policy version and input digest, so a policy fix does
  not reinterpret stored runs: it needs new ones, and without this a deployed fix stays invisible
  until each opportunity is re-run by hand from the interface.

### Changed

- Replace the opportunity editor with a brief. The screen opened on a textarea of raw unrendered
  markdown followed by one editable row per requirement, each with an importance dropdown, a
  category dropdown, a text input and a weight spinner: forty-eight form controls for twelve
  requirements, and no statement anywhere about fit. The brief leads with coverage, requirements
  met, gaps and eligibility, shows the compensation band, and presents requirements as a filterable
  status grid that is sized to its container rather than a list that grows the page. Selecting one
  shows the evidence that answers it. The editor keeps every capability it had, behind Edit.
- Name the evidence in an assessment. "Resolved against confirmed profile evidence" became
  "Evidenced by B.Sc. in Electronics Engineering, Universidad de Concepcion".

## [0.8.2] - 2026-09-17

### Fixed

- Self-host Source Serif 4 and Inter. The Google Fonts stylesheet was refused in production by the
  Content-Security-Policy (font-src self), so neither family loaded and the serif display face did not
  render. Both are SIL OFL 1.1; the 14 latin woff2 files are now served from the application origin
  and the CSP is unchanged.

## [0.8.1] - 2026-09-17

### Fixed

- styles.css hard-coded a font stack on :root, overriding --font-ui, so the serif display face never
  applied anywhere.

## [0.8.0] - 2026-09-17

### Changed

- New visual direction: paper and ink instead of navy and neon. Warm #f7f5f2 canvas with ink-black
  text, light by default, Source Serif 4 for display, one restrained ink-blue accent replacing neon
  teal plus violet, tighter radii and a paper-weight shadow. The dark theme is warm charcoal, never
  navy, authored independently.
- Verbatim job postings replace the three-sentence summaries previously stored: 16,035 characters
  across the four cases, against 1,623 before. The salary benchmarks, fit assessments and case
  readmes are filed as sources, roughly 70,000 characters of research now reachable in the app.

## [0.7.1] - 2026-09-17

### Fixed

- Topbar clipped the account name at the viewport edge on every page. It carried a fixed 69px height
  sized for the old 9-11px type and could not contain the new scale; it now grows with its contents.
- Brand subtitle wrapped to two lines after moving from 9px to 13px.

## [0.7.0] - 2026-09-17

### Changed

- Redesign the live stylesheet rather than adding tokens beside it. New font stack with tabular
  figures, a lifted-slate canvas replacing near-black navy, one accent instead of two competing
  saturated hues, contrast raised so every text tier clears AA, and 193 pixel rules migrated onto the
  type scale with nothing rendering below 13px.
- EChart emits selection events, merges option updates so zoom and legend state survive a refresh,
  enables zoom on request, and exposes the canvas as figure or application instead of role=img.

### Added

- Compensation band on the match detail: floor, central range and target ask drawn as three marks,
  with basis, research date, note and source. Opportunity.compensation existed on the model and was
  rendered nowhere.

## [0.6.3] - 2026-09-17

### Fixed

- Career timeline: a bar narrower than its own date label rendered as clipped nonsense, showing "20"
  for a nine-month role and "2" for a five-month one. Spans under 9 percent of the timeline now place
  their dates beside the bar.

## [0.6.2] - 2026-09-17

### Fixed

- Repair `frontend/package-lock.json`, which a string-replace version bump had corrupted: `decimal.js`
  was rewritten to a 10.6.1 tarball that was never published and `@fasl-work/caos-app-shell` to a
  version whose integrity hash no longer matched, so `npm ci` 404d inside the image build and v0.6.1
  could not deploy. Version fields are now edited as JSON.

### Added

- `tests/test_lockfile_integrity.py`: only the two root keys may carry the project version,
  package.json and the lock must agree, and every resolved tarball URL must match its declared version.

## [0.6.1] - 2026-09-17

### Removed

- Force-directed constellation and the two-lane career river. Verified in a browser: the constellation
  drew 109 nodes and 198 links as an unreadable hairball with labels truncated mid-word, and the river
  drew two flat lanes with no label on any bar, collapsing eleven roles into one rectangle.

### Added

- Career timeline where every bar names its role, organisation and dates, sorted most recent first,
  expandable to achievements, filterable by experience or education.
- Competitive research in docs/design/competitive-and-visualization-research.md. No comparable tool
  ships a force-directed network; the category competes on actionable per-requirement gap analysis.

## [0.6.0] - 2026-09-17

### Added

- Design system in `src/tokens.css`, researched and documented in
  `docs/design/design-system.md`: type on a 16px base with a Major Third 1.25 ratio and 4pt baseline
  line heights, spacing on the 8pt grid, radius and elevation steps, semantic colour tokens, and
  independently authored dark and light palettes. Adds a visible focus ring to every interactive
  element, the most common dark-mode accessibility failure being an invisible focus indicator.
- Coverage workbench: requirement rows against opportunity columns with sticky header and first
  column, ranked bars sorted high to low, full-text search, status and importance filters, three sort
  modes and an evidence detail panel opened from any cell.

### Changed

- Raise 185 type rules off an 8px floor; nothing essential now renders below 14px.
- Contain the visualisation stages in the viewport instead of scrolling the shell.

### Removed

- Force-directed network and adjacency matrix as primary surfaces. Node position in a force layout
  carries no meaning, so both signalled "knowledge graph" while answering no question a candidate asks.

## [0.5.12] - 2026-09-17

### Fixed

- Bump every version declaration together. v0.5.11 shipped an image whose
  `careertwin.__version__` still read 0.5.10, so `/api/health/ready` reported the wrong version for
  the running release. `backend/careertwin/__init__.py`, `frontend/package-lock.json` and
  `extension/manifest.json` were missed by that bump.

### Added

- `tests/test_version_consistency.py` asserts that VERSION, the Python package, pyproject, both
  frontend manifests and the extension manifest all agree, that VERSION is bare semver, and that the
  changelog documents the current version. A partial bump now fails the test suite instead of
  reaching production.

## [0.5.11] - 2026-09-17

### Changed

- Refresh the Chainguard python and Wolfi base image digests and re-pin all 22 moved apk packages in
  the database image, including the OpenSSL rebuild from 3.6.4-r0 to 3.6.4-r7. The database Dockerfile
  pins exact package versions alongside the base digest, so a base refresh without a matching re-pin
  fails the build with "unable to select packages".
- Hold the accepted Python runtime line and ranged optional dependency majors in Dependabot, so
  upper-bound widening that is not classified as a semantic major cannot land unreviewed.

### Security

- Document CVE-2026-85091 in zlib as an open, unsuppressed finding. The installed
  1.3.2.1_rc20260601-r0 has no published fix in Wolfi and the Chainguard digest is already newest, so
  the repository policy forbids a VEX statement and openvex.json stays empty.

## [0.5.10] - 2026-08-31

### Fixed

- Prioritize decision-significant graph nodes for always-visible labels so small neighboring nodes
  cannot collide with opportunity titles; all node text remains available through hover, inspector,
  search, matrix, and table views.

## [0.5.9] - 2026-08-31

### Fixed

- Encode the graph-label ellipsis independently of source-file encoding and apply a tighter compact
  label budget plus collision grid, keeping mobile constellations legible without hiding exact text
  from hover, inspector, or table views.

## [0.5.8] - 2026-08-31

### Fixed

- Prevent long evidence labels from colliding across dense Sigma clusters by reserving more label
  space and bounding overview copy while preserving full text in hover, inspector and table paths.

## [0.5.7] - 2026-08-31

### Fixed

- Make Sigma node labels, relationship lines, filtering states, and hover labels readable in both
  workbench themes, including live canvas updates when the seeker changes theme.

## [0.5.6] - 2026-08-31

### Fixed

- Make Sigma network surfaces inherit the active workbench theme instead of showing the renderer's
  default white background inside dark profile and opportunity views.

## [0.5.5] - 2026-08-31

### Fixed

- Remount the locale provider at the anonymous-to-authenticated account boundary so the saved
  account language immediately replaces browser-detected anonymous copy after sign-in.

## [0.5.4] - 2026-08-31

### Fixed

- Make every skip-link destination programmatically focusable so activating the keyboard-only
  control transfers focus to the main landmark on boot, login, and authenticated workbench views.

## [0.5.3] - 2026-08-30

### Changed

- Refresh the pinned Node 24 builder, public shared workbench, React-query and graph packages,
  Python runtime libraries, and immutable GitHub Actions toolchain through reviewed dependency PRs.

### Fixed

- Keep the browser document exactly viewport-sized and assign long authenticated routes to one
  internal workbench scroller, including safe mobile bottom-navigation clearance.
- Replace the always-visible static skip link with a localized keyboard-only control backed by a real
  main landmark on boot, login, and authenticated surfaces.
- Pin the transitive Nano ID development dependency to its advisory-fixed release.

### Security

- Build PostgreSQL 17.11 and pgvector 0.8.6 from verified upstream sources on a pinned minimal Wolfi
  runtime, with fresh-cluster network readiness and collation-upgrade rehearsal gates.

## [0.5.2] - 2026-08-15

### Fixed

- Expose language and theme actions inside the account menu so phone-width users retain both
  preference controls when the compact header hides their duplicate top-bar icons.

## [0.5.1] - 2026-08-15

### Changed

- Refresh the pinned Python and frontend dependency contracts and the GitHub Actions toolchain.
- Rebuild the application and PostgreSQL containers from current immutable, vulnerability-scanned
  base images while preserving the PostgreSQL 17.10, pgvector 0.8.6, and collation contracts.

### Security

- Remove the remaining known high-severity base-image findings without weakening the non-root
  runtime, digest pinning, SBOM, secret scanning, or exact dependency gates.

## [0.5.0] - 2026-08-04

### Added

- Add an evidence-derived four-step dashboard journey from trusted profile through target role,
  match review, and next action, with responsive progress and direct work-surface links.
- Add deterministic bounded ForceAtlas2 relationship layouts, fit/reset and selected-neighborhood
  controls, and a shared inspector across network, adjacency-matrix, and table graph lenses.
- Add selectable ranked opportunity-landscape lenses, zoomable career-duration ranges, exact data
  tables, and lowest-supported-first match category explanations.

### Changed

- Make ECharts theme-reactive, reduced-motion aware, container-responsive, and ARIA/decal described;
  escape user-controlled career labels before building chart tooltips.
- Raise graph matrix targets to 26 CSS pixels, improve visualization text/contrast, strengthen focus
  indication and responsive layouts, and make the advertised `Ctrl/Command+K` shortcut functional.
- Extend automated accessibility from login to the authenticated shell and run color-contrast checks
  instead of disabling them.

### Fixed

- Correct corrupted Spanish conversation strings and provide complete Spanish copy for the new
  guidance, graph, and analytical controls.

## [0.4.1] - 2026-08-03

### Fixed

- Run the PostgreSQL 17.10 deployment image on digest-pinned Wolfi/glibc with exact package versions
  so a database cluster carrying glibc collation provenance can verify its recorded version instead
  of emitting a no-actual-collation-version warning on every connection under Alpine/musl.
  Production upgrades rebuild affected indexes and refresh the recorded version before normal
  service resumes, while the database runtime continues to pass the zero-high-vulnerability
  container gate.
- Align the pgvector runtime with the persistent cluster's 0.8.6 extension metadata so the release
  never places an older shared library beneath newer stored extension objects.

### Security

- Keep PostgreSQL and pgvector immutable-pinned while removing direct system-catalog suppression as
  an option: collation compatibility must be demonstrated by the runtime and an isolated backup
  restore before deployment.

## [0.4.0] - 2026-08-03

### Changed

- Render the authenticated workbench through the exact public
  `@fasl-work/caos-app-shell@0.5.0` `WorkbenchShell`, retaining CareerTwin's five seeker routes,
  responsive navigation, command search, locale/theme persistence, account controls, career copilot,
  architecture modal, security banner, and product-specific design tokens through typed slots.
- Adopt the shared package's React Router 6/7/8 core contract without downgrading CareerTwin Router 8
  or mixing incompatible DOM/core majors.

### Added

- ADR 0027 and a frontend integration test proving the real shared frame, active route, navigation and
  main landmarks, product controls, overlays, and authenticated content.

### Security

- Pin the public shell package exactly, keep npm audit at zero findings, and preserve all account,
  preference, chat, modal, and authorization state inside CareerTwin rather than the shared package.

## [0.3.1] - 2026-08-03

### Fixed

- Allow only the same-origin CareerTwin document to request explicit browser microphone permission,
  restoring the Grok Voice client while camera, geolocation, and cross-origin microphone delegation
  remain denied.

## [0.3.0] - 2026-08-03

### Added

- Native-first local lifecycle that creates repo-root `.venv`, installs the Python contract, verifies
  Node 24/npm 11, installs the frontend lockfile into `frontend/node_modules`, migrates SQLite, and
  starts API, database worker, and web without Docker.
- Credential-safe `scripts/career.*` harness for profile/opportunity graphs, source capture, evidence
  decisions, matching, recommendations, GitHub review, arbitrary bounded API calls, and durable chat.
- Typed opportunity knowledge graph connecting roles, employers, shared requirements, industry,
  seniority, location, work mode, and target portfolios.
- Searchable network, adjacency-matrix, table, facet, and inspector lenses shared by professional and
  opportunity graphs.
- External xAI document understanding and Grok Realtime Voice with server-minted ephemeral browser
  credentials; eight validated versioned repository skills.
- AST-based Spanish coverage gate for literal UI translation keys.

### Changed

- Make the repository, not the hosted web app, the product boundary. Docker is optional deployment
  packaging; SQLite is the native local profile and PostgreSQL the hosted multi-user profile.
- Replace Redis/ARQ with durable database row claiming and conservative interruption recovery.
- Replace local Ollama/Docling/embedding inference with explicitly configured managed xAI, OpenAI,
  Anthropic, or Google APIs. Deterministic parsers remain the no-provider fallback.
- Make xAI file processing transient with one-hour expiry safety and immediate deletion attempt.
- Expand EN/ES coverage across the control room, profile, opportunities, matches, pipeline, admin,
  connectors, agent states, graphs, and deterministic recommendations.

### Removed

- Ollama, Qwen, local embeddings, Docling/OCR gateway, Redis, ARQ, model images, model volumes, and
  every production readiness dependency on local inference.

### Fixed

- Keep optional PowerShell superuser arguments as a true array, so a single flag is never splatted
  into individual characters.
- Make native launchers collision-safe with explicit API/web ports and stable background processes,
  including automatic Vite proxy alignment in concurrent worktrees.
- Apply bounded provider request duration and output-token limits to every managed model call.
- Expose durable copilot history controls and close microphone, audio, and socket resources across
  drawer close, component teardown, permission cancellation, and voice transport failures.

### Security

- Preserve secrets in ignored/runtime-only storage, keep GitHub and harness tokens memory-only,
  retain fail-closed production malware scanning, and keep every model-derived write behind exact
  evidence criticism plus explicit user approval.

## [0.2.5] - 2026-08-03

### Fixed

- Synchronize the root release manifest, Python package/runtime metadata, frontend package,
  browser extension, documentation, tag, and deployment version.
- Add a regression contract that rejects drift between canonical version surfaces.

## [0.2.4] - 2026-08-03

### Fixed

- Create isolated restore-check databases from `template0` with PostgreSQL 17's built-in `C.UTF-8`
  locale provider so recovery does not depend on host glibc/musl collation-version metadata.
- Initialize fresh Compose database volumes with the same portable locale contract and document the
  honest handling of warnings from legacy libc-initialized volumes.

## [0.2.3] - 2026-08-02

### Fixed

- Make the public release journey honor numeric `Retry-After` responses and bounded exponential
  backoff for idempotent status polling without ever replaying a state-changing request.
- Use a proxy-safe normal poll cadence and retain the existing finite operation deadline.

## [0.2.2] - 2026-08-02

### Fixed

- Validate blob and connector AES-256 keys as canonical padded or unpadded URL-safe base64 during
  settings construction, before the application accepts traffic.
- Publish the validated encryption-key dependency in production readiness and document the exact
  32-byte key-generation contract.

## [0.2.1] - 2026-08-02

### Fixed

- Make PostgreSQL and encrypted-blob backup entrypoints compatible with the non-root, distroless
  application image by copying the volume through the Docker API and creating the private archive
  on the operator host.
- Constrain temporary blob-backup cleanup to a resolved staging directory under the ignored,
  owner-only backup root.

## [0.2.0] - 2026-08-02

### Added

- Encrypted tenant-namespaced document storage, private Docling conversion, queued extraction,
  visible retry state, versioned structured-output prompts, deterministic evidence criticism, and
  redacted tenant-scoped run traces.
- ESCO 1.2.1 and O*NET 30.3 concept/relation imports, local EmbeddingGemma vectors, hybrid search,
  HNSW indexing, persisted archive provenance, checksum-gated O*NET acquisition, and a pinned
  bilingual retrieval benchmark.
- Evidence-backed STAR accomplishments and immutable tailored résumé variants.
- Consent-bound Google and Microsoft OAuth connections for user-triggered calendar synchronization
  and read-only, bounded recruiting-email excerpts with finite retention.
- Revocable browser-capture credentials and a Manifest V3 extension for explicit, visible-page job
  capture without background crawling.
- Private Ollama and authenticated Docling services in the production Compose topology.

### Changed

- Make private Ollama `qwen2.5:0.5b-instruct-q4_K_M` the measured CPU-safe production baseline,
  with bounded context/output settings, while retaining typed optional xAI, OpenAI, Anthropic, and
  Google adapters.
- Extend the web workbench, APIs, worker lifecycle, repository skills, runbooks, and ADR catalog for
  document intelligence, career artifacts, connectors, and hybrid occupational retrieval.

### Security

- Reject deterministic mock/test providers in production and fail readiness when the configured real
  provider, model, scanner, converter, database, or queue is unavailable.
- Encrypt OAuth refresh tokens with purpose-bound authenticated data; never expose stored secrets to
  the browser, and request no mailbox write/send scope.
- Preserve exact-quotation evidence, protected-term, duplicate, tenant-isolation, expiry, and
  idempotency gates across extraction and connector workflows.
- Upgrade the pinned runtime to a non-root, distroless Python 3.14.6 image with a separate
  development-only builder after fixable-high image scans rejected the previous Python base.
- Replace vulnerable vendor database, model-server, and document-service images with scanned custom
  runtimes: PostgreSQL 17.10 plus pgvector 0.8.1, patched CPU-only Ollama 0.32.5, and a distroless
  Docling gateway that uses bounded English/Spanish Tesseract OCR without EasyOCR, OpenCV, or
  bundled FFmpeg.

## [0.1.0-alpha.4] - 2026-08-02

### Security

- Restrict POSIX private-backup directories to mode 0700 and generated SQL/blob files to mode 0600,
  including files copied from containers.
- Remove inherited Windows ACLs from private backups and grant access only to the current operator.

## [0.1.0-alpha.3] - 2026-08-02

### Added

- Lossless tenant-scoped CareerTwin profile/evidence interchange plus JSON Resume import/export.
- Immutable opportunity revision snapshots, named target portfolios, weighted portfolio alignment,
  and a repeated-gap recommendation matrix.
- Editable recommendation prerequisites, steps, status, effort and progress with direct agenda-task
  conversion.
- Candidate-owned contacts and bounded, UID-idempotent RFC 5545 calendar import.
- PostgreSQL-backed queued agent checkpoints with ARQ execution, polling, cancellation, retry lineage,
  safe terminal errors, and optional redacted Langfuse observations.
- Web controls for every new contract, a serious/critical automated accessibility gate, and the fixed
  10-seeker representative-volume test.
- A seventh versioned repository skill for application, contact, agenda and calendar operations.

### Changed

- Upgrade the Langfuse integration to its current v4 SDK surface and keep prompts, evidence bodies,
  outputs, account values and raw workspace identifiers outside observations.
- Extend workspace export, tenant RLS migration coverage, CI, operator scripts, API documentation,
  and deployment checks for the completion contracts.

### Security

- Validate every target-set, contact, task and durable-run relationship against the current tenant.
- Preserve request-memory-only GitHub tokens and environment-only provider/observability secrets.

## [0.1.0-alpha.2] - 2026-08-02

### Fixed

- Parse both JSON and comma-separated `ALLOWED_ORIGINS` before Pydantic Settings' complex-value
  decoder, normalize duplicates, and reject wildcard or path-bearing origins.

### Changed

- Pin every GitHub Action to an immutable reviewed revision and move supported actions to their
  current major release.
- Group routine Dependabot updates while requiring explicit migration work for major runtime and
  library changes.

## [0.1.0-alpha.1] - 2026-08-01

### Added

- Initial evidence-centered career profile, opportunity, matching, recommendation, pipeline,
  agent, administration and visualization platform.

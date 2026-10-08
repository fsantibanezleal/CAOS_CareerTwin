# Analytical navigation and responsive workbenches

## Explore a saved-role landscape

Open Opportunities, then Landscape. Skills, Seniority and Industries answer separate questions.
Counts describe only your saved roles, not the total labor market or the likelihood of an offer.
Search signals or raise Minimum saved roles to isolate repeated requirements. Every share is
`signal role count / all saved roles`, even after filtering, so filtering cannot inflate a share.

The chart ranks up to 18 signals. Its exact table contains every signal surviving the filters.
Expand Read this landscape as a table and scroll inside the analytical panel to reach the final row.
Use Table to replace the chart when you want a compact, complete reading view. Chart restores it.
Select a bar or underlined table signal to see the actual saved roles behind it. Select a role to
open its full requirement workbench. Clearing selection does not delete or modify a record.

## Inspect graph evidence

Graph search and entity-type filtering narrow visible entities. Network, Matrix and Table share
one metadata/typed-relationship inspector. Table has a bounded scroll region and sticky headings.
On stacked screens selecting an entity reveals its inspector below the graph. Close selection,
scroll back or switch lenses to regain orientation; Fit graph restores the camera.

## Work in constrained screens

The browser document stays fixed. Scroll the panel owning the content, not the image. Long tables,
evidence lists and modal forms are deliberately scrollable. On short-height screens or high browser
zoom the main workbench provides additional internal scrolling rather than collapsing the tool.
Phone navigation stays clear of content through bottom safe-area spacing. Profile tabs support
horizontal scrolling, while skill filters wrap within their own width.

Secondary editors focus a control when opened, keep Tab/Shift+Tab inside the dialog, close with
Escape and return focus to the launching control. Ctrl/Command+K opens the copilot at its message
field; Escape closes it. A closed copilot has no keyboard-focus targets. Missing managed-provider
credentials still disable live model operations; these layout improvements do not activate them.

## Run the rendered gate locally or against a release

Run the native app with `scripts/dev.ps1` or `scripts/dev.sh`. Populate a disposable synthetic
workspace with more than 18 distinct skill requirements, 12 roles sharing Python, career history,
matches and candidate tasks. Never use the owner's profile or publish private screenshots.
Supply `CAREERTWIN_GATE_BASE`, `CAREERTWIN_GATE_EMAIL`, `CAREERTWIN_GATE_PASSWORD` and
`CAREERTWIN_GATE_DISPOSABLE=1` as process environment variables. Then run
`node scripts/ui-ux-gate.mjs`. Optionally set `CAREERTWIN_GATE_PLAYWRIGHT` to an installed isolated
Playwright resolution anchor. Full acceptance covers desktop, phone, bilingual themes and narrow/
short viewports; `CAREERTWIN_GATE_QUICK=1` is a two-size diagnostic, not full release acceptance.
Screenshots and the result ledger go only to ignored `.run/ui-ux-gate/`.

This UI gate does not replace API tenant-isolation, backup/restore, security, matching semantics,
connector or real configured-provider gates. See the release-verification runbook.

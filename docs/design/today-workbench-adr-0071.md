# Today workbench against ADR-0071

Status: implemented in v0.14.0, 2026-09-18. Issues #187 and #203.

## The question this page answers

What needs attention today, and how does the search stand: which roles are worth pursuing, on
fit and on pay, and where each application is.

## Measured on v0.13.0

| | 1280x800 | 1600x900 | 2560x1440 |
|---|---|---|---|
| Page overflow | +587px | +461px | 0 |

At 1280x800 the height goes to a 136px headline and description, a 324px guided-workflow card,
148px of stat cards and 582px of panels.

What the page shows, against what the data holds:

- **The guided workflow is complete** for this workspace, four of four, and spends 324px saying so.
- **"Profile completeness 100%" measures five text fields**: headline, summary, location,
  seniority and availability are filled. It sits beside a skill map where 41 of 73 skills have no
  confirmed claim behind them.
- **"Next best moves" is an empty state.** It lists tasks only and none are recorded, while three
  open applications have waited one to three days in their stage with a legal next move each.
- **No role's fit or salary ask appears.** The two numbers a candidate weighs roles by are on the
  Opportunities and Pipeline pages only.
- **"Application flow" repeats the pipeline's stage counts** as a row of identical check icons.

## Decisions

1. **One bar**: Today, the date, and Export my data.
2. **Key figures in one row**: portfolio fit (coverage-weighted, as the dashboard computes it),
   roles in view, applications by stage drawn to scale in the stage colours, confirmed claims with
   what waits for review, and skills with confirmed evidence out of all skills. The five-field
   completeness is dropped from the headline figures.
3. **The instrument is a map of the roles by fit and pay.** Each role is placed at its fit on the
   horizontal axis; vertically it draws its salary ask as a range, the market's central range
   behind it and the floor as a tick. Its colour is its pipeline stage, grey when untracked, and it
   is labelled by employer. Roles at the same fit are set side by side rather than drawn over one
   another, and each label takes the first place beside, above or below its range that is clear of
   every range, floor tick and other label. Hovering names the role; selecting it shows, under
   the map, its title, stage and days in stage, fit with met requirements and gaps, and the
   compensation band, with links to the role and to its application.
4. **Needs attention, from recorded facts only**: open applications by days in their stage, each
   with its next legal move; tasks overdue or due in the next seven days; evidence proposals
   waiting for review; skills without confirmed evidence. Each item opens the place to act on it.
   Nothing is inferred about employers or chances.
5. **Recent activity**: the latest stage changes and tasks, dated, each opening its application.
6. **The guided workflow shows only while incomplete**, as a single row.
7. **Pipeline opens an application from a link** (`?application=`), as Opportunities opens a role
   from `?role=`.

## Gate

A Today phase in `scripts/workbench-gate.mjs` at the ADR-0071 sizes and both themes: no document
scroll, no control cut off the bar, no text under 12px; the key figures equal to the API; one
point per role with a match run, each placed at the API's fit and ask when read back through the
drawn axes; one attention item per open application; and selecting a point showing that role.

## Outcome

Verified on the built app against the live data before release, in both themes: zero page
overflow at 1280x800, 1600x900 and 2560x1440, from +587px and +461px. The map gets 326px of height
at 1280x800, 426px at 1600x900 and 966px at 2560x1440. The gate's Today phase adds 18 checks and
reads every role back through the drawn axes; the portfolio figure drawn one point high and every
ask range drawn 5% off each failed it.

### What the screenshots caught that the numbers did not

- Three roles within four points of fit crowded their labels: "Altia" sat across the neighbouring
  range and "Global66" ran past the chart. A side-choosing rule was not enough; labels are now
  placed against every mark, and the fit axis runs in five-point steps from just below the lowest
  fit, which spread the cluster from about 50px to about 80px at 1280.
- The salary strip, drawn for the brief's full width, spilled its basis out of the selected role's
  card at 1280; here its scale takes a second row.
- An attention item read "Move to screening" while clicking it opened the application, where the
  move is confirmed. It reads "Next: screening".
- The notes under the key figures were cut at 1280; the numbers take a step less width on narrow
  screens and the notes are shorter, with the full explanations as titles.

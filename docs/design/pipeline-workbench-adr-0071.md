# Pipeline workbench against ADR-0071

Status: implemented in v0.13.0, 2026-09-18. Issues #187 and #199.

## The questions this page answers

1. Where does each application stand, and how long has it been there?
2. What is the next legal move for each one, and who and what is attached to it?
3. Which applications are worth pushing: how well the profile fits, and what salary to ask?
4. What happened when, and what is coming up?

## Measured on v0.12.0

Page overflow is the height the document scrolls past the viewport; sideways is the board's
own horizontal overflow.

| Tab | 1280x800 | 1600x900 | 2560x1440 |
|---|---|---|---|
| Board | +309px, 1,183px sideways | +219px, 863px sideways | 0, 670px sideways |
| Agenda | +416px | +326px | 0 |
| Process signals | +51px | 0 | 0 |
| Connections | +543px | +429px | 0 |

Before any content: a 177px marketing headline and description, a 44px action row and a 46px
tab row, about 311px of an 800px screen.

What the page shows, against what the data holds:

- **The board is nine columns of at least 230px**, 2,070px before any content, so it scrolls
  sideways on every screen including 2560. Three of the nine are closed stages, empty for a live
  search. Each card stacks the full notes, up to 180 characters, so one card is taller than the
  screen's remaining height.
- **The cards carry neither of the numbers a candidate prioritises by.** Every tracked role has
  a match run and a researched salary band; the card shows the channel, the title and a date.
- **The stage history is recorded and never shown.** Every transition is appended to an
  immutable history with its date and note (`GET /api/pipeline/applications/{id}/history`); no
  view reads it. The board shows where an application is, never how it got there or for how long.
- **The funnel is decoration.** Each bar's width is `100 - index * 10`, set by the stage's
  position in the list, not by its count: an empty "offer" stage draws wider than a full
  "rejected" one would.
- **Forms name applications by identifier.** The task and contact forms list applications as
  "Application 1a2b3c4d".
- **The agenda is empty and says only that.** There are no tasks yet, while nine dated stage
  events sit in the history; a calendar of the search would not be empty.

## Decisions

1. **One bar**: the page name, the view switcher (Board, Calendar, People, Connections) and the
   one action every view shares, adding a task, replacing the headline, its description, the
   action row and the tab row. Calendar import and export belong to the calendar and sit there.
2. **Board becomes journeys plus a detail pane.**
   - A **stage strip** of the six active stages, each with its count, drawn from the data and
     acting as the filter: selecting a stage shows the applications currently in it. It replaces
     the decorative funnel and the "Process signals" tab.
   - One **journey row** per application: title, employer, fit and salary ask on the first line;
     below it a track across the six stages aligned to the strip, with a dot at each stage the
     application reached, the date it reached it, and the time spent in the current stage.
     Closed applications are behind a toggle and end their track with the terminal state.
   - Rows sort by furthest along, best fit, highest ask or longest waiting.
   - The same rows can be drawn along the calendar instead: one bar per stage as long as the
     time spent in it, under a date axis, with a line at now.
   - Selecting a row opens the **detail pane**: stage, channel, fit with met requirements and
     gaps, the compensation band, the next legal moves as actions with a confirmation step
     (closed stages are terminal), the stage history with dates and notes, the contacts and tasks
     attached to this application, the full notes, and a link to the role.
3. **Calendar replaces Agenda.** A month grid of the search: stage changes that happened, tasks,
   meetings and deadlines, each day showing its marks; selecting a day lists its items beside the
   grid, where open tasks can be completed. The grid navigates by month. Counts for the next 7
   and 30 days, unscheduled and overdue sit at the top of the day pane, which also lists what is
   coming up and the most recent activity, so a day with nothing recorded is not an empty pane.
4. **People replaces the contacts panel.** Contacts as a list and a detail: role, organisation,
   email, notes, the application they belong to and the tasks with them. Adding a contact is a
   dialog, not a form above the list.
5. **Connections** keeps its content, laid out in two columns inside the one scroll container,
   with the provider cards and the extension callout restacked for the half width.
6. **Task and contact creation move into dialogs**, name applications by role and employer,
   and can be opened from the detail pane already bound to that application.
7. **One request for the history.** A workspace-level `GET /api/pipeline/events` returns every
   stage event, so the journeys and the calendar do not issue one request per application.

## Gate

`scripts/workbench-gate.mjs` extended to Pipeline at the ADR-0071 sizes and both themes, per view:
no document scroll, no control cut off the bar, no text under 12px, no sideways overflow of the
journey rows; the strip's counts, each row's stage, fit and reached-stage count equal to the API;
the detail pane showing the selected application with its history length and compensation band;
the calendar's marks for the displayed month equal to the API's events and tasks in that month;
and the contact count equal to the API's.

## Outcome

Verified on the built app against the live data before release, every view and both board
modes, in both themes: zero page overflow at 1280x800, 1600x900 and 2560x1440, from +309px on
the board, +416px on the agenda and +543px on connections at 1280x800; the board's sideways
overflow is zero, from 1,183px. The gate's Pipeline phase adds 57 checks, and three deliberate
breaks in a build (a wrong strip count, every fit drawn one point high, calendar days that
dropped marks) each failed it.

The board also gained a second encoding of the same rows: along the calendar, one bar per stage
as long as the time spent in it, which shows the pace of the search and what has been waiting.

### What the screenshots caught that the numbers did not

- At 1280 the stage labels broke mid-word ("Preparin", "g"): the label now has the strip cell's
  whole first line, and the count and bar share the second.
- In a half-width column the connection cards, drawn for the full width, put each Connect
  button over the neighbouring card.
- A role saved at 09:00 yesterday read "today" at 02:00: days in a stage counted elapsed 24-hour
  periods rather than calendar days crossed.
- The date axis sat directly under the stage boxes and read as their labels; it now has its own
  rule and margins shared with the tracks.
- Twenty-six Spanish strings from earlier releases had no accents, and two were different words:
  "Anos" for "Años" (#200). A test now fails on any such form.

The gate now checks each of these that a measurement can express: labels inside their rows,
axis labels apart, cards' content inside the card, and every figure read from what is drawn
rather than from data attributes.

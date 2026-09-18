# Profile workbench against ADR-0071

Status: implemented in v0.12.0, 2026-09-18. Issue #187.

## The question this page answers

Who is this professional, how deep is each capability, and which claims are backed by evidence.
The page is read far more often than it is edited, and it opened as an edit form.

## Measured on v0.11.0 at 1280x800

Every tab overflows the viewport, under a 266px header and tab row:

| Tab | Overflow | Where the height goes |
|---|---|---|
| Overview | 4,740px | identity edit form 549, skill cards 2,847, experience and education edit forms 1,379 |
| Evidence | 1,140px | claim inbox 1,536 |
| Career river | 4,914px | career timeline 1,125, evidence matrix 4,168 |
| Artifacts | 4,184px | seven STAR stories fully expanded 3,392, resume versions 801 |
| GitHub | 119px | nearly fits |

Two findings shape the design more than the heights do:

- **One dataset is drawn twice.** The 73 skills appear as capability cards on Overview and again
  as the 73-row evidence matrix on Career river.
- **The drawn dimension carries almost no information.** Every card leads with a level pie, and
  the levels sit between 90 and 98 for nearly every skill. The dimensions that differ, years of
  use (2 to 17) and whether a claim backs the skill (36 links across 73 skills, issue #189), are
  small grey text.

## Decisions

1. **One bar** with the profile's name for the page, the tab switcher and the actions, replacing
   a headline that wrapped to three lines at 39px, its description and the tab row.
2. **Overview is read, not edited.** Identity renders as text: headline, narrative, location,
   seniority, years, availability. Edit opens the existing editor in a dialog.
3. **One skill map replaces both the capability cards and the evidence matrix.** Skills grouped
   by category and flowed into columns, each a compact row carrying the name, a bar for years of
   use, and an evidence mark that is filled when a confirmed claim backs the skill and hollow when
   none does. Filters for category and for unevidenced skills make the evidence gap visible
   rather than a line of grey text on each card. Selecting a skill shows its level, confidence,
   years and the claims behind it. The skill map is the one container on the tab allowed to
   scroll, and only if the column flow cannot hold every skill (ADR-0071 section 1).
4. **Career keeps the timeline, compacted,** and the experience and education editors move
   behind an Edit action. The evidence matrix is removed; the skill map carries its content.
5. **Artifacts becomes list and detail.** The seven STAR stories are a list of titles with their
   headline result; the selected story shows situation, task, action, result, metrics and
   evidence. Resume versions and portability are their own sections, not stacked below.
6. **Evidence** keeps the review workflow as list and detail, sized to the viewport.

## Gate

`scripts/workbench-gate.mjs` extended to Profile at the ADR-0071 sizes and both themes, per tab:
no document scroll, no control cut off the bar, no text under 12px, and the skill map's counts
(total, unevidenced) equal to the API's.

## Outcome

Verified on the built app against the live data before release, every tab and artifact
sub-tab, both themes: zero page overflow at 1280x800, 1600x900 and 2560x1440, from 4,740px on
the overview. The skill map shows all 73 skills with 41 unbacked, equal to the API, and every
row visible without sideways overflow; it scrolls vertically inside itself at 1280x800 only.

### What the screenshots caught that the first gate did not

- Balanced columns in a height-constrained box overflow sideways: eight of eleven categories
  were off-screen while every row existed in the DOM, so a row count passed.
- One unbreakable identity fact widened its grid column past the card, and every fact inherited
  that width, because grid items default to `min-width: auto`.
- Recent short roles put their date labels to the right of the bar, straight into the
  achievement count; and a 9% threshold was about 58px at 1280, too narrow for "2022-2024".

The gate now checks each of these directly.

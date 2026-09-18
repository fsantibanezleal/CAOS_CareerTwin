# Opportunity workbench against ADR-0071

Status: implemented in v0.10.0, 2026-09-17. Issue #178.

ADR-0071 (sized containers, no incidental scrolling) is the binding floor. It is verified at
**1280x800, 1600x900 and 2560x1440 in both themes**, by measurement.

## What the measurements show

v0.9.2 fits the document to the viewport at every size, which satisfies ADR-0071 §1. It does not
satisfy §6 or the spirit of §8, and the reason is chrome, not the requirement count.

At 1440x800, before the first requirement is drawn, the screen spends:

| Element | Height |
|---|---|
| topbar | 56 |
| page header (eyebrow, serif headline, description) | 90 |
| toolbar | 46 |
| brief head | 89 |
| salary band | 84 minimum as a strip, 338 as a rail |
| status filters | 30 |
| gaps and padding | ~70 |

About 400px of chrome on an 800px screen. The requirement grid gets the remainder, which is why
an 18-requirement role cannot be shown whole at 1366x768 however the chips are arranged: it
needs about 376px and gets about 253px.

v0.9.2 also made the salary rail scroll inside itself to stop it spilling. §6 names that as a
failure: a panel whose content does not fit is split, not scrolled.

## Decisions

1. **No page header on the workbench route.** The title joins the toolbar row. ADR-0071 §2: a
   workbench is not prose. Saves one row of about 100px.
2. **The opportunity list becomes a comparison list, not a card gallery.** Each row carries the
   role, employer, requirement coverage and the salary ask, so choosing a role is also comparing
   them. Cards were 211px tall and said none of this.
3. **Salary is a single dense strip** under the brief head: floor, central range, ask, the band, and
   the basis. The research note and source are available on hover and in the posting view, not
   stacked in the layout. No scrolling rail.
4. **Requirements are split by importance into columns** (Required, Eligibility, Preferred), per
   §6. This spends width, which the screen has, instead of height, which it does not. The largest
   column in the current data is eight, against eighteen as a single list.
5. **The selected requirement opens as an overlay**, not a permanent column.

## Gate

[`scripts/workbench-gate.mjs`](../../scripts/workbench-gate.mjs), at the ADR-0071 sizes and in both
themes, across every saved role rather than the first one:

- `document.scrollHeight == innerHeight` and no horizontal overflow
- every requirement of every role visible without scrolling its container
- no requirement label clipped
- no text below 12px

## Outcome

Verified on the built app against the live data before release, every saved role, both themes:

| Size | Page overflow | Requirements cut off | Labels clipped | Brief share of screen |
|---|---|---|---|---|
| 1280x800 | 0 | 0 | 0 | 47% |
| 1600x900 | 0 | 0 | 0 | 53% |
| 2560x1440 | 0 | 0 | 0 | 68% |

The fit shown in the list and the brief equals the stored score on first paint for all four roles
(99, 99, 96 and 82).

### Where it still falls short

- **Section 8 at 1280x800.** The brief is 47% of the screen, under the 50% floor. The largest
  single consumer at that size is the application's 238px navigation rail, which belongs to the
  shared shell rather than this page. Collapsing it to icons below about 1366px would clear the
  floor, and is a shell decision for every page, not a local one.
  *Resolved in v0.14.1 (#188):* between 901px and 1366px the rail is a 72px column of icons whose
  labels appear on hover and keyboard focus. The brief is 58% of the screen at 1280x800, and the
  gate now fails any brief under 50%; it did, at 48%, on a build without the rail.
- **Evidence on met requirements.** Several requirements resolve as met against a profile skill
  that carries no linked confirmed claim, so the detail reads "Evidence 0" beside "Met". The
  profile holds 73 skills and 36 skill-to-claim links. The match is sound; the audit trail behind
  it is incomplete.

### What the gate learned

The first version of the gate passed while the screenshots showed a clipped button, grey
uppercase requirements, and a role reading "0/18 met" during a load. It measured document
overflow, which `.shell-main` clipping made blind to controls pushed off the bar, and it never
read the numbers it was guarding. It now checks every bar control's edge, every chip against the
brief's visible box, label transforms, and the displayed fit against the API.

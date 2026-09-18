# Opportunity workbench against ADR-0071

Status: implementing, 2026-09-17. Issue #178.

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

`E:/_Temp/ct-verify/verify.mjs` extended to the ADR-0071 sizes and both themes, across every
saved role rather than the first one:

- `document.scrollHeight == innerHeight` and no horizontal overflow
- every requirement of every role visible without scrolling its container
- no requirement label clipped
- no text below 12px

# Matches workbench against ADR-0071

Status: implemented in v0.11.0, 2026-09-18. Issue #187.

## The question this page answers

The opportunity brief answers "is this role a fit". Matches answers the cross-role questions:
which role fits best, which requirements recur across my targets, and where am I weak in more
than one of them. Everything on the page should serve those, and the per-role deep dive belongs
to the role, not to this surface.

## Measured on v0.10.1 at 1280x800

The page overflows by 2,365px.

| Element | Height |
|---|---|
| page header (serif headline, description) | 177 |
| target portfolio panel (an empty selector when no portfolio exists) | 181 |
| ranking, as a separate block | 250 |
| filter toolbar, wrapping onto several lines | 150 |
| requirement matrix, 29 rows at 55px | 1,566 |
| saved roles index | 564 |

The 29 requirements split by importance into Required 11, Eligibility 5 and Preferred 13. The
roles that fail to match on something are few: in the current data, seven requirement cells
are partial or missing, across two roles.

## Decisions

1. **The ranking becomes the matrix's column headers.** The columns are the roles; each header
   carries the role, its fit and a fit bar, in best-fit-first order. One instrument instead of a
   ranking block above a table that repeats the same roles.
2. **Requirements are split by importance into tabs** (ADR-0071 section 6). The largest group,
   13 rows, fits at 1280x800; the full 29 do not, and "All" is offered as the one view that may
   scroll inside its own container.
3. **The default view is the gaps.** When any requirement is not met in some role, the matrix
   opens filtered to those, because that is the actionable view. With no gaps it opens on
   everything.
4. **One bar** replaces the headline, the description and the wrapping toolbar.
5. **The portfolio panel appears only when a portfolio exists.** An empty selector on every
   visit spent 181px teaching nothing; portfolios are created from the opportunity page.
6. **The per-role detail opens in a drawer** from a column header, keeping the alignment shape,
   the improvement actions and "track this role". The saved-roles index, which duplicated the
   column headers, is removed.

## Gate

`scripts/workbench-gate.mjs` extended to Matches at the ADR-0071 sizes and both themes: no
document scroll, no control cut off the bar, every visible row inside the matrix box for the
tabs that must fit, and each column header's fit equal to the stored score.

## Outcome

Verified on the built app against the live data before release, both themes, with the gap
view on and off:

| Size | Page overflow | Required, Eligibility, Preferred tabs | All tab |
|---|---|---|---|
| 1280x800 | 0 | fit their box | scrolls 460px inside the matrix |
| 1600x900 | 0 | fit their box | scrolls 360px inside the matrix |
| 2560x1440 | 0 | fit their box | fits |

The header row equals the API's fits in best-fit order at every size: Global66 99%, Altia 99%,
Empresa Confidencial 96%, Ultranav 82%. The gap view opens on six requirements.

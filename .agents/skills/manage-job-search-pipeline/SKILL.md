---
name: manage-job-search-pipeline
description: Organize one CareerTwin seeker's applications, legal stage transitions, contacts, tasks, meetings, deadlines, reminders, calendar exchange, and personal process analytics. Use when tracking a saved role after matching, planning follow-ups, recording recruiter or networking context, importing or exporting iCalendar events, or reviewing candidate-owned search progress. Never apply, send outreach, or infer employer outcomes.
---

# Manage Job Search Pipeline

Skill contract version: 2.0.0.

## Outcome

Keep a truthful, candidate-owned operating timeline for saved opportunities, people, meetings, deadlines, and next actions without automating employer-facing behavior.

## Workflow

1. Read `Entry_point.md`, then `references/pipeline-contract.md`.
2. Inspect current applications, legal next stages, tasks, contacts, opportunity titles, and analytics denominators with `scripts/career.* get` before changing anything.
3. Create an application record only after the seeker chooses to track a saved opportunity. Preserve its channel and notes.
4. Move stages only through server-advertised legal transitions. Record the seeker's factual note; never manufacture an interview, offer, rejection, or submission.
5. Add contacts with the minimum useful context. Link a contact to an application only when the relationship is explicit.
6. Add meetings, deadlines, reminders, and tasks with timezone-aware dates through the web UI or a bounded ignored JSON body passed to `scripts/career.* request`. Link compatible contacts and applications when known.
7. For calendar exchange, preview event counts and use RFC 5545 import/export. Treat UID-based skips as idempotency, not an error.
8. If the seeker explicitly connects Google or Microsoft, verify the requested OAuth service and scopes before a user-triggered calendar or email synchronization. Read-only email context may create a private follow-up task but never send, draft, or alter mailbox content.
9. Summarize overdue/open work and personal process analytics with their denominator and small-sample warning.

## Guardrails

- Operate only inside the current authenticated seeker's workspace.
- Never submit an application, fill an employer form, message a contact, or schedule an external meeting.
- Do not store email bodies, OAuth codes/tokens, browser credentials, private calendar feeds, or exported `.ics` files in Git. Disconnect and provider-side revocation are separate operations.
- Do not interpret stage counts or time-to-close as hiring probability or a labor-market benchmark.
- Confirm destructive contact/application decisions and preserve immutable stage history.
- Use the web UI when the seeker needs to review dates, people, and stages together.

## Completion

Report the application and stage changes, contacts linked, tasks/events created or skipped, upcoming deadlines, and the exact denominator behind any process signal. Call out dates or ownership that still need confirmation.

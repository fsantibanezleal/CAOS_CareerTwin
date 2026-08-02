---
name: review-github-portfolio
description: Review selected GitHub repositories as bounded professional evidence in CareerTwin. Use when a seeker explicitly supplies a fine-grained read-only token and wants repository metadata, languages, releases, ownership, forks, or archived state staged as reviewable claims. Never persist, echo, log, or commit the token, and never equate repository signals with mastery.
---

# Review GitHub Portfolio

Skill contract version: 1.0.0.

## Outcome

Create a private, bounded snapshot of repositories the seeker controls or chooses, then stage conservative claims for human review.

## Token boundary

Ask for a fine-grained, read-only GitHub personal access token only when executing the live connector. Send it once in the HTTPS POST body to the seeker's CareerTwin instance. Do not place it in a URL, command history, environment file, issue, chat transcript, log, fixture, or repository. The server uses it in memory and persists only the returned portfolio snapshot.

## Workflow

1. Read `Entry_point.md` and `references/github-contract.md`.
2. Agree on an allowlist of at most 50 `owner/repository` values, or explicitly use the bounded recent-repository default.
3. Run the snapshot endpoint once. If the connector fails, report only the sanitized error; never retry with broader scopes automatically.
4. Review ownership, fork, archive, language, release, description, and update signals.
5. Present every proposed claim as a proposal. The seeker confirms or rejects it in the evidence inbox.
6. Link only confirmed claims to curated skills. Explain the difference between language bytes, repository activity, a shipped release, and demonstrated expertise.

## Guardrails

- Do not inspect private organizations or repositories beyond the selected scope.
- Exclude or flag forks, mirrors, generated code, vendored code, tutorials, templates, and archived repositories before making capability claims.
- Never rank the person, infer seniority, or create a global "GitHub score" from stars, commits, or language percentages.
- Preserve repository URLs and snapshot metadata as evidence provenance.

## Completion

Report the GitHub login, repository count, proposed claim count, exclusions/flags, and the fact that the token was not persisted.

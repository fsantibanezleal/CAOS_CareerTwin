# Repository skills

CareerTwin ships seven focused agent skills under `.agents/skills/`, the official repository scope auto-discovered by Codex when it is launched anywhere inside this Git repository. Each skill contains a concise `SKILL.md`, UI metadata, and a one-level contract reference. The machine-readable version registry is `.agents/skills/versions.json`.

## Use in Codex

1. Clone the public repository and launch Codex with the working directory at the repository root or a descendant.
2. Inspect discovered skills with `/skills` in Codex CLI or the IDE extension.
3. Invoke explicitly with `$manage-career-profile`, `$ingest-job-opportunity`, `$review-github-portfolio`, `$analyze-career-match`, `$improve-career-readiness`, `$manage-job-search-pipeline`, or `$operate-career-twin` followed by the task.
4. Codex may also select a skill implicitly when the request matches its frontmatter description. If a just-pulled skill does not appear, restart Codex.

No copy into a user profile is required. Codex also supports symlinked skill folders, but repository contributors should use the checked-in `.agents/skills` source so workflow changes are reviewable with code. See OpenAI's current [Build skills documentation](https://learn.chatgpt.com/docs/build-skills.md).

## Safe operating boundary

The skills orchestrate the local code, documented API, or private web app; they do not embed credentials or personal content. Start the app with the local-development runbook before asking a skill to perform live API operations. Authenticate through the app, keep CSRF/session handling intact, and never paste a provider or GitHub token into a commit, issue, transcript intended for publication, or skill file.

The GitHub skill uses a fine-grained read-only token for one bounded request and relies on the app's request-memory-only connector. The operator skill requires explicit care around migrations, account creation, deployment, backup, restore and secrets. Profile imports replace only the authenticated seeker's profile domain; inspect the archive and target account before importing.

## Versioning and validation

Update a skill contract with semantic versioning in both its `SKILL.md` and `versions.json`. Validate every skill folder with the current `skill-creator` validator. Application and skill API contracts must move together in one reviewed pull request; a skill must not claim an endpoint or safety behavior that the release does not implement.

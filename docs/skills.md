# Repository skills

CareerTwin ships eight focused agent skills under `.agents/skills/`, the repository scope auto-discovered by Codex when it is launched inside this Git repository. Each skill contains a concise `SKILL.md`, UI metadata, and a one-level contract reference. The machine-readable version registry is `.agents/skills/versions.json`.

## Use in Codex

1. Clone the public repository and launch Codex with the working directory at the repository root or a descendant.
2. Inspect discovered skills with `/skills` in Codex CLI or the IDE extension.
3. Invoke explicitly with `$manage-career-profile`, `$ingest-job-opportunity`, `$review-github-portfolio`, `$analyze-career-match`, `$improve-career-readiness`, `$manage-job-search-pipeline`, `$use-career-copilot`, or `$operate-career-twin` followed by the task.
4. Codex may also select a skill implicitly when the request matches its frontmatter description. If a just-pulled skill does not appear, restart Codex.

No copy into a user profile is required. Codex also supports symlinked skill folders, but repository contributors should use the checked-in `.agents/skills` source so workflow changes are reviewable with code. See OpenAI's current [Build skills documentation](https://learn.chatgpt.com/docs/build-skills.md).

## Safe operating boundary

The skills orchestrate the local code and documented API through `scripts/career.ps1`/`.sh`; the web app is optional for visual review. Start the native API, database worker, and web client with the local-development runbook. The harness prompts for the password without echo, retains cookie/CSRF state only in memory, and accepts only relative `/api/...` paths. It never accepts a password argument.

Core native commands include `profile-upload`, `profile-graph`, `opportunity-url`, `opportunity-file`, `opportunity-graph`, `match`, `recommend`, `github-review`, and `chat`. `get`, `request`, and `upload` provide bounded access to the remaining documented API contracts. Put personal JSON payloads only in ignored temporary paths.

The GitHub skill obtains a fine-grained read-only token through a hidden prompt for one bounded request. The copilot skill refuses an unconfigured external provider and directs Grok Voice to the authenticated browser surface because an ephemeral credential must not be printed by the harness. The operator skill covers migrations, account creation, deployment, backup, restore, and secrets. Profile imports replace only the authenticated seeker's profile domain.

## Versioning and validation

Update a skill contract with semantic versioning in both its `SKILL.md` and `versions.json`. Validate every skill folder with the current `skill-creator` validator. Application and skill API contracts must move together in one reviewed pull request; a skill must not claim an endpoint or safety behavior that the release does not implement.

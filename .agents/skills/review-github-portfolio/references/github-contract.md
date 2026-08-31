# GitHub connector contract

Preferred native command:

```powershell
scripts/career.ps1 github-review --repository owner/repository
```

The harness asks for the token without echo and keeps it in process memory only. Repeat `--repository` for an allowlist.

Call `POST /api/connectors/github/snapshot` with:

```json
{
  "token": "fine-grained-read-only-token",
  "repositories": ["owner/repository"]
}
```

The response contains `login`, bounded repository records, rate-limit metadata, and proposed claims. The token is intentionally absent. The endpoint persists source snapshots and proposed claims in the current tenant only.

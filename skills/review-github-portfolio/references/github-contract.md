# GitHub connector contract

Call `POST /api/connectors/github/snapshot` with:

```json
{
  "token": "fine-grained-read-only-token",
  "repositories": ["owner/repository"]
}
```

The response contains `login`, bounded repository records, rate-limit metadata, and proposed claims. The token is intentionally absent. The endpoint persists source snapshots and proposed claims in the current tenant only.

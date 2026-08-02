# Occupational taxonomy operations

## Acquire and import

Download ESCO 1.2.1 CSV archives directly from the official ESCO portal. Its privacy/email acceptance
step is intentionally human-operated. Fetch the current pinned O*NET archive with
`scripts/fetch-onet.ps1` or `scripts/fetch-onet.sh`. Dataset archives are operator artifacts: keep
them outside Git. The CLI records the source URL, SHA-256, release, language, counts, and import time
in `taxonomy_imports`; `/api/taxonomy/status` exposes that provenance without private content.

```powershell
careertwin import-esco --archive D:\private\esco-en.zip --language en --replace --replace-relations
careertwin import-esco --archive D:\private\esco-es.zip --language es --replace --replace-relations
careertwin import-onet --archive D:\private\db_30_3_text.zip --release 30.3 --replace
careertwin embed-taxonomy --taxonomy ESCO --release 1.2.1 --language en
careertwin embed-taxonomy --taxonomy ESCO --release 1.2.1 --language es
```

Use the equivalent paths inside the app container for Compose/VPS operation. Imports are idempotent,
release-labelled, and preserve graph-edge provenance. O*NET is enrichment only; its attribution and
redistribution terms remain the operator's responsibility.

The exact official sources, measured O*NET digest, attribution, and release-change gate are in
[`../research/taxonomy-provenance.md`](../research/taxonomy-provenance.md).

## Benchmark and acceptance

Run `python benchmarks/taxonomy_retrieval.py` with the production database and private Ollama service.
Keep the generated result in the release evidence, not as an invented static score. Acceptance needs:

- all 20 pinned English/Spanish cases executed;
- hybrid MRR and recall not below lexical baselines;
- p95 latency within the benchmark threshold;
- exact embedding model and installed digest recorded;
- `/api/taxonomy/status` counts consistent with imported releases.

When semantic inference is unavailable, the API intentionally falls back to lexical plus graph search.
That fallback is degraded retrieval, not a reason to fabricate embeddings or taxonomy links.

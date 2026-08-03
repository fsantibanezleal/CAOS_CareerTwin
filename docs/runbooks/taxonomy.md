# Occupational taxonomy operations

## Acquire and import

Download ESCO 1.2.1 CSV archives directly from the official portal; its acceptance step remains
human-operated. Fetch the pinned O*NET archive with `scripts/fetch-onet.*`. Keep archives outside Git.

```powershell
./.venv/Scripts/careertwin import-esco --archive D:\private\esco-en.zip --language en --replace --replace-relations
./.venv/Scripts/careertwin import-esco --archive D:\private\esco-es.zip --language es --replace --replace-relations
./.venv/Scripts/careertwin import-onet --archive D:\private\db_30_3_text.zip --release 30.3 --replace
```

The CLI records source URL, SHA-256, release, language, counts, and import time. Imports are
idempotent and graph-edge provenance is retained. O*NET is English/US-specific enrichment; operators
remain responsible for attribution and redistribution terms.

## Retrieval and benchmark

CareerTwin provides lexical and lexical-plus-graph-degree retrieval. The legacy `hybrid` API name is
a wire-compatible alias of `lexical_graph`; it does not start or call a local embedding model.

Run the pinned bilingual benchmark against the imported database:

```powershell
./.venv/Scripts/python.exe benchmarks/taxonomy_retrieval.py --output data/private/taxonomy-benchmark.json --require-nondegradation
```

Acceptance requires every case, lexical/graph MRR and recall, p95 latency, imported release/count
consistency, and no graph-weighting degradation. A future external embedding adapter requires its own
ADR and multilingual privacy/cost/retention/quality benchmark before it may influence ranking.

See [`taxonomy-provenance.md`](../research/taxonomy-provenance.md) for official sources, checksums,
attribution, and release-change gates.

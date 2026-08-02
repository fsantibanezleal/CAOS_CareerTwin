# Occupational taxonomy provenance

CareerTwin normalizes profile evidence and job requirements against operator-imported, immutable
taxonomy snapshots. It never sends private profile or job text to a public taxonomy service.

## ESCO 1.2.1

- Authority: European Commission, Directorate-General for Employment, Social Affairs and Inclusion.
- Release: ESCO 1.2.1, last updated 10 December 2025.
- Official access: <https://esco.ec.europa.eu/en/use-esco/download>.
- Formats: CSV, JSON-LD, ODS, RDF, TTL, and XML; CareerTwin consumes the language-specific CSV ZIP.
- Languages loaded by the reference configuration: English and Spanish.
- Acquisition constraint: the official download workflow requires the operator to accept its privacy
  statement and provide an email address. CareerTwin deliberately does not automate or bypass that
  consent step. Store the resulting archives under `data/private/` or another non-Git private path.

The import command computes the archive SHA-256, persists it with the source URL, release, language,
concept count, relation count, and timestamp, and exposes only that non-personal provenance through
`GET /api/taxonomy/status`.

## O*NET 30.3

- Authority: U.S. Department of Labor, Employment and Training Administration.
- Release: O*NET 30.3, May 2026.
- Official text archive:
  <https://www.onetcenter.org/dl_files/database/db_30_3_text.zip>.
- Verified archive size: 13,222,549 bytes.
- Verified SHA-256: `7758ec966fd91895b3d290b83c9f1f1d46730d37fdda4faac67104d1c0d2a780`.
- License: O*NET 30.3 Database content is CC BY 4.0; O*NET is a USDOL/ETA trademark.

The pinned fetch scripts download only from the official HTTPS origin and fail closed if the digest
changes. O*NET data is US-specific enrichment: ESCO remains the bilingual portable normalization
surface and CareerTwin never presents an O*NET mapping as a universal occupation truth.

```powershell
scripts\fetch-onet.ps1
careertwin import-onet --archive data/private/taxonomies/db_30_3_text.zip --release 30.3 --replace
```

```sh
./scripts/fetch-onet.sh
careertwin import-onet --archive data/private/taxonomies/db_30_3_text.zip --release 30.3 --replace
```

## Release rule

A taxonomy release change requires a new ADR/release note, importer fixture, official-source check,
archive checksum, clean-database import, retrieval benchmark, and explicit re-embedding. Runtime code
must never silently download or replace the taxonomy.

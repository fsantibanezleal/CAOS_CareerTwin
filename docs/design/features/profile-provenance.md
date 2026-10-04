# Profile provenance repair contract

Authorized scope: populate the seeker's private profile from their existing evidence, preserve prior
curation, and correct metadata-only imports. Technical review before code: 2026-10-03.

P-001 THE source reader SHALL require authentication and the same workspace, return plain text only,
and fail explicitly for missing/unready content. Gate: test_profile_source_text_is_tenant_owned.

P-002 THE source list SHALL distinguish attached extracted text from metadata-only evidence; the UI
SHALL make available text inspectable without revealing private storage paths.
Gate: backend schema and rendered source controls.

P-003 WHEN enriching the actual seeker, THE operator SHALL create a verified encrypted off-host
recovery set first, preserve existing profiles/skills/jobs, verify hashes before attaching originals,
and keep every private payload outside Git. No expertise, external verification or outcome is inferred.
Gate: private operator record and aggregate counts, not personal material in public docs.

P-004 THE operator SHALL distinguish current from historical counts, incomplete credentials from
completed degrees, personal products from employer assets, and unresolved conflicting dates.
Missing originals or precise locators remain explicit review work rather than fabricated evidence.

Design: the existing Source holds tenant-owned extracted text and an encrypted blob reference. Read
the text by source ID with workspace constraints, never an arbitrary storage key. The source metadata
reports text availability as an independent field, not a synonym for processing status. Existing
confirmed claims are preserved; attached documents do not silently approve new claims.

Release state: native tenant/text contract passes. Owner-authorized private reconciliation ran after
a restored, encrypted, off-host hash-verified recovery set. Originals matched existing immutable
hashes; blobs passed malware scanning, encrypted-header and read-back checks. Existing skills,
education, opportunities, applications and claim counts were preserved. Source-level locators remain
explicitly less precise than exact quoted spans. Rendered controls and final code deployment remain
release gates, not implied by the data reconciliation.

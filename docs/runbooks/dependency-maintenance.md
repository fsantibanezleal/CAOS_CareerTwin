# Dependency maintenance

CareerTwin separates routine updates from migrations so an automated green check cannot silently
change the production support boundary.

## Routine weekly queue

Dependabot groups minor and patch updates per ecosystem and limits each queue to two pull requests.
For each group, inspect upstream release notes, the lockfile and dependency review; then run the full
repository test script. Container changes additionally require the image build, high/critical Trivy
gate, SBOM generation, and a deployment smoke test.

GitHub Actions use full commit SHAs. Keep the version comment beside each SHA, verify the commit is
the upstream release tag, and review permission or runner changes before accepting an update.

## Major migrations

Open a focused issue before changing a semantic major or production runtime line. Record:

1. upstream breaking changes and security/support motivation;
2. affected API, worker, persistence, build, and operational contracts;
3. migration and rollback strategy;
4. regression, integration, container, and live acceptance evidence; and
5. the ADR or support-matrix change when architecture or runtime policy moves.

Node production builds stay on an LTS line. Python production images stay on the accepted line until
all native wheels, ingestion extras, providers, migrations, backup/restore, and image scans pass.
Security updates are reviewed immediately even when the corresponding routine major is held.

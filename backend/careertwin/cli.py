"""Operator CLI for private account bootstrap, taxonomy loading and system diagnostics."""

from __future__ import annotations

import argparse
import getpass
import os
from pathlib import Path

from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import func, select, text

from careertwin.config import get_settings
from careertwin.database import SessionLocal
from careertwin.models import (
    ClaimState,
    Education,
    EvidenceClaim,
    Experience,
    MatchRun,
    Opportunity,
    ProfessionalProfile,
    Skill,
    TaxonomyConcept,
    TaxonomyRelation,
    User,
)
from careertwin.services.matching import POLICY_VERSION, calculate_match
from careertwin.services.blob import configured_blob_store
from careertwin.services.security import create_user
from careertwin.services.taxonomy import (
    ESCO_RELEASE,
    ESCO_SOURCE_URL,
    ONET_RELEASE,
    ONET_SOURCE_URL,
    import_esco,
    import_esco_relations,
    import_onet,
    record_taxonomy_import,
)


def _password_from_private_input() -> str:
    password = os.getenv("CAREERTWIN_BOOTSTRAP_PASSWORD") or getpass.getpass(
        "Password (not echoed): "
    )
    if len(password) < 12:
        raise SystemExit("Password must contain at least 12 characters")
    return password


def bootstrap_superuser(args: argparse.Namespace) -> None:
    """Create the first superuser without persisting or echoing its password."""
    try:
        email = str(TypeAdapter(EmailStr).validate_python(args.email)).casefold()
    except ValidationError as exc:
        raise SystemExit("A valid email address is required") from exc
    with SessionLocal.begin() as db:
        if db.bind is not None and db.bind.dialect.name == "postgresql":
            db.execute(text("SELECT set_config('app.is_admin', 'true', true)"))
        existing = db.scalar(select(User).where(User.email == email))
        if existing:
            raise SystemExit("An account with this email already exists")
        user = create_user(
            db,
            email=email,
            display_name=args.display_name,
            password=_password_from_private_input(),
            is_superuser=True,
            locale=args.locale,
            must_change_password=not args.no_force_change,
        )
        identifier = user.id
    print(f"Superuser created: {identifier}")


def load_esco(args: argparse.Namespace) -> None:
    """Load an operator-downloaded official ESCO archive into the pinned local index."""
    archive = Path(args.archive).resolve()
    if not archive.is_file():
        raise SystemExit("ESCO archive does not exist")
    with SessionLocal.begin() as db:
        count = import_esco(db, archive, args.language, replace=args.replace)
        relations = import_esco_relations(db, archive, replace=args.replace_relations)
        snapshot_concepts = int(
            db.scalar(
                select(func.count(TaxonomyConcept.id)).where(
                    TaxonomyConcept.taxonomy == "ESCO",
                    TaxonomyConcept.release == ESCO_RELEASE,
                    TaxonomyConcept.language == args.language,
                )
            )
            or 0
        )
        snapshot_relations = int(
            db.scalar(
                select(func.count(TaxonomyRelation.id)).where(
                    TaxonomyRelation.taxonomy == "ESCO",
                    TaxonomyRelation.release == ESCO_RELEASE,
                )
            )
            or 0
        )
        record_taxonomy_import(
            db,
            archive,
            taxonomy="ESCO",
            release=ESCO_RELEASE,
            language=args.language,
            source_url=ESCO_SOURCE_URL,
            concept_count=snapshot_concepts,
            relation_count=snapshot_relations,
        )
    print(f"Imported {count} ESCO concepts for {args.language} and {relations} relations")


def load_onet(args: argparse.Namespace) -> None:
    """Load an operator-downloaded official O*NET archive as US-specific enrichment."""
    archive = Path(args.archive).resolve()
    if not archive.is_file():
        raise SystemExit("O*NET archive does not exist")
    with SessionLocal.begin() as db:
        result = import_onet(db, archive, release=args.release, replace=args.replace)
        snapshot_concepts = int(
            db.scalar(
                select(func.count(TaxonomyConcept.id)).where(
                    TaxonomyConcept.taxonomy == "O*NET",
                    TaxonomyConcept.release == args.release,
                )
            )
            or 0
        )
        snapshot_relations = int(
            db.scalar(
                select(func.count(TaxonomyRelation.id)).where(
                    TaxonomyRelation.taxonomy == "O*NET",
                    TaxonomyRelation.release == args.release,
                )
            )
            or 0
        )
        record_taxonomy_import(
            db,
            archive,
            taxonomy="O*NET",
            release=args.release,
            language="en",
            source_url=ONET_SOURCE_URL,
            concept_count=snapshot_concepts,
            relation_count=snapshot_relations,
        )
    print(
        f"Imported O*NET {args.release}: {result['concepts']} concepts and "
        f"{result['relations']} relations"
    )


def encrypt_blobs(_: argparse.Namespace) -> None:
    """Seal legacy plaintext blobs in place before encrypted storage becomes mandatory."""
    result = configured_blob_store(get_settings()).encrypt_existing()
    print(
        f"Encrypted {result['migrated']} legacy blobs; "
        f"{result['already_encrypted']} were already encrypted"
    )


def doctor(_: argparse.Namespace) -> None:
    """Verify database connectivity without printing its URL or credentials."""
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    print("database: ok")



def rematch(args: argparse.Namespace) -> None:
    """Recompute every opportunity's alignment under the current matching policy.

    Match runs are immutable and keyed by policy version and input digest, so a change
    to the matching policy does not reinterpret stored runs: it needs new ones. Without
    this, a deployed policy fix is invisible until each opportunity happens to be
    re-run by hand from the interface.
    """
    from sqlalchemy.orm import selectinload

    with SessionLocal() as db:
        opportunities = list(
            db.scalars(
                select(Opportunity).options(selectinload(Opportunity.requirements))
            ).all()
        )
        if not opportunities:
            print("no opportunities to match")
            return

        created = 0
        for opportunity in opportunities:
            workspace_id = opportunity.workspace_id
            profile = db.scalar(
                select(ProfessionalProfile).where(
                    ProfessionalProfile.workspace_id == workspace_id
                )
            )
            if not profile:
                print(f"skip {opportunity.title}: workspace has no profile")
                continue
            skills = list(
                db.scalars(
                    select(Skill)
                    .options(selectinload(Skill.evidence))
                    .where(Skill.workspace_id == workspace_id)
                ).all()
            )
            experiences = list(
                db.scalars(select(Experience).where(Experience.workspace_id == workspace_id)).all()
            )
            education = list(
                db.scalars(select(Education).where(Education.workspace_id == workspace_id)).all()
            )
            claims = list(
                db.scalars(
                    select(EvidenceClaim).where(
                        EvidenceClaim.workspace_id == workspace_id,
                        EvidenceClaim.state == ClaimState.CONFIRMED,
                    )
                ).all()
            )
            calculation = calculate_match(
                profile, skills, experiences, education, claims, opportunity
            )
            existing = db.scalar(
                select(MatchRun).where(
                    MatchRun.workspace_id == workspace_id,
                    MatchRun.opportunity_id == opportunity.id,
                    MatchRun.policy_version == POLICY_VERSION,
                    MatchRun.input_digest == calculation.input_digest,
                )
            )
            met = sum(1 for item in calculation.assessments if item["status"] == "met")
            total = len(calculation.assessments)
            if existing:
                print(
                    f"unchanged {opportunity.title}: coverage {calculation.coverage:.3f}, "
                    f"{met}/{total} met"
                )
                continue
            db.add(
                MatchRun(
                    workspace_id=workspace_id,
                    opportunity_id=opportunity.id,
                    policy_version=POLICY_VERSION,
                    **calculation.__dict__,
                )
            )
            created += 1
            print(
                f"matched {opportunity.title}: coverage {calculation.coverage:.3f}, "
                f"{met}/{total} met, eligibility {calculation.eligibility}"
            )
        db.commit()
    print(f"{created} new run(s) under policy {POLICY_VERSION}")


def parser() -> argparse.ArgumentParser:
    """Build the CLI command tree."""
    root = argparse.ArgumentParser(prog="careertwin")
    commands = root.add_subparsers(required=True)
    bootstrap = commands.add_parser("bootstrap-superuser", help="Create the first private account")
    bootstrap.add_argument("--email", required=True)
    bootstrap.add_argument("--display-name", required=True)
    bootstrap.add_argument("--locale", choices=("en", "es"), default="en")
    bootstrap.add_argument("--no-force-change", action="store_true")
    bootstrap.set_defaults(handler=bootstrap_superuser)
    esco = commands.add_parser("import-esco", help="Import a pinned official ESCO archive")
    esco.add_argument("--archive", required=True)
    esco.add_argument("--language", choices=("en", "es"), required=True)
    esco.add_argument("--replace", action="store_true")
    esco.add_argument("--replace-relations", action="store_true")
    esco.set_defaults(handler=load_esco)
    onet = commands.add_parser("import-onet", help="Import an official O*NET database archive")
    onet.add_argument("--archive", required=True)
    onet.add_argument("--release", default=ONET_RELEASE)
    onet.add_argument("--replace", action="store_true")
    onet.set_defaults(handler=load_onet)
    blob_migration = commands.add_parser(
        "encrypt-blobs", help="Encrypt legacy document blobs in place"
    )
    blob_migration.set_defaults(handler=encrypt_blobs)
    rerun = commands.add_parser(
        "rematch", help="Recompute alignment for every opportunity under the current policy"
    )
    rerun.set_defaults(handler=rematch)
    health = commands.add_parser("doctor", help="Verify local dependencies")
    health.set_defaults(handler=doctor)
    return root


def main() -> None:
    """Execute the requested operator command."""
    args = parser().parse_args()
    args.handler(args)


if __name__ == "__main__":
    main()

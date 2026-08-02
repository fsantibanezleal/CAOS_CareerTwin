"""Operator CLI for private account bootstrap, taxonomy loading and system diagnostics."""

from __future__ import annotations

import argparse
import getpass
import os
from pathlib import Path

from sqlalchemy import select, text

from careertwin.database import SessionLocal
from careertwin.models import User
from careertwin.services.security import create_user
from careertwin.services.taxonomy import import_esco


def _password_from_private_input() -> str:
    password = os.getenv("CAREERTWIN_BOOTSTRAP_PASSWORD") or getpass.getpass(
        "Temporary password (not echoed): "
    )
    if len(password) < 12:
        raise SystemExit("Password must contain at least 12 characters")
    return password


def bootstrap_superuser(args: argparse.Namespace) -> None:
    """Create the first superuser without persisting or echoing its password."""
    with SessionLocal.begin() as db:
        if db.bind is not None and db.bind.dialect.name == "postgresql":
            db.execute(text("SELECT set_config('app.is_admin', 'true', true)"))
        existing = db.scalar(select(User).where(User.email == args.email.casefold().strip()))
        if existing:
            raise SystemExit("An account with this email already exists")
        user = create_user(
            db,
            email=args.email,
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
    print(f"Imported {count} ESCO concepts for {args.language}")


def doctor(_: argparse.Namespace) -> None:
    """Verify database connectivity without printing its URL or credentials."""
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    print("database: ok")


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
    esco.set_defaults(handler=load_esco)
    health = commands.add_parser("doctor", help="Verify local dependencies")
    health.set_defaults(handler=doctor)
    return root


def main() -> None:
    """Execute the requested operator command."""
    args = parser().parse_args()
    args.handler(args)


if __name__ == "__main__":
    main()

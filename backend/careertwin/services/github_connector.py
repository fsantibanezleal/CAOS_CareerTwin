"""Ephemeral, read-only GitHub portfolio snapshot adapter."""

from __future__ import annotations

import re
from typing import Any

import httpx

from careertwin.services.normalization import normalize_label

API_ROOT = "https://api.github.com"
SAFE_REPOSITORY = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


class GithubConnectorError(RuntimeError):
    """Sanitized connector error that never embeds a credential-bearing request."""


def _headers(token: str) -> dict[str, str]:
    return {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "CareerTwin/0.1 read-only-portfolio-snapshot",
    }


def snapshot_github(token: str, selected: list[str]) -> dict[str, Any]:
    """Read a bounded snapshot and discard the fine-grained PAT when this call returns."""
    try:
        with httpx.Client(base_url=API_ROOT, headers=_headers(token), timeout=15) as client:
            user_response = client.get("/user")
            user_response.raise_for_status()
            user = user_response.json()
            if selected:
                names = selected
            else:
                repos_response = client.get(
                    "/user/repos",
                    params={"per_page": 50, "sort": "updated", "affiliation": "owner"},
                )
                repos_response.raise_for_status()
                names = [item["full_name"] for item in repos_response.json()[:50]]
            repositories: list[dict[str, Any]] = []
            proposals: list[dict[str, Any]] = []
            for full_name in names[:50]:
                if not SAFE_REPOSITORY.fullmatch(full_name):
                    continue
                response = client.get(f"/repos/{full_name}")
                response.raise_for_status()
                repo = response.json()
                languages_response = client.get(f"/repos/{full_name}/languages")
                languages = languages_response.json() if languages_response.is_success else {}
                releases_response = client.get(
                    f"/repos/{full_name}/releases", params={"per_page": 10}
                )
                releases = releases_response.json() if releases_response.is_success else []
                repositories.append(
                    {
                        "full_name": repo.get("full_name"),
                        "description": repo.get("description"),
                        "html_url": repo.get("html_url"),
                        "topics": repo.get("topics", []),
                        "languages": languages,
                        "stars": repo.get("stargazers_count", 0),
                        "fork": bool(repo.get("fork")),
                        "archived": bool(repo.get("archived")),
                        "owner_login": (repo.get("owner") or {}).get("login"),
                        "default_branch": repo.get("default_branch"),
                        "updated_at": repo.get("updated_at"),
                        "releases": [
                            {
                                "tag_name": item.get("tag_name"),
                                "published_at": item.get("published_at"),
                            }
                            for item in releases[:10]
                        ],
                    }
                )
                owned = (repo.get("owner") or {}).get("login", "").casefold() == str(
                    user.get("login", "")
                ).casefold()
                if owned and not repo.get("fork") and not repo.get("archived"):
                    for language in list(languages)[:12]:
                        proposals.append(
                            {
                                "claim_type": "skill",
                                "statement": f"Repository {full_name} contains {language} source code.",
                                "normalized_value": {
                                    "skill": normalize_label(language),
                                    "repository": full_name,
                                },
                                "source_locator": {
                                    "repository": full_name,
                                    "endpoint": "languages",
                                },
                                "confidence": 0.65,
                            }
                        )
            rate = {
                "limit": user_response.headers.get("x-ratelimit-limit"),
                "remaining": user_response.headers.get("x-ratelimit-remaining"),
                "reset": user_response.headers.get("x-ratelimit-reset"),
            }
            return {
                "login": str(user.get("login", "")),
                "repositories": repositories,
                "rate_limit": rate,
                "proposed_claims": proposals,
            }
    except httpx.HTTPStatusError as exc:
        raise GithubConnectorError(
            f"GitHub rejected the read-only request with status {exc.response.status_code}"
        ) from None
    except httpx.HTTPError:
        raise GithubConnectorError("GitHub could not be reached for the bounded snapshot") from None

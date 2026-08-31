from pathlib import Path

import pytest

from careertwin.harness import CareerTwinClient, HarnessError, _media_type, parser


def test_harness_refuses_absolute_or_non_api_paths_before_authentication() -> None:
    with CareerTwinClient("http://127.0.0.1:8000", None, None) as client:
        with pytest.raises(HarnessError, match="relative /api"):
            client.request("GET", "https://example.com/api/profile")
        with pytest.raises(HarnessError, match="relative /api"):
            client.request("GET", "/metrics")


def test_harness_infers_standard_document_media_types() -> None:
    assert _media_type(Path("resume.pdf"), None) == "application/pdf"
    assert _media_type(Path("resume.docx"), None) == (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    assert _media_type(Path("unknown.private"), None) == "application/octet-stream"
    assert _media_type(Path("resume.pdf"), "text/plain") == "text/plain"


def test_harness_exposes_native_core_workflows() -> None:
    root = parser()
    cases = {
        "doctor": ["doctor"],
        "get": ["get", "/api/profile"],
        "request": ["request", "POST", "/api/profile/skills"],
        "profile-graph": ["profile-graph"],
        "opportunity-graph": ["opportunity-graph"],
        "profile-upload": ["profile-upload", "--file", "resume.pdf"],
        "claim-decision": ["claim-decision", "claim-id", "confirmed"],
        "opportunity-url": ["opportunity-url", "https://example.com/job"],
        "opportunity-file": ["opportunity-file", "--file", "job.pdf"],
        "match": ["match", "opportunity-id"],
        "recommend": ["recommend", "opportunity-id"],
        "github-review": ["github-review", "--repository", "owner/repo"],
        "chat": ["chat", "What should I improve?"],
    }
    for expected, arguments in cases.items():
        assert root.parse_args(arguments).command == expected

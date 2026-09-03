"""Shared pytest fixtures."""

import pytest


@pytest.fixture
def anyio_backend() -> str:
    """Run anyio tests on asyncio (uvicorn default runtime)."""
    return "asyncio"


@pytest.fixture(autouse=True)
def clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Pin the demo seed so API tests are deterministic."""
    monkeypatch.setenv("CSDEMO_DEMO_SERVER_SEED", "demo-seed-change-me")

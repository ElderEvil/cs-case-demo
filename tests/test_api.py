"""API tests through the real ASGI app (no mocks, parse every payload)."""

import pytest
from httpx2 import ASGITransport, AsyncClient
from pydantic import TypeAdapter

from cs_case_demo.main import create_app
from cs_case_demo.schemas import CaseOut, CommitmentOut, HealthOut, OpenResult, VerifyResult

pytestmark = pytest.mark.anyio

_case_list_adapter = TypeAdapter(list[CaseOut])


async def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=create_app()), base_url="http://test")


async def test_health() -> None:
    async with await _client() as client:
        response = await client.get("/api/health")
    assert HealthOut.model_validate(response.json()) == HealthOut(status="ok")


async def test_cases_list_has_five_demo_cases() -> None:
    async with await _client() as client:
        response = await client.get("/api/cases")
    cases = _case_list_adapter.validate_python(response.json())
    assert [c.id for c in cases] == ["recruit", "vanguard", "anime", "zeus", "knife"]


async def test_open_returns_item_from_same_case() -> None:
    async with await _client() as client:
        opened = OpenResult.model_validate(
            (await client.post("/api/open", json={"case_id": "recruit", "client_seed": "demo", "nonce": 0})).json()
        )
        catalog = CaseOut.model_validate((await client.get("/api/cases/recruit")).json())
    assert opened.case_id == "recruit"
    assert opened.item.id in {i.id for i in catalog.items}


async def test_open_unknown_case_404() -> None:
    async with await _client() as client:
        response = await client.post("/api/open", json={"case_id": "nope", "client_seed": "demo", "nonce": 0})
    assert response.status_code == 404


async def test_fair_verify_roundtrip() -> None:
    async with await _client() as client:
        commitment = CommitmentOut.model_validate((await client.get("/api/fair/commitment")).json())
        result = VerifyResult.model_validate(
            (
                await client.post(
                    "/api/fair/verify",
                    json={
                        "server_seed": "demo-seed-change-me",
                        "client_seed": "demo",
                        "nonce": 0,
                        "commitment": commitment.server_hash,
                    },
                )
            ).json()
        )
    assert result.commitment_valid is True

"""Fairness routes: commitment + independent verification (HTTP only)."""

from fastapi import APIRouter

from cs_case_demo.config import get_settings
from cs_case_demo.schemas import CommitmentOut, VerifyRequest, VerifyResult
from cs_case_demo.services import fair as fair_service

router = APIRouter(tags=["fairness"])


@router.get("/fair/commitment")
def get_commitment() -> CommitmentOut:
    """Publish SHA256(demo_server_seed) before any roll."""
    settings = get_settings()
    return fair_service.get_commitment(server_seed=settings.demo_server_seed)


@router.post("/fair/verify")
def verify(payload: VerifyRequest) -> VerifyResult:
    """Re-derive a roll from the revealed seed and check the commitment."""
    return fair_service.verify(payload)

"""Liveness probe (HTTP only)."""

from fastapi import APIRouter

from cs_case_demo.schemas import HealthOut

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> HealthOut:
    """Return OK when the app is up."""
    return HealthOut(status="ok")

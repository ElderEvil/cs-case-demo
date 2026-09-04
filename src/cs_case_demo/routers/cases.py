"""Case catalog + demo opening routes (HTTP only, logic lives in services)."""

from fastapi import APIRouter, HTTPException, status

from cs_case_demo.config import get_settings
from cs_case_demo.database import record_roll
from cs_case_demo.schemas import CaseOut, OpenRequest, OpenResult
from cs_case_demo.services import cases as cases_service
from cs_case_demo.services.cases import CaseNotFoundError

router = APIRouter(tags=["cases"])


@router.get("/cases")
def get_cases() -> list[CaseOut]:
    """List all demo cases with visible odds."""
    return cases_service.list_case_outcomes()


@router.get("/cases/{case_id}")
def get_case_by_id(case_id: str) -> CaseOut:
    """Get one case by id."""
    try:
        return cases_service.get_case_outcome(case_id)
    except CaseNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown case: {case_id}") from exc


@router.post("/open")
def open_case(payload: OpenRequest) -> OpenResult:
    """Open a case with a deterministic fair roll (demo nonce, no money/Steam)."""
    settings = get_settings()
    try:
        result = cases_service.open_case(payload, server_seed=settings.demo_server_seed)
    except CaseNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown case: {payload.case_id}") from exc
    record_roll(settings.database_url, payload, result)
    return result

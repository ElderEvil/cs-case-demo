"""API routers: single /api entry point aggregating all sub-routers."""

from fastapi import APIRouter

from cs_case_demo.routers import cases, fair, health

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(cases.router)
api_router.include_router(fair.router)

__all__ = ["api_router"]

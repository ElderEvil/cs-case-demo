"""App factory: JSON API + static demo frontend served by FastAPI itself."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from cs_case_demo.config import get_settings
from cs_case_demo.database import create_schema
from cs_case_demo.routers import api_router

STATIC_DIR = Path(__file__).resolve().parent.parent.parent / "static"


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None]:
    """Create the local persistence schema before serving the demo."""
    create_schema(get_settings().database_url)
    yield


def create_app() -> FastAPI:
    """Build the demo app: /api/* JSON + / static landing."""
    settings = get_settings()
    app = FastAPI(title="CS Case Demo", debug=settings.debug, lifespan=lifespan)
    app.include_router(api_router)
    if STATIC_DIR.exists():
        app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
    return app


app = create_app()

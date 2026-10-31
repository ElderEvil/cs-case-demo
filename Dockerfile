FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1

WORKDIR /app

COPY pyproject.toml uv.lock README.md ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

COPY src ./src
COPY static ./static
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "cs_case_demo.main:app", "--host", "0.0.0.0", "--port", "8000"]

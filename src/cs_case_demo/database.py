"""Small SQLAlchemy persistence seam for demo roll history.

SQLite is the default for local demos. Keep the database URL configurable so
the persistence boundary can move to a hosted libSQL/Turso adapter later.
"""

from datetime import UTC, datetime

from sqlalchemy import DateTime, Float, Integer, String, create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from cs_case_demo.schemas import OpenRequest, OpenResult


class Base(DeclarativeBase):
    """Base class for persisted demo records."""


class RollRecord(Base):
    """Immutable audit record for one demo case opening."""

    __tablename__ = "roll_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    case_id: Mapped[str] = mapped_column(String(64), index=True)
    item_id: Mapped[str] = mapped_column(String(128))
    client_seed: Mapped[str] = mapped_column(String(64))
    nonce: Mapped[int] = mapped_column(Integer)
    roll: Mapped[float] = mapped_column(Float)
    server_hash: Mapped[str] = mapped_column(String(64))


def _engine(database_url: str) -> Engine:
    """Make a synchronous engine suitable for the current FastAPI demo."""
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    return create_engine(database_url, connect_args=connect_args)


def create_schema(database_url: str) -> None:
    """Initialize local tables; migrations should replace this before production."""
    engine = _engine(database_url)
    Base.metadata.create_all(engine)
    engine.dispose()


def record_roll(database_url: str, payload: OpenRequest, result: OpenResult) -> None:
    """Persist an auditable copy of a completed deterministic roll."""
    engine = _engine(database_url)
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(engine)
    with session_factory.begin() as session:
        session.add(
            RollRecord(
                case_id=result.case_id,
                item_id=result.item.id,
                client_seed=payload.client_seed,
                nonce=result.nonce,
                roll=result.roll,
                server_hash=result.server_hash,
            )
        )
    engine.dispose()

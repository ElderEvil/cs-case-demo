"""Pydantic boundary models: every API payload is parsed here, never inside logic."""

from typing import ClassVar

from pydantic import BaseModel, ConfigDict, Field


class CaseItemOut(BaseModel):
    """One drop shown in the catalog."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)

    id: str
    name: str
    price_uah: int
    weight: int


class CaseOut(BaseModel):
    """A case with visible odds."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)

    id: str
    name: str
    price_uah: int
    items: list[CaseItemOut]


class OpenRequest(BaseModel):
    """Open one case. Nonce is client-controlled for this demo."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)

    case_id: str
    client_seed: str = Field(min_length=1, max_length=64, default="demo")
    nonce: int = Field(ge=0, default=0)


class OpenResult(BaseModel):
    """Deterministic open result with everything needed to verify."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)

    case_id: str
    item: CaseItemOut
    roll: float
    nonce: int
    server_hash: str


class VerifyRequest(BaseModel):
    """Re-derive a roll from the revealed seed."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)

    server_seed: str = Field(min_length=1)
    client_seed: str = Field(min_length=1, max_length=64)
    nonce: int = Field(ge=0)
    commitment: str = Field(min_length=64, max_length=64)


class VerifyResult(BaseModel):
    """Verification outcome."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)

    commitment_valid: bool
    roll: float


class HealthOut(BaseModel):
    """Health payload."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)

    status: str


class CommitmentOut(BaseModel):
    """Pre-published server hash players can check rolls against."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)

    server_hash: str

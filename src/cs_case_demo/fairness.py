"""Provably-fair core: HMAC-SHA256(server_seed, client_seed:nonce) -> float in [0, 1).

Same scheme as major case sites: publish SHA256(server_seed) before any
roll, reveal the seed on rotation so anyone can re-derive past results.
"""

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from typing import Final, NewType

ServerSeed = NewType("ServerSeed", str)
ClientSeed = NewType("ClientSeed", str)

_FLOAT_DENOMINATOR: Final = 2**32


@dataclass(frozen=True, slots=True)
class RollInput:
    """Inputs that fully determine one roll."""

    server_seed: ServerSeed
    client_seed: ClientSeed
    nonce: int


def generate_server_seed() -> ServerSeed:
    """Generate a fresh secret server seed."""
    return ServerSeed(secrets.token_hex(32))


def hash_server_seed(seed: ServerSeed) -> str:
    """Public commitment shown to players before any roll."""
    return hashlib.sha256(seed.encode()).hexdigest()


def roll_float(roll: RollInput) -> float:
    """Deterministic roll in [0, 1) from the seed triple."""
    msg = f"{roll.client_seed}:{roll.nonce}".encode()
    digest = hmac.new(roll.server_seed.encode(), msg, hashlib.sha256).digest()
    return int.from_bytes(digest[:4], "big") / _FLOAT_DENOMINATOR


def pick_weighted_index(roll_value: float, weights: tuple[int, ...]) -> int:
    """Map a roll in [0, 1) onto a weighted item index."""
    total = sum(weights)
    target = roll_value * total
    cumulative = 0
    for index, weight in enumerate(weights):
        cumulative += weight
        if target < cumulative:
            return index
    return len(weights) - 1


def verify_roll(roll: RollInput, commitment: str) -> bool:
    """Check the revealed seed matches the pre-published commitment."""
    return hash_server_seed(roll.server_seed) == commitment

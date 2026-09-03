"""Fairness services: commitment + independent verification (no HTTP here)."""

from cs_case_demo import fairness
from cs_case_demo.fairness import ClientSeed, RollInput, ServerSeed
from cs_case_demo.schemas import CommitmentOut, VerifyRequest, VerifyResult


def get_commitment(*, server_seed: str) -> CommitmentOut:
    """Publish SHA256(server_seed) before any roll."""
    return CommitmentOut(server_hash=fairness.hash_server_seed(ServerSeed(server_seed)))


def verify(payload: VerifyRequest) -> VerifyResult:
    """Re-derive a roll from the revealed seed and check the commitment."""
    roll_input = RollInput(
        server_seed=ServerSeed(payload.server_seed),
        client_seed=ClientSeed(payload.client_seed),
        nonce=payload.nonce,
    )
    return VerifyResult(
        commitment_valid=fairness.verify_roll(roll_input, payload.commitment),
        roll=fairness.roll_float(roll_input),
    )

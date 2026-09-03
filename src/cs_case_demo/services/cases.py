"""Case services: catalog mapping + deterministic opening (no HTTP here)."""

from cs_case_demo import fairness
from cs_case_demo.catalog import Case, get_case, list_cases
from cs_case_demo.fairness import ClientSeed, RollInput, ServerSeed
from cs_case_demo.schemas import CaseItemOut, CaseOut, OpenRequest, OpenResult


class CaseNotFoundError(LookupError):
    """Domain error: unknown case id. Routers map it to HTTP 404."""

    def __init__(self, case_id: str) -> None:
        """Store the missing id alongside the lookup message."""
        super().__init__(f"Unknown case: {case_id}")
        self.case_id = case_id


def to_case_out(case: Case) -> CaseOut:
    """Map a catalog case to its API outcome shape."""
    return CaseOut(
        id=case.id,
        name=case.name,
        price_uah=case.price_uah,
        items=[CaseItemOut(id=i.id, name=i.name, price_uah=i.price_uah, weight=i.weight) for i in case.items],
    )


def list_case_outcomes() -> list[CaseOut]:
    """List all demo cases with visible odds."""
    return [to_case_out(case) for case in list_cases()]


def get_case_outcome(case_id: str) -> CaseOut:
    """Get one case by id.

    Raises:
        CaseNotFoundError: If no case matches `case_id`.

    """
    case = get_case(case_id)
    if case is None:
        raise CaseNotFoundError(case_id)
    return to_case_out(case)


def open_case(payload: OpenRequest, *, server_seed: str) -> OpenResult:
    """Open a case with a deterministic fair roll (demo nonce, no money/Steam).

    Raises:
        CaseNotFoundError: If `payload.case_id` is unknown.

    """
    case = get_case(payload.case_id)
    if case is None:
        raise CaseNotFoundError(payload.case_id)
    seed = ServerSeed(server_seed)
    roll_input = RollInput(server_seed=seed, client_seed=ClientSeed(payload.client_seed), nonce=payload.nonce)
    roll_value = fairness.roll_float(roll_input)
    weights = tuple(item.weight for item in case.items)
    won = case.items[fairness.pick_weighted_index(roll_value, weights)]
    return OpenResult(
        case_id=case.id,
        item=CaseItemOut(id=won.id, name=won.name, price_uah=won.price_uah, weight=won.weight),
        roll=roll_value,
        nonce=payload.nonce,
        server_hash=fairness.hash_server_seed(seed),
    )

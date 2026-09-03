"""Unit tests for the provably-fair core."""

from cs_case_demo.fairness import (
    ClientSeed,
    RollInput,
    ServerSeed,
    generate_server_seed,
    hash_server_seed,
    pick_weighted_index,
    roll_float,
    verify_roll,
)


def test_roll_is_deterministic() -> None:
    given = RollInput(server_seed=ServerSeed("s"), client_seed=ClientSeed("c"), nonce=7)
    assert roll_float(given) == roll_float(given)


def test_roll_in_unit_interval() -> None:
    for nonce in range(50):
        given = RollInput(server_seed=ServerSeed("s"), client_seed=ClientSeed("c"), nonce=nonce)
        assert 0.0 <= roll_float(given) < 1.0


def test_commitment_roundtrip() -> None:
    seed = generate_server_seed()
    given = RollInput(server_seed=seed, client_seed=ClientSeed("c"), nonce=0)
    assert verify_roll(given, hash_server_seed(seed)) is True
    assert verify_roll(given, "0" * 64) is False


def test_weighted_pick_respects_bounds() -> None:
    assert pick_weighted_index(0.0, (60, 25, 10, 5)) == 0
    assert pick_weighted_index(0.999, (60, 25, 10, 5)) == 3

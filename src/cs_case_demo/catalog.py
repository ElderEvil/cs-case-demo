"""Demo case catalog. Static tiers in UAH mirroring CaseStorm impulse range.

Demo only: prices/odds are illustrative, not synced to any price feed.
"""

from dataclasses import dataclass
from typing import Final


@dataclass(frozen=True, slots=True)
class CaseItem:
    """One droppable skin inside a case."""

    id: str
    name: str
    price_uah: int
    weight: int


@dataclass(frozen=True, slots=True)
class Case:
    """A buyable case with weighted drops."""

    id: str
    name: str
    price_uah: int
    items: tuple[CaseItem, ...]


def _item(item_id: str, name: str, price_uah: int, weight: int) -> CaseItem:
    return CaseItem(id=item_id, name=name, price_uah=price_uah, weight=weight)


DEMO_CASES: Final = (
    Case(
        id="recruit",
        name="Recruit",
        price_uah=24,
        items=(
            _item("usp-s", "USP-S | Steel Sentinel (BS)", 18, 60),
            _item("glock-ca", "Glock-18 | Caramel Apple (MW)", 45, 25),
            _item("ak-wg", "AK-47 | Wintergreen (FT)", 120, 10),
            _item("m4a4-neo", "M4A4 | Neo-Noir (FT)", 900, 5),
        ),
    ),
    Case(
        id="vanguard",
        name="Vanguard Prime",
        price_uah=33,
        items=(
            _item("famas", "FAMAS | Commemoration (FT)", 25, 55),
            _item("mp7", "MP7 | Nemesis (FT)", 60, 28),
            _item("deagle", "Desert Eagle | Ocean Drive (FT)", 260, 12),
            _item("ak-ruby", "AK-47 | Bloodsport (FT)", 1400, 5),
        ),
    ),
    Case(
        id="anime",
        name="Anime: Tanjiro",
        price_uah=81,
        items=(
            _item("p250", "P250 | Asiimov (FT)", 70, 55),
            _item("m4a1-s", "M4A1-S | Player Two (FT)", 200, 28),
            _item("awp-asi", "AWP | Asiimov (FT)", 900, 12),
            _item("knife-t", "★ Talon Knife | Tiger Tooth (FT)", 22000, 5),
        ),
    ),
    Case(
        id="zeus",
        name="Zeus",
        price_uah=297,
        items=(
            _item("cz", "CZ75 | Tigris (FT)", 220, 55),
            _item("p90", "P90 | Asiimov (FT)", 550, 28),
            _item("m4a4-howl", "M4A4 | Howl (FT)", 2400, 12),
            _item("gloves-s", "★ Sport Gloves | Superconductor (FT)", 45000, 5),
        ),
    ),
    Case(
        id="knife",
        name="Knife Hunt",
        price_uah=4413,
        items=(
            _item("kukri", "★ Kukri Knife | Slaughter (FT)", 3200, 60),
            _item("bowie", "★ Bowie Knife | Doppler (FT)", 8000, 25),
            _item("m9", "★ M9 Bayonet | Lore (FT)", 24000, 10),
            _item("bfly", "★ Butterfly Knife | Fade (FN)", 90000, 5),
        ),
    ),
)


def list_cases() -> tuple[Case, ...]:
    """All demo cases, cheapest first."""
    return DEMO_CASES


def get_case(case_id: str) -> Case | None:
    """Find a case by id."""
    for case in DEMO_CASES:
        if case.id == case_id:
            return case
    return None

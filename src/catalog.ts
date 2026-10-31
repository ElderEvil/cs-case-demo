/**
 * Demo case catalog, ported one-to-one from src/cs_case_demo/catalog.py.
 *
 * Static tiers in UAH mirroring the CaseStorm impulse range. Demo only:
 * prices/odds are illustrative, not synced to any price feed.
 */

export type CaseItem = {
  readonly id: string;
  readonly name: string;
  readonly priceUah: number;
  readonly weight: number;
};

export type Case = {
  readonly id: string;
  readonly name: string;
  readonly priceUah: number;
  readonly items: readonly CaseItem[];
};

const DEMO_CASES: readonly Case[] = [
  {
    id: "recruit",
    name: "Recruit",
    priceUah: 24,
    items: [
      {
        id: "usp-s",
        name: "USP-S | Steel Sentinel (BS)",
        priceUah: 18,
        weight: 60,
      },
      {
        id: "glock-ca",
        name: "Glock-18 | Caramel Apple (MW)",
        priceUah: 45,
        weight: 25,
      },
      {
        id: "ak-wg",
        name: "AK-47 | Wintergreen (FT)",
        priceUah: 120,
        weight: 10,
      },
      {
        id: "m4a4-neo",
        name: "M4A4 | Neo-Noir (FT)",
        priceUah: 900,
        weight: 5,
      },
    ],
  },
  {
    id: "vanguard",
    name: "Vanguard Prime",
    priceUah: 33,
    items: [
      {
        id: "famas",
        name: "FAMAS | Commemoration (FT)",
        priceUah: 25,
        weight: 55,
      },
      { id: "mp7", name: "MP7 | Nemesis (FT)", priceUah: 60, weight: 28 },
      {
        id: "deagle",
        name: "Desert Eagle | Ocean Drive (FT)",
        priceUah: 260,
        weight: 12,
      },
      {
        id: "ak-ruby",
        name: "AK-47 | Bloodsport (FT)",
        priceUah: 1400,
        weight: 5,
      },
    ],
  },
  {
    id: "anime",
    name: "Anime: Tanjiro",
    priceUah: 81,
    items: [
      { id: "p250", name: "P250 | Asiimov (FT)", priceUah: 70, weight: 55 },
      {
        id: "m4a1-s",
        name: "M4A1-S | Player Two (FT)",
        priceUah: 200,
        weight: 28,
      },
      { id: "awp-asi", name: "AWP | Asiimov (FT)", priceUah: 900, weight: 12 },
      {
        id: "knife-t",
        name: "★ Talon Knife | Tiger Tooth (FT)",
        priceUah: 22000,
        weight: 5,
      },
    ],
  },
  {
    id: "zeus",
    name: "Zeus",
    priceUah: 297,
    items: [
      { id: "cz", name: "CZ75 | Tigris (FT)", priceUah: 220, weight: 55 },
      { id: "p90", name: "P90 | Asiimov (FT)", priceUah: 550, weight: 28 },
      { id: "m4a4-howl", name: "M4A4 | Howl (FT)", priceUah: 2400, weight: 12 },
      {
        id: "gloves-s",
        name: "★ Sport Gloves | Superconductor (FT)",
        priceUah: 45000,
        weight: 5,
      },
    ],
  },
  {
    id: "knife",
    name: "Knife Hunt",
    priceUah: 4413,
    items: [
      {
        id: "kukri",
        name: "★ Kukri Knife | Slaughter (FT)",
        priceUah: 3200,
        weight: 60,
      },
      {
        id: "bowie",
        name: "★ Bowie Knife | Doppler (FT)",
        priceUah: 8000,
        weight: 25,
      },
      {
        id: "m9",
        name: "★ M9 Bayonet | Lore (FT)",
        priceUah: 24000,
        weight: 10,
      },
      {
        id: "bfly",
        name: "★ Butterfly Knife | Fade (FN)",
        priceUah: 90000,
        weight: 5,
      },
    ],
  },
];

/** All demo cases, cheapest first. */
export function listCases(): readonly Case[] {
  return DEMO_CASES;
}

/** Find a case by id. */
export function getCase(id: string): Case | undefined {
  return DEMO_CASES.find((csCase) => csCase.id === id);
}

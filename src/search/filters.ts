import type { FieldFilters } from "./search.ts";

export const categories = [
  ["power", "Powers"],
  ["monster", "Monsters"],
  ["item", "Items"],
  ["feat", "Feats"],
  ["class", "Classes"],
  ["race", "Races"],
  ["ritual", "Rituals"],
  ["background", "Backgrounds"],
  ["theme", "Themes"],
  ["paragonpath", "Paragon paths"],
  ["epicdestiny", "Epic destinies"],
  ["deity", "Deities"],
  ["trap", "Traps"],
  ["terrain", "Terrain"],
  ["disease", "Diseases"],
  ["associate", "Associates"],
  ["glossary", "Rules & glossary"],
] as const;

export interface FilterDefinition {
  name: string;
  label: string;
  categories?: readonly string[];
  options?: readonly string[];
  placeholder?: string;
}

export const filterDefinitions: readonly FilterDefinition[] = [
  {
    name: "rarity",
    label: "Rarity",
    categories: ["item"],
    options: ["Common", "Uncommon", "Rare", "Artifact"],
  },
  {
    name: "item_type",
    label: "Item type",
    categories: ["item"],
    placeholder: "e.g. Weapon or Wondrous Item",
  },
  {
    name: "slot",
    label: "Equipment slot",
    categories: ["item"],
    options: ["Arms", "Feet", "Hands", "Head", "Neck", "Ring", "Waist"],
  },
  {
    name: "class_or_path",
    label: "Class or path",
    categories: ["power"],
    placeholder: "e.g. Wizard",
  },
  {
    name: "usage",
    label: "Power usage",
    categories: ["power"],
    options: ["At-Will", "Encounter", "Daily"],
  },
  {
    name: "power_type",
    label: "Power type",
    categories: ["power"],
    options: ["Attack", "Utility", "Feature"],
  },
  {
    name: "action",
    label: "Action",
    categories: ["power"],
    options: [
      "Standard Action",
      "Move Action",
      "Minor Action",
      "Free Action",
      "Immediate Interrupt",
      "Immediate Reaction",
      "Opportunity Action",
      "No Action",
    ],
  },
  {
    name: "role",
    label: "Role",
    categories: ["monster", "associate", "trap", "class"],
    placeholder: "e.g. Skirmisher or Elite Brute",
  },
  {
    name: "rank",
    label: "Monster rank",
    categories: ["monster", "associate"],
    options: ["Minion", "Elite", "Solo"],
  },
  {
    name: "size",
    label: "Size",
    categories: ["monster", "associate", "race"],
    options: ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"],
  },
  {
    name: "origin",
    label: "Origin",
    categories: ["monster", "associate"],
    options: ["natural", "fey", "shadow", "elemental", "immortal", "aberrant"],
  },
  {
    name: "creature_type",
    label: "Creature type",
    categories: ["monster", "associate"],
    options: ["humanoid", "beast", "magical beast", "animate"],
  },
  {
    name: "tier",
    label: "Feat tier",
    categories: ["feat"],
    options: ["Heroic", "Paragon", "Epic"],
  },
  {
    name: "power_source",
    label: "Power source",
    categories: ["class"],
    placeholder: "e.g. Arcane",
  },
  {
    name: "category_label",
    label: "Ritual category",
    categories: ["ritual"],
    placeholder: "e.g. Exploration",
  },
  {
    name: "key_skill",
    label: "Key skill",
    categories: ["ritual"],
    placeholder: "e.g. Arcana (no check)",
  },
  {
    name: "keywords",
    label: "Keyword",
    placeholder: "e.g. Fire, Arcane, or Undead",
  },
  {
    name: "sources",
    label: "Source reference",
    placeholder: "e.g. Player’s Handbook",
  },
];

export interface SearchState {
  query: string;
  values: Record<string, string>;
  tags: string[];
  page: number;
  pageSize: number;
}

export function readSearchParams(params: URLSearchParams): SearchState {
  const values = Object.fromEntries(
    [
      "category",
      "minLevel",
      "maxLevel",
      ...filterDefinitions.map((f) => f.name),
    ].map((name) => [name, params.get(name)?.trim() ?? ""]),
  );
  const page = Number(params.get("page") ?? 0);
  const pageSize = Number(params.get("pageSize") ?? 20);
  return {
    query: params.get("q") ?? "",
    values,
    tags: params
      .getAll("tag")
      .map((tag) => tag.trim())
      .filter(Boolean),
    page: Number.isSafeInteger(page) && page >= 0 ? page : 0,
    pageSize: [20, 40, 60].includes(pageSize) ? pageSize : 20,
  };
}

export function toFieldFilters({ values }: SearchState): FieldFilters {
  const filters: Record<string, string | { min?: number; max?: number }> = {};
  for (const name of ["category", ...filterDefinitions.map((f) => f.name)]) {
    if (values[name]) filters[name] = values[name];
  }
  const min = values.minLevel ? Number(values.minLevel) : undefined;
  const max = values.maxLevel ? Number(values.maxLevel) : undefined;
  if (
    [min, max].some(
      (n) => n !== undefined && (!Number.isSafeInteger(n) || n < 0),
    )
  ) {
    throw new Error("Levels must be whole numbers of 0 or higher.");
  }
  if (min !== undefined && max !== undefined && min > max) {
    throw new Error(
      "Minimum level must be less than or equal to maximum level.",
    );
  }
  if (min !== undefined || max !== undefined) filters.level = { min, max };
  return filters;
}

export function searchLink(state: SearchState, page = 0): string {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  for (const [name, value] of Object.entries(state.values))
    if (value) params.set(name, value);
  state.tags.forEach((tag) => params.append("tag", tag));
  if (state.pageSize !== 20) params.set("pageSize", String(state.pageSize));
  if (page > 0) params.set("page", String(page));
  return `/search${params.size ? `?${params}` : ""}`;
}

export function categoryLabel(category: string): string {
  return categories.find(([value]) => value === category)?.[1] ?? category;
}

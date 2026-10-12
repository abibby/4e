# Generated-table spot checks — 2026-10-12

Compared the existing JSON output against 42 source HTML files across all 17
categories: two reproducibly sampled nonempty records per category (Python
`random.Random(20261012)`, sorted table filenames and existing record order),
plus eight targeted examples covering additional layouts. This was an inspection
of the user's build; the generator and generated data were not changed.

The common fields generally match their sources, but the checks found concrete
extraction defects. The structured fields should not yet be treated as complete
representations of the rules. Findings below distinguish extraction defects from
fields the HTML does not supply.

## Findings

### 1. Multiline rules are truncated in both scalar fields and attributes

The generic label extractor stops at the first line break. A `<br>` often
continues the same rule rather than ending the field.

| Resource | Field | Missing content |
| --- | --- | --- |
| `background/Vilhon Wilds.html` | `benefit` | The additional +1 bonus to initiative checks. |
| `feat/Acolyte of Divine Secrets.html` | `benefit` | Permission to wield invoker implements. |
| `feat/Adamant Arrow Commander.html` | `benefit` | Both actual benefits; the extracted value only says that two benefits follow. |
| `power/A Thousand Faces.html` | `effect` | The opposed Insight/Bluff check and +5 bonus. |
| `power/Acrobat's Trick.html` | `effect` | The level 11 and level 21 scaling. |
| `epicdestiny/Darklord.html` | `attributes.return_from_the_shadowfell_24th_level` | Concealment, phasing, and their end-of-encounter expiration. |

All of this content remains in `text`. Searching only the named field or its
`attributes` counterpart will miss it. Fix the field boundaries before relying on
these fields for rules display or filtering.

### 2. Some explicit metadata is not extracted from alternative layouts

| Resource | Observed output | Information present in the source |
| --- | --- | --- |
| `associate/Air Monolith.html` | `vulnerable: null` | `Vulnerable 5 fire` appears without its own bold label, after the defenses formula. It is included in `defenses` instead. |
| `monster/Kaorti Thrall.html` | `perception: null` | `Perception +6` is inside the older `Senses` line. It is preserved in `senses`. |
| `monster/Severed Eyes Orc Slasher.html` | `senses: null` | `Low-light vision` is in an unlabelled cell in the newer stat table. It is only in `text`. |
| `terrain/Salt Pile.html` | `type: null` | `Single-Use Terrain` appears in the heading's `span.level`. Its attack/requirement/check details are in `attributes`, but there is no structured action column. |
| `item/Shield of Prator.html` | `rarity: null` | `Artifact` is explicitly labelled in the first stats paragraph and does populate `item_type`; rarity is only read from the heading. `Heroic Level` is preserved in `level_text`, with no numeric level inferred. |
| `power/Bending Branch.html` | `usage: null` | The visible usage label is empty, but the heading has `class="encounterpower"`. This is incomplete source markup for which a fallback could be added. |

These values require category-specific fallbacks, not guesses based on the
resource name or general D&D rules.

### 3. A trap section absorbs the next field

For `trap/Collapsing Tunnel.html`, `perception` includes the two correct DC
descriptions but then ends with `them.Initiative +3`. Initiative is a separate
`span.traplead`, not another `trapblocktitle`, so the section extractor fails to
stop before it. The separate `initiative` value is correctly `3`.

### 4. Full text sometimes joins adjacent words in headings

An independent HTML text extraction found word-boundary differences in 16 of the
42 checked records. Examples in the generated `text`:

- `disease/Skinrot.html`: `Level 2 DiseaseSkinrot`.
- `item/Ring of Brotherhood.html`: `Ring of BrotherhoodLevel 14 Uncommon`.
- `power/Demoralizing Shot.html`: `Rogue Attack 19Demoralizing Shot`.
- `terrain/Salt Pile.html`: `Single-Use TerrainSalt Pile`.

The top-level `name` values are correct. The concatenation can still break
whole-word searches or tokenization against `text`, including searches for
embedded powers. Text boundaries need to be inserted around heading metadata
spans without changing the extracted field values.

Ignoring whitespace and punctuation, the source alphanumeric content was retained
in the same order for all 42 checked records. This establishes content retention
for these samples, not correctness of every boundary or field.

## Coverage by category

“Matched” below refers to the fields examined in these samples, not a guarantee
for every record in the category. The full-text boundary issue above also affects
some categories whose structured metadata matched.

| Category | Samples | Result |
| --- | --- | --- |
| associate | Pit Fiend Servitor; Air Monolith | HP/defense formulas, speeds, creature types and summon classification matched. Air Monolith vulnerability is not separated. |
| background | Vilhon Wilds; Bestial | Type, campaign, prerequisite and associated skills matched. Vilhon Wilds benefit is truncated. |
| class | Ardent; Bard; Hybrid Ardent; Hybrid Artificer | Roles, power sources, proficiencies, skills and hit-point/surge formulas matched, including fractional hybrid values. Hybrid talent options are retained in attributes. |
| deity | Balinor; Ilmater | Type, alignment, spheres, domains and other supplied deity metadata matched. Ilmater's title is correctly part of the displayed name. |
| disease | Skinrot; Cemetery Rot | Levels and stage text matched. Check thresholds are retained as attribute keys such as `9_or_lower`, not populated into `improve`/`maintain`/`worsen`. Heading words merge in full text. |
| epicdestiny | Darklord; Dispossesed Champion | Prerequisites and the inspected Champion features matched. Darklord's multiline level 24 feature is incomplete in attributes. The spelling “Dispossesed” is present in the source. |
| feat | Rapid Infusion; Ravenous Blessing; Acolyte of Divine Secrets; Adamant Arrow Commander | Tiers and prerequisites matched. The first two benefits matched; the two targeted multiline benefits are truncated. |
| glossary | Group Checks; Character Advancement | Rules prose and advancement-table values are retained in text. The advancement table is flattened, so row/column relationships are not separately represented. Null type/category labels reflect the source. |
| item | Ring of Brotherhood; Perpetual Resolve Vestments; Shield of Prator | Ring slot/price, armor restriction, enhancement, properties and level/price variants matched. Shield artifact rarity is not populated. |
| monster | Kaorti Thrall; Severed Eyes Orc Slasher | Both paragraph and table layouts have correct level, role, XP, defenses, speed and ability values. Perception/vision normalization differs between layouts. Kaorti HP remains a qualified string, as documented. |
| paragonpath | Darkstrider; Watcher of Vengeance | Prerequisites and the three named path features for each matched. Embedded power headings exhibit the full-text boundary issue. |
| power | Demoralizing Shot; Chillsong Stroke; A Thousand Faces; Acrobat's Trick; Bending Branch | Standard attack metadata matched. Targeted examples show multiline effect truncation and a missing usage fallback for incomplete markup. |
| race | Half-Orc; Wood Elf | Half-Orc traits matched. Wood Elf is a variant page without base stats: null speed/size/abilities are appropriate, and replacement benefits remain in attributes. |
| ritual | Giggle Gas; Temporary Fix | Levels, costs, skills, categories, time and supplied duration matched. Embedded Giggle Gas items do not overwrite the ritual's metadata. |
| terrain | Salt Pile; Brambleweed | Brambleweed effect and usage matched. Salt Pile's alternate action-block format retains labelled rules in attributes but loses its structured type. |
| theme | Renegade Red Wizard; Underdark Outcast | Name, supplied prerequisite and named feature values matched. The `Compedium` filename prefix does not leak into the displayed name. |
| trap | Collapsing Tunnel; Claw of Yeenoghu | Level, role, XP, trigger, attack, hit and countermeasures matched. Collapsing Tunnel perception includes its separate initiative field. |

## Verification and limits

- All 17 JSON tables load successfully.
- All 24,696 source HTML files other than navigation `index.html` files are
  represented exactly once, with matching source paths and no extra records.
- The four previously identified empty source files remain placeholders.
- Existing tests: `python3 -m unittest discover -s tests -v` — 12 passed.
- The passing tests do not cover the defects above; regression cases are needed
  when those defects are fixed.
- No generator fixes or output rebuilds were made during this inspection.

The highest-priority follow-up is preserving multiline field values, followed by
correct section/text boundaries and category-specific metadata fallbacks.

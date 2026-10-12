# D&D 4e resource tables

Generate one searchable JSON table for every subfolder of `content` using Python
3.9 or later. No dependencies are required.

```sh
# Build all 17 resource types into tables/<folder>.json
python3 build/indexgen.py

# Rebuild selected tables
python3 build/indexgen.py monster item power

# Choose another destination or source collection
python3 build/indexgen.py --output /tmp/4e-tables
python3 build/indexgen.py --content /path/to/content --output /tmp/4e-tables
```

Paths default to this repository regardless of the current working directory.
Generated files in `tables/` are ignored by Git. The original HTML and existing
`content/*/index.json` files are left intact. A selected build only replaces the
selected tables. Unknown folder names fail with an error.

Each table is an array with one record per HTML file, including files in nested
directories. Navigation files named `index.html` are excluded. Records retain
their source filenames, so resources with the same display name remain distinct.
Empty source files are retained using their filename as the name, with a warning
printed during generation. The collection currently contains four empty files,
including `Raven Tens`, `Triflik's Blade`, and two saved browser error pages.
Folders and files are sorted to make repeated builds deterministic. New content
folders automatically get the common fields even without a custom extractor.

Every record includes:

- `file`: path relative to `content`, e.g. `monster/Goblin Cutthroat.html`.
- `name` and `category`: display name and content folder.
- `sources`: publication references, including page numbers where supplied.
- `attributes`: labelled fields, keyed in snake_case, with arrays of distinct
  text values so repeated effects, attacks, and other labels can be searched.
- `text`: the complete visible text with whitespace normalized and HTML entities
  decoded. Search this to include prose, embedded powers, and unusual stat blocks.

Additional columns depend on the resource type:

| Table | Structured fields include |
| --- | --- |
| monster, associate | Level, role, rank, XP, size, origin, creature type, keywords, HP, defenses, speed, senses, resistances, abilities, skills, languages |
| trap | Level, role, XP, type, initiative, perception, trigger, attack, hit, countermeasures |
| item | Level, rarity, item type, slot, armor/weapon/implement restrictions, price, weight, properties, enhancement, critical, level/price variants |
| power | Class or path, power type, level, usage, action, range, keywords, requirements, targets, attacks, hits, effects |
| class | Role, power source, key abilities, proficiencies, hit points, healing surges, skills, builds, features |
| race | Ability bonuses, size, speed, vision, languages, skill bonuses, height, weight |
| feat | Tier, keywords, prerequisites, benefit |
| background | Type, campaign setting, prerequisites, associated skills/languages |
| deity | Type, alignment, gender, sphere, domains, dominion |
| ritual | Level, category, component cost, market price, key skill, time, duration |
| disease | Level, stages, checks, initial/final effects |
| paragonpath, epicdestiny, theme | Prerequisites; named features in attributes and full text |
| terrain | Type, effect, usage |
| glossary | Type/category when provided, full rules text |

`category` always identifies the folder; an HTML field labelled “Category” becomes
`category_label`. Absent scalar fields are `null`, and absent lists are empty.
Levels and XP are numbers where explicitly supplied. Simple monster statistics
such as HP and defenses are numbers; formulas or qualified values remain strings.
Speed, prices, and most other fields retain their source wording and units.
Multiple values in a scalar column are joined with ` | `; `attributes` retains
them as separate values. Unknown or missing information is not inferred.

An item's `variants` array keeps each listed level, enhancement, and price
together. `level` is the base level shown in its heading. Top-level metadata
describes the first resource/power on the page; additional powers and techniques
remain searchable in `attributes` and `text`. These are extracted search indexes,
not a rules engine: free-form rules and unusual formatting may require full-text
search instead of a structured filter.

For example, find level 1 skirmishers:

```python
import json
from pathlib import Path

monsters = json.loads(Path("tables/monster.json").read_text(encoding="utf-8"))
matches = [m for m in monsters if m["level"] == 1 and m["role"] == "Skirmisher"]
print([m["name"] for m in matches])
```

Run the extractor tests:

```sh
python3 -m unittest discover -s tests -v
```

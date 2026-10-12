# D&D 4e compendium

A fully static search interface for the 24,696 entries in `content/`. The homepage
has a title and live search box; the results page has category-specific filters,
full-text excerpts, sorting, pagination, and links to complete resource pages.
Searches, filters, and pagination are encoded in the URL for sharing and browser
back/forward navigation. Quick results support arrow keys, Enter, and Escape.

**There is no application server.** The browser loads HTML/CSS/JavaScript from a
static host and calls Typesense directly using a public, search-only API key.
Python runs only at build/indexing time. No framework or JavaScript runtime is
required for production hosting.

```text
Browser ── HTML, CSS, JS, resource pages ──> Static hosting (dist/)
        └─ search, autocomplete, filters ─> Typesense Cloud

Build machine ── tables/*.json ──> Typesense indexing API (private admin key)
              └─ content/     ──> dist/ (static files)
```

## Run locally with Docker Compose

```sh
docker compose up -d
```

Open **http://localhost:8000** after the initial import finishes (usually a few
minutes). Typesense is at `http://localhost:8108`. The `setup` container generates
the tables, builds the site, imports all entries, and creates a search-only key.
The `site` container is only a local static-file preview, not a production backend.
Both published ports bind to loopback. The fixed admin key in `compose.yaml` is
for local development only; the browser gets a separate generated search key.

```sh
# Watch the initial build/import
docker compose logs -f setup

# Rebuild after changing content, tables, or frontend files
docker compose run --rm setup

# Run extractor/build tests and real Typesense integration tests
# Run `up -d` first; --no-deps avoids repeating the full setup/import.
docker compose --profile test run --rm --no-deps test

# Stop local services (keeps the Typesense data volume)
docker compose down
```

If you change only frontend assets, copy `web/*` to `dist/assets/` to refresh the
preview without rebuilding the index. The Docker setup regenerates `tables/`
from `content/`; use the individual Python commands below if you have edited the
tables directly and want to retain those edits.

## Build for static hosting with Typesense Cloud

1. Create a [Typesense Cloud](https://cloud.typesense.org/) cluster with browser
   CORS enabled for your static site's origin.
2. Set `TYPESENSE_URL` to its HTTPS API endpoint and `TYPESENSE_ADMIN_KEY` in the
   build environment. `.env.example` lists the available settings; the Python
   scripts read environment variables, not `.env` files.
3. Build the files and upload the search index:

```sh
python3 build/indexgen.py     # Omit if existing tables are already up to date.
python3 build/site.py
python3 build/search.py
```

4. Upload **only `dist/`** to any static host: GitHub Pages, Cloudflare Pages,
   Netlify, S3, or another CDN. No server, function, rewrite rule, or SPA fallback
   is needed. Relative asset URLs support deployment under a subdirectory too.

`build/search.py` writes `dist/assets/config.json` with the endpoint, collection
alias, and public search-only key. It creates a key restricted to
`documents:search` on the `compendium` alias unless `TYPESENSE_SEARCH_KEY` is
provided. The admin key stays in the indexing environment and is never emitted
into the site. The public key allows searching the collection's content; static
hosting access restrictions alone do not make a public search index private.

The importer creates a fresh collection, checks every import response and the
final document count, then switches the alias only after all records succeed.
This removes deleted entries from search on rebuild without exposing a partial
index. Previous collections remain available for rollback; delete them manually
after verification. Reuse `TYPESENSE_SEARCH_KEY` on later builds to avoid creating
extra keys. Override `TYPESENSE_COLLECTION` if you need separate indexes.
`TYPESENSE_PUBLIC_URL` overrides the browser endpoint when the indexing machine
uses a different internal address, as in Docker Compose.

Run `site.py` before `search.py`: the latter writes the final public configuration.
Existing configuration is preserved during a rebuild unless a new search key is supplied.
To build without reimporting an existing index, supply `TYPESENSE_URL` and
`TYPESENSE_SEARCH_KEY` when running `site.py`. Without search configuration, pages
still render and remain readable; search displays an unavailable message.

### Searchable and filterable data

- Name receives the highest search weight, followed by structured metadata and
  the complete rules text. Labelled `attributes` are also included in search.
- Every populated top-level table field, including sources, is available as a
  category filter through the common controls or **More attributes**. Text filters
  use exact values; suggestions come from Typesense facets and can be typed.
- Numeric fields have minimum/maximum controls. Mixed numeric/formula fields stay
  text filters so qualified values are preserved.
- Item variant level, price, and enhancement are separate filters. They match any
  variant on a page; combining them does not enforce that they come from the same
  variant row. The full page retains the original variant table.
- Arbitrary labels in `attributes` are full-text searchable. Category filter
  controls use the explicit structured table columns, not the thousands of
  one-off labels embedded in rules prose.

### Files and checks

- `web/`: dependency-free frontend assets.
- `build/site.py`: static page generator; preserves source fragments and repairs
  their relative image references in the generated pages.
- `build/searchdata.py`: shared search document/schema and filter metadata.
- `build/search.py`: Typesense import and public configuration writer.
- `compose.yaml`: local Typesense, one-time setup, static preview, and tests.

```sh
# Python 3.9+; integration tests skip unless Typesense credentials are set
python3 -m unittest discover -s tests -v

# Node 22+; no npm dependencies required
node --experimental-default-type=module tests/search-client.test.mjs
```

The four empty source files are rendered with an explicit empty-source message.
Existing external publication links are preserved. Generated output is ignored
by Git. Builds overwrite generated pages but do not delete old files in `dist/`;
use a fresh output directory for deployment if source entries were removed.

---

## Generate resource tables

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

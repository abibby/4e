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

## Algolia search

`src/search/search.ts` defines the provider-independent `Search` interface.
`AlgoliaSearch` uses the `algoliasearch` npm client for full-text queries,
attribute filters, zero-based pagination, and cancellation of pending results. The SDK
may finish its network request after cancellation. Empty queries browse entries or search by
tags alone. The `/search` page uses this interface and preserves queries, tags,
and pagination in its URL. Results link to the original HTML through `/c/*`.
Vite serves the content in development and copies it into `dist/content` during
the production build. Configure your static host to serve `index.html` for SPA
routes such as `/search` and `/c/*`.

For Netlify, the root `netlify.toml` configures Node 22, `npm run build`, and
the `dist` publish directory. Its SPA fallback supports direct visits and
refreshes on `/search` and `/c/*`, while existing content and image files are
served normally. Set `VITE_ALGOLIA_APP_ID`, `VITE_ALGOLIA_SEARCH_KEY`, and
`VITE_ALGOLIA_INDEX_NAME` in the Netlify project's build environment before
deploying. Use the search-only key; the site build does not need indexer admin
credentials. Rebuild after changing these values because Vite embeds them in
the browser bundle.

The TypeScript indexer (`build/algolia.ts`, Node 22.6+) reads visible text directly
from `public/content` and joins table metadata by `file`. Navigation-only
`index.html` files are skipped, matching the table generator. Missing metadata
stops indexing before any upload. Rebuild the tables after changing content:

```sh
python3 build/indexgen.py
# Validate locally without credentials or network access:
npm run index:algolia
# Optionally export records for inspection:
npm run index:algolia -- --output /tmp/compendium-algolia.jsonl
```

All scalar and scalar-array table columns are indexed automatically, such as `category: "monster"`,
`level: 1`, and `keywords: ["Fire", "Arcane"]`. Each field is registered in
`attributesForFaceting` as `filterOnly(field)`. Numbers remain numeric for range
filtering; arrays retain their individual values and nulls are omitted.
No field allowlist or `--tag-field` option is needed. The nested `attributes`
object contains duplicate extracted prose and isn't indexed as filter fields.
Item variants are exposed as `variant_level`, `variant_price`, and
`variant_enhancement` arrays. `level` retains the table's own level value.

The responsive search page includes resource type, inclusive level bounds, keyword,
source reference, and category-specific filters: power class/path, usage, action
and type; item rarity, type and slot; creature role, rank, size, origin and type;
feat tier; class power source; and ritual category and skill. Text field filters
match exact indexed values (case-insensitive); source references may include page
numbers. Use the main full-text search for partial matches.

Apply filters together, remove individual applied filters with their chips, or
clear all filters while keeping your search text. Switching resource type clears
incompatible draft fields. The search page uses the standard resource filters;
all applied filters combine using AND. Queries, filters, results per page, and
pagination stay in the URL, including browser back/forward
navigation. Entry pages link back to the originating search and support printing.

Shared controls, result cards, pagination and the application layout live in
`src/components`. `src/hooks/use-search.ts` handles draft filters and navigation
links; `src/search/filters.ts` owns filter definitions, URL serialization, and
validation. Styling uses responsive CSS, visible keyboard focus, reduced-motion
support and scoped legacy entry styles. Search and entry routes load on demand.

The search API accepts equality values and numeric ranges on any indexed column:

```ts
import { AlgoliaSearch } from "./src/search/algolia";

const search = new AlgoliaSearch({
  applicationId: "YOUR_APP_ID",
  searchKey: "YOUR_SEARCH_ONLY_KEY",
  indexName: "compendium",
});
const results = await search.search({
  filters: {
    category: "item",
    level: { min: 3, max: 6 },
    rarity: "Uncommon",
  },
  page: 0,
  pageSize: 20,
});
```

Numeric equality uses a number, such as `level: 3`; ranges can omit either bound.
The SDK request uses `facetFilters: ["category:item", "rarity:Uncommon"]` with
`numericFilters: ["level:3 TO 6"]` for the example above. Strings like `"9,000 gp"`
retain their table type and support equality filtering, not numeric comparisons.
Re-upload the index after changing the indexed fields.

Add the values from `.env.example` to your local `.env`. The browser uses only
the `VITE_ALGOLIA_*` variables; use a search-only key restricted to the index.
Never expose an admin key through a `VITE_` variable. Restart Vite after changing
configuration. The Node indexer loads `.env` automatically; existing process
environment variables take precedence:

```sh
npm run index:algolia -- --upload
npm start
```

Uploads use `ALGOLIA_APP_ID`, `ALGOLIA_ADMIN_KEY`, and `ALGOLIA_INDEX_NAME`
(default `compendium`, also overridable with `--index`). The upload command
replaces that index, including its settings, using a temporary index after all
batches finish. Use a dedicated compendium index. This removes stale records
when files disappear or shrink. Settings or batch failures leave the live index
intact; the printed temporary index can be removed in the Algolia dashboard. If
the final move or its polling fails, check the dashboard to confirm which index
is live. The upload key must permit settings, record writes, and moving
temporary indices.

Long HTML files are split into overlapping records below 9,000 UTF-8 JSON bytes.
Every chunk retains the same filter fields, and Algolia groups results by `file` so each
entry appears once. All text is indexed, though query terms must match within
one chunk; the overlap preserves short phrases near boundaries. This can use
more Algolia records than there are HTML files.

Both searches and uploads use the official [`algoliasearch` npm SDK](https://github.com/algolia/algoliasearch-client-javascript).
`build/algolia.ts` uses the SDK for settings, batched uploads, task polling, and
index replacement. HTML parsing and entity decoding use `html5parser` and
`entities`. Python is needed only when regenerating the metadata tables.
Filtering and replacement follow Algolia's
[filterable attributes](https://www.algolia.com/doc/api-reference/api-parameters/attributesForFaceting),
[facet filters](https://www.algolia.com/doc/api-reference/api-parameters/facetFilters),
and [index replacement](https://www.algolia.com/doc/rest-api/search/operation-index).

Run search tests and build:

```sh
npm run test:search # Node 22.6+ for native TypeScript stripping
python3 -m unittest discover -s tests -v
npm run build
```

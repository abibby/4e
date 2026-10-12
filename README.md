# D&D 4e compendium

A fully static search interface for the 24,696 entries in `content/`. The homepage
has a title and live search box; the results page has category-specific filters,
full-text excerpts, sorting, pagination, and links to complete resource pages.
Searches, filters, and pagination are encoded in the URL for sharing and browser
back/forward navigation. Quick results support arrow keys, Enter, and Escape.

**There is no application server.** The browser loads HTML/CSS/JavaScript from a
static host and calls Typesense directly using a public, search-only API key.
Vite server-renders React at build time and emits static HTML for the homepage,
search shell, and every entry header. The browser hydrates those components for
interactive search; page layout, navigation, and rules text work without
JavaScript. Live Typesense search and filtering still require JavaScript, and the
search page explains this instead of leaving a loading indicator. Build-time SSR
keeps deployment compatible with GitHub Pages and other static hosts.
Python extracts content
metadata and uploads the search index. No JavaScript runtime is required for
production hosting.

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
minutes). Typesense is at `http://localhost:8108`. The Python `setup` container
generates the tables, imports all entries, and creates a search-only key. The Node
`build` container then runs Vite. The `site` container serves `dist/` with nginx
for local preview.
Both published ports bind to loopback. The fixed admin key in `compose.yaml` is
for local development only; the browser gets a separate generated search key.

```sh
# Watch the initial build/import
docker compose logs -f setup build

# Rebuild after changing content, tables, or frontend files
docker compose run --rm setup
docker compose run --rm --no-deps build

# Run extractor tests and real Typesense integration tests
# Run `up -d` first; --no-deps avoids repeating the full setup/import.
docker compose --profile test run --rm --no-deps test

# Stop local services (keeps the Typesense data volume)
docker compose down
```

For frontend-only changes, run `docker compose run --rm --no-deps build` to refresh
the preview without rebuilding the index. The Docker setup regenerates `tables/`
from `content/`; use the individual commands below to retain manually edited tables.

## Develop the React frontend

Install Node.js 22.12+ and Python 3.9+ (only needed to prepare content metadata):

```sh
npm ci
python3 build/indexgen.py  # Once initially, then after changing content.
cp .env.example .env      # Fill in the endpoint and public search-only key.
npm run dev
```

Open **http://localhost:5173**. Vite provides React hot reload and serves the entry
pages at their existing `content/<category>/<name>.html` URLs. It reads `.env`
automatically; the Python indexing commands still require exported environment
variables. If Docker has already created `dist/assets/config.json`, Vite reuses
that configuration unless you supply a new `TYPESENSE_SEARCH_KEY`.

```sh
npm test             # Search client and page generation contracts
npm run build        # Build React assets and all static pages into dist/
npm run preview      # Preview the production build at http://localhost:4173
```

The frontend build consumes `tables/*.json`; it does not run Python or contact
Typesense. Regenerate the tables after changing source content.

React Router shares the route tree between `BrowserRouter` in the browser and
`StaticRouter` during SSR. Home and search navigation stays in the same document;
query parameters are the source of truth for filters, sorting, and pagination.
Links to and from entry pages load their static documents so the original rules
markup remains readable independently of React. Relative links support deployment
under `/4e/` or another base path without changing the build.

Browser regression tests use a mocked Typesense service and the production build:

```sh
npx playwright install chromium  # Once per development environment.
npm run build
npm run test:browser
```

These checks cover client navigation, URL history, filters, autocomplete, retries,
SSR without JavaScript, and hydration under `/4e/`. The Pages workflow runs them
before deploying. To use an existing Chromium installation, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path.

## Build for static hosting with Typesense Cloud

1. Create a [Typesense Cloud](https://cloud.typesense.org/) cluster with browser
   CORS enabled for your static site's origin.
2. Set `TYPESENSE_URL` to its HTTPS API endpoint and `TYPESENSE_ADMIN_KEY` in the
   indexing environment. `.env.example` lists the available settings; Vite loads
   `.env`, while Python scripts read exported environment variables.
3. Build the files and upload the search index:

```sh
npm ci
python3 build/indexgen.py     # Omit if existing tables are already up to date.
python3 build/search.py       # Imports records and writes the public configuration.
npm run build
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

Run `search.py` before `npm run build` when creating a new search key. Vite reads
the existing public configuration before cleaning the output directory and writes
it back with the generated assets unless a new search key is supplied.
To build without reimporting an existing index, supply `TYPESENSE_URL` and
`TYPESENSE_SEARCH_KEY` when running `npm run build`. Without search configuration, pages
still render and remain readable; search displays an unavailable message.

## Deploy with GitHub Actions

Two independent workflows run on relevant pushes to `master`. Both also support
manual runs from the Actions tab once they are on the default branch.

| Workflow | Automatic triggers | Deployment |
| --- | --- | --- |
| [Deploy search indexes](.github/workflows/search.yml) | `content/**`, `build/indexgen.py`, `build/searchdata.py`, `build/search.py`, its own workflow file | Regenerates tables and updates the Typesense collection alias |
| [Deploy to GitHub Pages](.github/workflows/pages.yml) | `content/**`, `images/**`, `web/**`, HTML entry points, npm manifests, `vite.config.js`, content metadata scripts, `build/*.mjs`, its own workflow file | Builds with Vite and uploads only `dist/` to Pages |

Tables are generated and ignored by Git, so the index workflow watches their
source content and generation code. Content and shared metadata changes trigger
both workflows; frontend-only changes do not reindex, and importer-only changes
do not redeploy Pages. Documentation and test-only changes trigger neither.

One-time repository setup:

1. In **Settings → Pages → Build and deployment**, select **GitHub Actions** as
   the source ([GitHub's custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)).
2. In **Settings → Secrets and variables → Actions**, configure repository-level
   settings so both workflows can access them:

   | Type | Name | Value |
   | --- | --- | --- |
   | Variable | `TYPESENSE_URL` | Your public HTTPS Typesense Cloud endpoint |
   | Secret | `TYPESENSE_ADMIN_KEY` | Private key used only by the index workflow to create/import collections and switch aliases |
   | Secret | `TYPESENSE_SEARCH_KEY` | Stable search-only key scoped to the collection alias; required by the Pages workflow |
   | Variable (optional) | `TYPESENSE_COLLECTION` | Collection alias; defaults to `compendium` |

3. Create a key in Typesense with only the `documents:search` action for the
   configured collection alias, or reuse the search-only key previously generated
   in `dist/assets/config.json`. Store it as `TYPESENSE_SEARCH_KEY`. Index updates
   retain this key; the Pages workflow never needs the admin key.
4. Allow the Pages site's origin (normally `https://abibby.github.io`) in your
   Typesense CORS configuration.
5. Merge the workflows into `master`. For initial setup, run **Deploy search
   indexes** first, then **Deploy to GitHub Pages**. The Pages deployment URL is
   shown in the `github-pages` environment. Configuration changes alone do not
   trigger a push; rerun the relevant workflow manually after changing settings.

The index workflow uses `python3 build/search.py --index-only`: it neither creates
search keys nor writes browser configuration. The Pages workflow regenerates the
tables locally for page metadata and runs Vite with the configured
search-only key; it makes no indexing requests. The browser still calls Typesense
directly, and no application server is deployed.

Each workflow serializes its own deployments. They may run concurrently when
content changes, so Pages and search updates can briefly become available at
different times. Failed imports retain the existing search alias. Previous
Typesense collections remain available for rollback and need periodic manual
cleanup. Cloud integration tests are skipped in both workflows; run those locally
with Docker Compose to avoid creating test collections on the production cluster.

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

- `web/app.jsx`: shared route tree and application provider.
- `web/pages/`: home, search, entry, and not-found route components.
- `web/components/`: layout, search results, autocomplete, and filter controls.
- `web/hooks/`: URL state, hydration, resource loading, search requests, and facets.
- `web/providers/`: shared catalog and Typesense client with retry support.
- `web/lib/`: pure search-state/catalog helpers and the Typesense HTTP client.
- `web/entry-server.jsx`: React SSR entry point shared by the build and Vite dev server.
- `web/main.jsx`: hydrates the rendered HTML with a router using the deployment base path.
- `index.html`, `search.html`, `vite.config.js`: Vite entry points and build configuration.
- `build/site.mjs`: Vite plugin coordinating development and production builds.
- `build/catalog.mjs`: validates content tables and derives filter metadata.
- `build/render.mjs`: React SSR and entry document templates; preserves source
  fragments and repairs image references.
- `build/searchdata.py`: shared search document/schema and filter metadata.
- `build/search.py`: Typesense import and public configuration writer.
- `compose.yaml`: local Typesense, one-time setup, static preview, and tests.

```sh
# Python 3.9+; integration tests skip unless Typesense credentials are set
python3 -m unittest discover -s tests -v

# Node 22.12+
npm ci
npm test
npm run build
```

The four empty source files are rendered with an explicit empty-source message.
Existing external publication links are preserved. Generated output is ignored
by Git. Vite cleans `dist/` before each build, removing obsolete entry pages and
bundles while preserving the public search configuration.

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

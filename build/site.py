#!/usr/bin/env python3
"""Build the static compendium into dist/ (Python standard library only)."""
import argparse
import html
import json
import os
import re
import shutil
from pathlib import Path
from searchdata import ROOT, catalog, load_tables


def search_form(root):
    return f'''<form class="search-form" action="{root}search.html" role="search" autocomplete="off">
<label class="sr-only" for="query">Search the compendium</label>
<div class="search-box"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
<input id="query" name="q" type="search" placeholder="Search the compendium…" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="suggestions" spellcheck="false">
<button type="submit" aria-label="Search all entries">Search <span aria-hidden="true">↗</span></button></div>
<div id="quick-panel" class="quick-panel" hidden><div id="suggestions" role="listbox" aria-label="Quick results"></div><a id="all-results" class="all-results" href="{root}search.html">View all results <span aria-hidden="true">→</span></a></div>
<p id="search-status" class="search-status" role="status"></p></form>'''


def page(title, body, root="./", mode="home"):
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)} · D&amp;D 4e</title><meta name="description" content="Search the Dungeons &amp; Dragons fourth edition compendium.">
<meta name="app-root" content="{root}"><link rel="icon" href="{root}assets/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="{root}assets/site.css"><script type="module" src="{root}assets/app.js"></script></head>
<body data-page="{mode}"><a class="skip-link" href="#main">Skip to content</a>{body}
<noscript><p class="noscript">Search requires JavaScript. Individual compendium pages can be read without it.</p></noscript></body></html>'''


def build(output, tables, content, endpoint, key, collection):
    rows = load_tables(tables)
    # Never remove an existing directory: only write the generated paths we own.
    output.mkdir(parents=True, exist_ok=True)
    assets = output / "assets"
    assets.mkdir(exist_ok=True)
    for path in (ROOT / "web").iterdir():
        if path.is_file():
            shutil.copyfile(path, assets / path.name)
    (assets / "catalog.json").write_text(json.dumps(catalog(rows), ensure_ascii=False), encoding="utf-8")
    (assets / "config.json").write_text(json.dumps({"endpoint": endpoint.rstrip("/"), "searchKey": key, "collection": collection}), encoding="utf-8")
    home = f'''<main id="main" class="home"><div class="home-inner"><h1>D&amp;D <span>4e</span><small>COMPENDIUM</small></h1>{search_form('./')}</div></main>'''
    (output / "index.html").write_text(page("Compendium", home), encoding="utf-8")
    header = f'''<header class="site-header"><a class="wordmark" href="./index.html">D&amp;D <span>4e</span><small>COMPENDIUM</small></a>{search_form('./')}</header>'''
    results = '''<main id="main" class="results-layout"><aside class="filters" aria-label="Filter results"><div class="filter-heading"><h2>Refine your search</h2><button id="clear-filters" class="text-button" type="button">Reset</button></div>
<label for="category">Category</label><select id="category"><option value="">All categories</option></select>
<div id="category-filters"></div><details class="advanced"><summary>More attributes</summary><label for="attribute">Attribute</label><select id="attribute"><option value="">Choose an attribute</option></select><div id="attribute-filter"></div></details>
<div id="active-filters" class="active-filters" aria-label="Active filters"></div></aside>
<section class="results-section" aria-label="Search results"><div class="results-heading"><div><p class="eyebrow">THE COMPENDIUM</p><h1 id="results-title">All entries</h1><p id="result-count" role="status">Loading entries…</p></div><label class="sort-label">Sort by<select id="sort"><option value="relevance">Relevance</option><option value="name">Name A–Z</option></select></label></div>
<div id="results" aria-busy="true"></div><nav id="pagination" class="pagination" aria-label="Results pages"></nav></section></main>'''
    (output / "search.html").write_text(page("Search", header + results, mode="results"), encoding="utf-8")
    shutil.copytree(ROOT / "images", output / "images", dirs_exist_ok=True)
    for row in rows:
        destination = output / "content" / row["file"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        root = "../" * (len(Path(row["file"]).parts))
        source = (content / row["file"]).read_text(encoding="utf-8-sig")
        # Source fragments reference images from the original compendium root.
        source = re.sub(r'((?:src|href)=["\'])images/', lambda m: m[1] + root + "images/", source, flags=re.I)
        source = re.sub(r'http[s]?://www\.wizards\.com/dnd/images/', root + "images/", source)
        category = html.escape(row["category"])
        body = f'''<header class="site-header detail-header"><a class="wordmark" href="{root}index.html">D&amp;D <span>4e</span><small>COMPENDIUM</small></a>{search_form(root)}</header>
<main id="main" class="entry"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="{root}search.html">Compendium</a><span>/</span><a href="{root}search.html?category={category}">{html.escape(catalog_label(row['category']))}</a></nav>
<article id="detail">{source if row['text'] else '<h1>' + html.escape(row['name']) + '</h1><p>The source file for this entry is empty.</p>'}</article>
<a class="entry-back" href="{root}search.html?category={category}">← Browse {html.escape(catalog_label(row['category']).lower())}</a></main>'''
        destination.write_text(page(row["name"], body, root, "entry"), encoding="utf-8")
    print(f"Built {len(rows):,} pages in {output}")


def catalog_label(category):
    from searchdata import LABELS, label
    return LABELS.get(category, label(category))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "dist")
    parser.add_argument("--tables", type=Path, default=ROOT / "tables")
    parser.add_argument("--content", type=Path, default=ROOT / "content")
    args = parser.parse_args()
    output = args.output.resolve()
    protected = [ROOT / name for name in ("content", "tables", "web", "build", "tests", ".git")]
    if output == ROOT or any(output == p or p in output.parents or output in p.parents for p in protected):
        parser.error("Output must be separate from source directories")
    try:
        build(output, args.tables, args.content, os.getenv("TYPESENSE_URL", ""),
              os.getenv("TYPESENSE_SEARCH_KEY", ""), os.getenv("TYPESENSE_COLLECTION", "compendium"))
    except (OSError, ValueError) as error:
        parser.exit(1, f"error: {error}\n")


if __name__ == "__main__":
    main()

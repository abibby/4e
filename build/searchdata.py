"""Shared, deterministic Typesense documents and UI metadata from the tables."""
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
LABELS = {"associate": "Associates", "background": "Backgrounds", "class": "Classes",
          "deity": "Deities", "disease": "Diseases", "epicdestiny": "Epic destinies",
          "feat": "Feats", "glossary": "Rules & glossary", "item": "Items", "monster": "Monsters",
          "paragonpath": "Paragon paths", "power": "Powers", "race": "Races", "ritual": "Rituals",
          "terrain": "Terrain", "theme": "Themes", "trap": "Traps"}
EXCLUDED = {"file", "name", "category", "text", "attributes", "variants", "level_text"}
FEATURED = "level role rank rarity item_type slot class_or_path power_type usage action tier keywords size origin creature_type power_source category_label sources".split()


def label(key):
    return {"hp": "HP", "xp": "XP", "ac": "AC", "category_label": "Type / category",
            "variant_level": "Variant level", "variant_price": "Variant price",
            "variant_enhancement": "Variant enhancement"}.get(key, key.replace("_", " ").capitalize())


def values(value):
    if value is None or value == "" or value == []:
        return []
    return [str(v) for v in value] if isinstance(value, list) else [str(value)]


def fields(row):
    result = {k: values(v) for k, v in row.items() if k not in EXCLUDED}
    for key in ("level", "price", "enhancement"):
        result["variant_" + key] = sorted({str(v[key]) for v in row.get("variants", []) if v.get(key) not in (None, "")})
    return {k: v for k, v in result.items() if v}


def load_tables(directory=ROOT / "tables"):
    paths = sorted(Path(directory).glob("*.json"))
    if not paths:
        raise ValueError("No tables found. Run python3 build/indexgen.py first.")
    rows = [row for path in paths for row in json.loads(path.read_text(encoding="utf-8"))]
    seen = set()
    for row in rows:
        path = Path(row["file"])
        if path.is_absolute() or ".." in path.parts or path.suffix.lower() != ".html":
            raise ValueError(f"Unsafe content path: {path}")
        if row["file"] in seen:
            raise ValueError(f"Duplicate content path: {path}")
        seen.add(row["file"])
    return rows


def catalog(rows):
    categories = {}
    for row in rows:
        cat = categories.setdefault(row["category"], {"label": LABELS.get(row["category"], label(row["category"])), "count": 0, "fields": {}})
        cat["count"] += 1
        for key, vals in fields(row).items():
            if not re.fullmatch(r"[a-z][a-z0-9_]*", key):
                raise ValueError(f"Invalid field name: {key}")
            info = cat["fields"].setdefault(key, {"label": label(key), "numeric": True})
            info["numeric"] &= all(re.fullmatch(r"-?\d+(?:\.\d+)?", v) is not None for v in vals)
    return {"count": len(rows), "categories": categories, "featured": FEATURED}


def document(row):
    metadata = fields(row)
    doc = {"id": hashlib.sha256(row["file"].encode()).hexdigest()[:24],
           "name": row["name"], "category": row["category"],
           "url": "content/" + quote(row["file"], safe="/"),
           "text": row["text"], "summary": row["text"][:340],
           "metadata": metadata,
           "searchable_metadata": " ".join(f"{label(k)}: {'; '.join(v)}" for k, v in metadata.items()) + " " + json.dumps(row.get("attributes", {}), ensure_ascii=False)}
    for key, vals in metadata.items():
        doc["f_" + key] = vals
        nums = [float(v) for v in vals if re.fullmatch(r"-?\d+(?:\.\d+)?", v)]
        if nums:
            doc["n_" + key] = nums
    return doc


def schema(name, metadata):
    keys = sorted({key for cat in metadata["categories"].values() for key in cat["fields"]})
    return {"name": name, "fields": [
        {"name": "name", "type": "string", "sort": True},
        {"name": "category", "type": "string", "facet": True},
        {"name": "text", "type": "string"},
        {"name": "searchable_metadata", "type": "string"},
        *[{"name": "f_" + key, "type": "string[]", "facet": True, "optional": True} for key in keys],
        *[{"name": "n_" + key, "type": "float[]", "optional": True} for key in keys],
    ]}

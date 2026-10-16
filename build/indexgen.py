#!/usr/bin/env python3
"""Build searchable JSON tables from the compendium's HTML fragments."""

import argparse
import json
import re
import sys
from bisect import bisect_left
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BLOCKS = set("h1 h2 h3 h4 p div blockquote table tr td th li ul ol".split())
VOID = set("area base br col embed hr img input link meta param source track wbr".split())


def clean(value):
    return re.sub(r"\s+", " ", value).strip()


def key(value):
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


@dataclass
class Element:
    tag: str
    attrs: dict
    start: int
    end: int = 0

    def has_class(self, name):
        return name in self.attrs.get("class", "").split()


class Document(HTMLParser):
    """Keep text offsets and explicit line boundaries, tolerating legacy markup."""

    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.length = 0
        self.elements = []
        self.stack = []
        self.feed(html)
        self.close()
        for element in self.stack:
            element.end = self.length
        self.text = "".join(self.parts)

    def append(self, text):
        self.parts.append(text)
        self.length += len(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in BLOCKS or tag in {"br", "hr"} or "trapblock" in attrs.get("class", ""):
            self.append("\n")
        # These fragments sometimes omit a paragraph/cell's closing tag.
        if tag in {"p", "td", "th", "tr"}:
            self.close_open(tag)
        element = Element(tag, attrs, self.length, self.length)
        self.elements.append(element)
        if tag not in VOID:
            self.stack.append(element)
        if tag == "img":
            src = attrs.get("src", "")
            self.append(" • " if src.endswith(("bullet.gif", "/x.gif")) else " ")

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def close_open(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i].tag == tag:
                for element in self.stack[i:]:
                    element.end = self.length
                del self.stack[i:]
                return

    def handle_endtag(self, tag):
        self.close_open(tag)
        if tag in BLOCKS:
            self.append("\n")

    def handle_data(self, data):
        if not any(e.tag in {"script", "style"} for e in self.stack):
            self.append(re.sub(r"\s+", " ", data))

    def select(self, tag=None, cls=None, within=None):
        return [e for e in self.elements
                if (tag is None or e.tag == tag)
                and (cls is None or e.has_class(cls))
                and (within is None or within.start <= e.start < within.end)]

    def value(self, element):
        return clean(self.text[element.start:element.end])

    def first(self, cls, within=None):
        matches = self.select(cls=cls, within=within)
        return self.value(matches[0]) if matches else ""


# Category-specific columns. Unusual labels remain available in `attributes`.
FIELDS = {
    "associate": "hp bloodied defenses ac fortitude reflex will speed initiative senses perception immune resist vulnerable saving_throws action_points alignment languages skills str con dex int wis cha equipment healing_surges",
    "monster": "hp bloodied ac fortitude reflex will speed initiative senses perception immune resist vulnerable saving_throws action_points regeneration alignment languages skills str con dex int wis cha equipment",
    "trap": "initiative perception trigger target attack hit miss effect countermeasures hp ac fortitude reflex will immune resist vulnerable",
    "class": "role power_source key_abilities armor_proficiencies weapon_proficiencies implement implements bonus_to_defense hit_points_at_1st_level hit_points_per_level_gained healing_surges_per_day trained_skills class_skills build_options class_features",
    "race": "average_height average_weight ability_scores size speed vision languages skill_bonuses",
    "background": "type campaign_setting prerequisite associated_skills associated_languages benefit",
    "deity": "type alignment gender sphere domain domains dominion priests adjective",
    "disease": "level attack endurance improve maintain worsen check stage_0 stage_1 stage_2 stage_3 stage_4 initial_effect final_state special",
    "epicdestiny": "prerequisite",
    "paragonpath": "prerequisite",
    "feat": "prerequisite benefit special",
    "glossary": "type category",
    "item": "category type armor weapon implement consumable enhancement_bonus critical weight cost price group damage range proficiency_bonus ac_bonus minimum_enhancement_value properties special",
    "power": "prerequisite requirement trigger target primary_target secondary_target attack primary_attack secondary_attack hit miss effect sustain special",
    "ritual": "level category component_cost market_price key_skill time duration prerequisite",
    "terrain": "type effect usage special",
    "theme": "prerequisite",
}
ALIASES = {"prerequisites": "prerequisite", "targets": "target",
           "immunity": "immune", "immunities": "immune", "resistance": "resist",
           "resistances": "resist", "vulnerability": "vulnerable",
           "vulnerabilities": "vulnerable", "ability_score": "ability_scores",
           "proficient": "proficiency_bonus"}
KNOWN_LABELS = set(" ".join(FIELDS.values()).split()) | set(ALIASES)


def attributes(doc):
    """Read labelled values without leaking across a line or another label."""
    labels = doc.select(tag="b") + doc.select(tag="strong") + doc.select(tag="i")
    labels.sort(key=lambda e: (e.start, e.end))
    starts = [e.start for e in labels]
    result = {}
    for element in labels:
        label = doc.value(element)
        label_key = key(label)
        tail = doc.text[element.end:]
        if not label or len(label) > 120:
            continue
        if label_key not in KNOWN_LABELS and not (label.endswith(":") or tail.lstrip().startswith(":")):
            continue
        end = doc.text.find("\n", element.end)
        if end < 0:
            end = len(doc.text)
        next_label = bisect_left(starts, element.end)
        if next_label < len(starts):
            end = min(end, starts[next_label])
        value = clean(doc.text[element.end:end]).strip(" :;,•")
        label_key = ALIASES.get(label_key, label_key)
        if value and value not in result.setdefault(label_key, []):
            result[label_key].append(value)
    # Some mundane equipment uses plain text instead of bold labels.
    for line in doc.text.split("\n"):
        found = re.match(r"^\s*([\w ]{1,60}):\s*(.+)$", line)
        if found:
            label_key = ALIASES.get(key(found[1]), key(found[1]))
            if label_key in KNOWN_LABELS and label_key not in result:
                result[label_key] = [clean(found[2])]
    return result


def match(pattern, text, group=1):
    found = re.search(pattern, text, re.I)
    return found.group(group).strip() if found else None


def number(value):
    return int(value.replace(",", "")) if value else None


def header_name(doc, header):
    excluded = [e for e in doc.select(within=header)
                if any(e.has_class(c) for c in ("level", "milevel", "type", "xp"))]
    position = header.start
    parts = []
    for element in sorted(excluded, key=lambda e: (e.start, -e.end)):
        if element.start >= position:
            parts.append(doc.text[position:element.start])
            position = element.end
    parts.append(doc.text[position:header.end])
    return clean(" ".join(parts))


def creature(row, doc, header):
    row["type"] = doc.first("type", header) or None
    level_text = doc.first("level", header)
    row["level_text"] = level_text or None
    row["level"] = number(match(r"\bLevel\s+(\d+)", level_text))
    row["role"] = match(r"\bLevel\s+\d+\s+(.+?)(?:\s*XP\b|$)", level_text)
    row["rank"] = match(r"\b(Elite|Solo|Minion)\b", row["role"] or "")
    row["xp"] = number(match(r"\bXP\s+([\d,]+)", level_text))
    type_text = row["type"] or ""
    row["size"] = match(r"^(Tiny|Small|Medium|Large|Huge|Gargantuan)\b", type_text)
    row["origin"] = match(r"\b(aberrant|elemental|fey|immortal|natural|shadow)\b", type_text)
    row["creature_type"] = match(r"\b(animate|beast|humanoid|magical beast)\b", type_text)
    keywords = match(r"\(([^)]+)\)", type_text)
    row["keywords"] = [clean(v) for v in keywords.split(",")] if keywords else []
    if row["category"] == "associate":
        row["associate_type"] = level_text or None


def power(row, doc, header):
    # Only the primary power contributes top-level metadata; additional techniques
    # are preserved in attributes and full text.
    level_text = doc.first("level", header)
    row["level_text"] = level_text or None
    row["level"] = number(match(r"(\d+)\s*$", level_text))
    row["power_type"] = match(r"\b(Attack|Utility|Feature)\b", level_text)
    row["class_or_path"] = match(r"^(.*?)\s+(?:Attack|Utility|Feature)\b", level_text) or level_text or None
    next_header = next((e.start for e in doc.select(tag="h1") if e.start > header.start), len(doc.text))
    blocks = [e for e in doc.select(cls="powerstat") if header.end <= e.start < next_header]
    row.update(usage=None, action=None, range=None, keywords=[])
    if blocks:
        lines = [clean(v) for v in doc.text[blocks[0].start:blocks[0].end].split("\n") if clean(v)]
        if lines:
            row["usage"] = match(r"^(At-Will|Encounter|Daily)", lines[0])
            if "•" in lines[0]:
                row["keywords"] = [clean(v) for v in re.split(r"[,;]", lines[0].split("•", 1)[1]) if clean(v)]
        if len(lines) > 1:
            row["action"] = match(r"^(Standard Action|Move Action|Minor Action|Free Action|No Action|Immediate Interrupt|Immediate Reaction|Opportunity Action)", lines[1])
            row["range"] = clean(lines[1][len(row["action"] or ""):]) or None


def item(row, doc, header):
    level_text = doc.first("milevel", header) or doc.first("level", header)
    row["level_text"] = level_text or None
    row["level"] = number(match(r"\bLevel\s+(\d+)", level_text))
    row["rarity"] = match(r"\b(Uncommon|Common|Rare|Artifact)\b", level_text)
    row["variants"] = []
    for table in doc.select(tag="table", cls="magicitem"):
        cells = doc.select(tag="td", within=table)
        for i, cell in enumerate(cells):
            level = match(r"^Lvl\s+(\d+)$", doc.value(cell))
            if level and i + 2 < len(cells):
                row["variants"].append({"level": int(level), "enhancement": doc.value(cells[i + 1]),
                                        "price": doc.value(cells[i + 2])})
    row["variants"].sort(key=lambda v: v["level"])
    stats = doc.select(cls="mistat")
    if stats:
        first = doc.value(stats[0])
        row["item_type"] = match(r"^([^:]+):", first) or match(r"^(.*?)(?:\s+[\d,]+\s+[gsc]p|$)", first)
        row["slot"] = match(r"\b(Arms|Feet|Hands|Head|Neck|Ring|Waist) Slot\b", first)
        if not row.get("price"):
            row["price"] = match(r"([\d,]+\s+[gsc]p)\b", first)
    else:
        row["item_type"] = row.get("type") or row.get("category_label")
        row["slot"] = None
    # Equipment properties/groups often start on the line AFTER their label.
    for field in ("properties", "group"):
        for label in doc.select(tag="b"):
            if key(doc.value(label)) != field or row.get(field):
                continue
            boundaries = [e.start for e in doc.elements if e.start >= label.end
                          and (e.tag in {"b", "h1", "h2"} or e.has_class("publishedIn"))]
            end = min(boundaries, default=len(doc.text))
            row[field] = clean(doc.text[label.end:end]).strip(" :") or None
    for section in ("Property", "Properties"):
        values = []
        headings = doc.select(tag="h2")
        for i, heading in enumerate(headings):
            if doc.value(heading) == section:
                end = headings[i + 1].start if i + 1 < len(headings) else len(doc.text)
                sources = doc.select(cls="publishedIn")
                if sources:
                    end = min(end, sources[0].start)
                values.append(clean(doc.text[heading.end:end]))
        if values:
            row["properties"] = " | ".join(values)


def trap(row, doc):
    headings = [e for e in doc.elements if e.has_class("trapblocktitle") or e.tag == "h2"]
    sources = doc.select(cls="publishedIn")
    for i, heading in enumerate(headings):
        field = key(doc.value(heading))
        end = headings[i + 1].start if i + 1 < len(headings) else len(doc.text)
        if sources:
            end = min(end, sources[0].start)
        value = clean(doc.text[heading.end:end]).strip(" •")
        if value:
            row["attributes"].setdefault(field, []).append(value)
            if field in FIELDS["trap"].split() and not row.get(field):
                row[field] = value


def parse_resource(path, category, content_root):
    doc = Document(path.read_text(encoding="utf-8-sig"))
    headers = doc.select(tag="h1")
    header = headers[0] if headers else Element("h1", {}, 0, 0)
    attrs = attributes(doc)
    # Metadata must come from the resource, not powers embedded later on the page.
    metadata_end = headers[1].start if len(headers) > 1 else len(doc.text)
    # Filter by text offsets without reparsing/truncating HTML.
    primary_doc = Document("")
    primary_doc.text = doc.text[:metadata_end]
    primary_doc.elements = [e for e in doc.elements if e.end <= metadata_end]
    primary_attrs = attributes(primary_doc)
    row = {
        "file": path.relative_to(content_root).as_posix(),
        "name": header_name(doc, header) or path.stem,
        "category": category,
    }
    for field in FIELDS.get(category, "").split():
        values = primary_attrs.get(field, [])
        row["category_label" if field == "category" else field] = " | ".join(values) or None
    if category in {"monster", "associate", "trap"}:
        creature(row, doc, header)
    elif category == "power":
        power(row, doc, header)
    elif category == "item":
        item(row, doc, header)
    elif category == "disease":
        row["level"] = number(match(r"\bLevel\s+(\d+)", doc.first("level", header)))
    elif category == "feat":
        row["keywords"] = re.findall(r"\[([^\]]+)\]", row["name"])
        row["tier"] = next((match(r"^(Heroic|Paragon|Epic) Tier$", doc.value(e))
                            for e in doc.select(tag="b")
                            if match(r"^(Heroic|Paragon|Epic) Tier$", doc.value(e))), None)
    if category == "class":
        for field in ("role", "power_source"):
            if row[field]:
                row[field] = row[field].split(".", 1)[0]
    if category == "ritual" and row["level"] and row["level"].isdigit():
        row["level"] = int(row["level"])
    if category in {"monster", "associate", "trap"}:
        for field in ("hp", "bloodied", "ac", "fortitude", "reflex", "will", "initiative", "perception", "action_points"):
            value = row.get(field)
            if value and re.fullmatch(r"[+-]?\d+", value):
                row[field] = int(value)
    sources = doc.select(cls="publishedIn")
    row["sources"] = list(dict.fromkeys(doc.value(e).removeprefix("Published in ") for e in sources))
    row["attributes"] = attrs
    if category == "trap":
        trap(row, doc)
    row["text"] = clean(doc.text)
    return row


def build_tables(content_root, output_root, categories=None):
    content_root = content_root.resolve()
    output_root = output_root.resolve()
    if output_root == content_root or content_root in output_root.parents:
        raise ValueError("Output must be outside the source content directory")
    folders = {p.name: p for p in sorted(content_root.iterdir()) if p.is_dir()}
    selected = sorted(set(categories or folders))
    unknown = set(selected) - folders.keys()
    if unknown:
        raise ValueError("Unknown content folders: " + ", ".join(sorted(unknown)))
    output_root.mkdir(parents=True, exist_ok=True)
    counts = {}
    for category in selected:
        rows = []
        for path in sorted(folders[category].rglob("*")):
            if path.is_file() and path.suffix.lower() == ".html" and path.name.lower() != "index.html":
                try:
                    row = parse_resource(path, category, content_root)
                    rows.append(row)
                    if not row["text"]:
                        print(f"warning: {path} has no visible text; retaining an empty record", file=sys.stderr)
                except Exception as error:
                    raise ValueError(f"Could not parse {path}: {error}") from error
        destination = output_root / f"{category}.json"
        temporary = destination.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temporary.replace(destination)
        counts[category] = len(rows)
        print(f"{category}: {len(rows):,} resources -> {destination}")
    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("categories", nargs="*", help="Content folders to build (default: all)")
    parser.add_argument("--content", type=Path, default=ROOT / "public/content", help="Source directory")
    parser.add_argument("--output", type=Path, default=ROOT / "tables", help="Generated JSON directory")
    args = parser.parse_args()
    try:
        counts = build_tables(args.content, args.output, args.categories)
    except (OSError, ValueError) as error:
        parser.exit(1, f"error: {error}\n")
    print(f"Built {sum(counts.values()):,} resources in {len(counts)} tables.")


if __name__ == "__main__":
    main()

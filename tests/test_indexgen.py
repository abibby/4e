import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest

from build.indexgen import ROOT, Document, attributes, build_tables, parse_resource


class ExtractorTests(unittest.TestCase):
    def resource(self, category, name):
        return parse_resource(ROOT / "content" / category / f"{name}.html", category, ROOT / "content")

    def test_old_monster_stats(self):
        row = self.resource("monster", "'Mother' Bone Naga")
        self.assertEqual(row["name"], "'Mother' Bone Naga")
        self.assertEqual((row["level"], row["role"], row["rank"], row["xp"]), (16, "Elite Controller", "Elite", 2800))
        self.assertEqual((row["hp"], row["ac"], row["will"]), (328, 32, 29))
        self.assertEqual(row["keywords"], ["undead"])
        self.assertEqual(row["creature_type"], "magical beast")

    def test_table_monster_stats(self):
        row = self.resource("monster", "Goblin Cutthroat")
        self.assertEqual((row["hp"], row["ac"], row["perception"]), (30, 15, 2))
        self.assertEqual(row["languages"], "Common, Goblin")
        self.assertIn("Low-light vision", row["text"])

    def test_missing_level_is_not_skipped(self):
        row = self.resource("monster", "Amber Monkey")
        self.assertIsNone(row["level"])
        self.assertEqual(row["hp"], 27)
        self.assertEqual(row["initiative"], "as conjurer")

    def test_item_variants(self):
        row = self.resource("item", "Flaming Weapon")
        self.assertEqual(row["name"], "Flaming Weapon")
        self.assertEqual((row["level"], row["rarity"], row["weapon"]), (5, "Uncommon", "Any"))
        self.assertEqual([v["level"] for v in row["variants"]], [5, 10, 15, 20, 25, 30])
        self.assertEqual(row["variants"][-1]["price"], "3,125,000 gp")

    def test_plain_equipment_fields(self):
        row = self.resource("item", "Accurate dagger")
        self.assertEqual((row["cost"], row["range"], row["proficiency_bonus"]), ("25 gp", "5/10", "+3"))
        self.assertIn("Accurate", row["properties"])
        self.assertTrue(row["group"].startswith("Light blade"))

    def test_empty_source_retains_schema(self):
        row = self.resource("item", "Raven Tens")
        self.assertEqual(row["name"], "Raven Tens")
        self.assertEqual(row["text"], "")
        self.assertIsNone(row["level"])
        self.assertEqual(row["variants"], [])

    def test_trap_section_fields(self):
        row = self.resource("trap", "Abyssal Breach")
        self.assertIn("rolls initiative", row["trigger"])
        self.assertIn("No check is necessary", row["perception"])
        self.assertIn("DC 21", row["attributes"]["arcana"][0])

    def test_multi_technique_power(self):
        row = self.resource("power", "A Feather's Weight [Attack Technique]")
        self.assertEqual(row["name"], "A Feather's Weight [Attack Technique]")
        self.assertEqual((row["level"], row["class_or_path"], row["power_type"]), (17, "Monk", "Attack"))
        self.assertEqual((row["usage"], row["action"], row["range"]), ("Encounter", "Standard Action", "Melee touch"))
        self.assertEqual(row["keywords"], ["Full Discipline", "Implement", "Psionic"])
        self.assertIn("Movement Technique", row["text"])

    def test_class_metadata_and_embedded_powers(self):
        row = self.resource("class", "Ardent")
        self.assertEqual((row["name"], row["role"], row["power_source"]), ("Ardent", "Leader", "Psionic"))
        self.assertEqual(row["key_abilities"], "Charisma, Constitution, Wisdom")
        self.assertIn("Arcana (Int)", row["class_skills"])

    def test_other_categories(self):
        self.assertEqual(self.resource("background", "Aberrant Slayer")["associated_skills"], "Dungeoneering, Perception")
        self.assertEqual(self.resource("deity", "Abbathor")["alignment"], "Evil")
        self.assertEqual(self.resource("disease", "Blinding Sickness")["level"], 9)
        self.assertEqual(self.resource("epicdestiny", "Adamantine Soldier")["prerequisite"], "21st level, fighter or warlord")
        self.assertEqual(self.resource("feat", "Aberrant Mark of Contagion")["tier"], "Heroic")
        self.assertIn("damage type", self.resource("glossary", "Acid")["text"])
        self.assertEqual(self.resource("paragonpath", "Abiding Reaper")["prerequisite"], "Shadar-kai")
        self.assertEqual(self.resource("race", "Bladeling")["size"], "Medium")
        ritual = self.resource("ritual", "Aberrant Totemic Link")
        self.assertEqual((ritual["level"], ritual["category_label"], ritual["key_skill"]), (13, "Divination", "Dungeoneering"))
        self.assertIn("4 contiguous squares", self.resource("terrain", "Abyssal Wellspring")["effect"])
        self.assertIn("beguiler_starting_feature_1st_level", self.resource("theme", "Beguiler")["attributes"])
        self.assertEqual(self.resource("trap", "Abyssal Breach")["xp"], 700)
        self.assertEqual(self.resource("associate", "Air Archon Grunt")["hp"], "your bloodied value")

    def test_entities_repeated_labels_and_boundaries(self):
        doc = Document('<h1>A &amp; B</h1><p><b>Target:</b> one<br><b>Target</b>: two</p>'
                       '<p><b>HP</b> 20; <b>AC</b> 15</p><script>hidden()</script>')
        self.assertEqual(attributes(doc), {"target": ["one", "two"], "hp": ["20"], "ac": ["15"]})
        self.assertNotIn("hidden()", doc.text)
        self.assertIn("A & B", doc.text)

    def test_build_discovery_selection_and_determinism(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "content"
            (source / "custom" / "nested").mkdir(parents=True)
            (source / "empty").mkdir()
            (source / "custom" / "index.html").write_text("navigation")
            (source / "custom" / "index.json").write_text("[]")
            (source / "custom" / "nested" / "A.html").write_text("<h1>A</h1><p>Hello</p>")
            output = root / "tables"
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(build_tables(source, output), {"custom": 1, "empty": 0})
                before = (output / "custom.json").read_bytes()
                build_tables(source, output, ["custom"])
            self.assertEqual((output / "custom.json").read_bytes(), before)
            self.assertEqual(json.loads(before)[0]["file"], "custom/nested/A.html")
            self.assertEqual(json.loads((output / "empty.json").read_text()), [])
            with self.assertRaisesRegex(ValueError, "Unknown content folders"):
                build_tables(source, output, ["missing"])
            with self.assertRaisesRegex(ValueError, "outside"):
                build_tables(source, source)


if __name__ == "__main__":
    unittest.main()

"""Contract tests for generated URLs, mixed metadata, and atomic imports."""
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'build'))
from searchdata import catalog, document, load_tables, schema
from search import Client, import_rows
import importlib.util
spec = importlib.util.spec_from_file_location('site_build', Path(__file__).resolve().parents[1] / 'build/site.py')
site_build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(site_build)


def fixture():
    return {'name': "Wizard's #1 + Sword", 'category': 'item', 'file': "item/Wizard's #1 + Sword.html",
            'text': 'A magic sword', 'sources': ['Book, page 1'], 'level': 1, 'price': '100 gp',
            'variants': [{'level': 1, 'enhancement': '+1', 'price': '100 gp'},
                         {'level': 6, 'enhancement': '+2', 'price': '1800 gp'}],
            'attributes': {'effect': ['teleport']}}


class StaticSiteTests(unittest.TestCase):
    def test_document_preserves_identity_and_variants(self):
        row = fixture(); doc = document(row)
        self.assertIn('%23', doc['url']); self.assertIn('%2B', doc['url'])
        self.assertEqual(doc['n_variant_level'], [1., 6.])
        self.assertEqual(doc['f_price'], ['100 gp'])
        self.assertIn('teleport', doc['searchable_metadata'])
        self.assertEqual(doc['id'], document(row)['id'])
        self.assertNotEqual(doc['id'], document({**row, 'file': 'item/another.html'})['id'])

    def test_mixed_numeric_fields_stay_filterable(self):
        rows = [fixture(), {**fixture(), 'level': 'Your level', 'file': 'item/other.html'}]
        self.assertFalse(catalog(rows)['categories']['item']['fields']['level']['numeric'])
        self.assertEqual(document(rows[1])['f_level'], ['Your level'])
        self.assertNotIn('n_level', document(rows[1]))
        self.assertTrue(all(f.get('optional') for f in schema('test', catalog(rows))['fields'] if f['name'].startswith(('n_', 'f_'))))

    def test_static_pages_and_relative_assets(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); tables = root / 'tables'; tables.mkdir()
            content = root / 'content'; (content / 'item').mkdir(parents=True)
            row = fixture()
            (tables / 'item.json').write_text(json.dumps([row]))
            (content / row['file']).write_text('<h1>Magic sword</h1><img src="images/bullet.gif">')
            output = root / 'dist'
            site_build.build(output, tables, content, 'https://search.example', 'public-key', 'compendium')
            page = (output / 'content' / row['file']).read_text()
            self.assertIn('src="../../images/bullet.gif"', page)
            self.assertIn('href="../../assets/site.css"', page)
            self.assertIn('Wizard&#x27;s #1 + Sword', page)
            config = json.loads((output / 'assets/config.json').read_text())
            self.assertEqual(config['searchKey'], 'public-key')
            self.assertTrue((output / 'search.html').exists())
            site_build.build(output, tables, content, 'http://internal:8108', '', 'compendium')
            self.assertEqual(json.loads((output / 'assets/config.json').read_text()), config)

    def test_unsafe_or_duplicate_table_paths_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            table = Path(temporary) / 'item.json'
            for rows in [[{**fixture(), 'file': '../secret.html'}], [fixture(), fixture()]]:
                table.write_text(json.dumps(rows))
                with self.assertRaises(ValueError): load_tables(Path(temporary))

    def test_failed_import_does_not_switch_alias(self):
        class FakeClient:
            def __init__(self): self.calls = []
            def request(self, method, path, data=None, raw=False):
                self.calls.append((method, path))
                return '{"success":false,"error":"bad field"}' if raw else {}
        client = FakeClient()
        with self.assertRaises(RuntimeError): import_rows(client, [fixture()], 'test')
        self.assertFalse(any(path.startswith('/aliases') for _, path in client.calls))


@unittest.skipUnless(os.getenv('TYPESENSE_URL') and os.getenv('TYPESENSE_ADMIN_KEY'), 'Set Typesense environment variables or use Docker Compose for integration tests')
class TypesenseIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import uuid
        cls.client = Client(os.environ['TYPESENSE_URL'], os.environ['TYPESENSE_ADMIN_KEY'])
        cls.alias = 'test_' + uuid.uuid4().hex[:10]
        cls.collection = import_rows(cls.client, [fixture()], cls.alias)
        cls.key = cls.client.request('POST', '/keys', {'description': 'integration test', 'actions': ['documents:search'], 'collections': [cls.alias]})
        cls.public = Client(os.environ['TYPESENSE_URL'], cls.key['value'])

    @classmethod
    def tearDownClass(cls):
        cls.client.request('DELETE', '/keys/' + str(cls.key['id']))
        cls.client.request('DELETE', '/aliases/' + cls.alias)
        cls.client.request('DELETE', '/collections/' + cls.collection)

    def test_search_facets_ranges_and_search_only_key(self):
        from urllib.parse import urlencode
        params = {'q': 'sword', 'query_by': 'name,searchable_metadata,text', 'facet_by': 'f_price',
                  'filter_by': 'category:=`item` && n_variant_level:>=6 && f_price:=`100 gp`'}
        result = self.public.request('GET', f'/collections/{self.alias}/documents/search?' + urlencode(params))
        self.assertEqual(result['found'], 1)
        self.assertEqual(result['facet_counts'][0]['counts'][0]['value'], '100 gp')
        with self.assertRaises(RuntimeError):
            self.public.request('DELETE', '/collections/' + self.collection)

    def test_variant_range_requires_one_matching_value(self):
        from urllib.parse import urlencode
        params = {'q': '*', 'query_by': 'name', 'filter_by': 'n_variant_level:[2..5]'}
        result = self.public.request('GET', f'/collections/{self.alias}/documents/search?' + urlencode(params))
        self.assertEqual(result['found'], 0)

    def test_full_text_metadata_and_zero_results(self):
        for query, count in [('teleport', 1), ('zzzznonexistent', 0)]:
            result = self.public.request('GET', f'/collections/{self.alias}/documents/search?q={query}&query_by=name,searchable_metadata,text')
            self.assertEqual(result['found'], count)


if __name__ == '__main__': unittest.main()

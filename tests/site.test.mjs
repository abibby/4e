import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {publicConfig} from '../build/site.mjs';
import {catalog, loadTables} from '../build/catalog.mjs';
import {createRenderer, entryPage, renderPage} from '../build/render.mjs';
import {safeEntryURL} from '../web/lib/urls.js';

const fixture = {name: "Wizard's #1 + Sword", category: 'item', file: "item/Wizard's #1 + Sword.html",
  text: 'A magic sword', sources: ['Book, page 1'], level: 1, price: '100 gp', attributes: {effect: ['teleport']},
  variants: [{level: 1, enhancement: '+1', price: '100 gp'}, {level: 6, enhancement: '+2', price: '1800 gp'}]};

test('React SSR renders page shells without browser globals and keeps nested links relative', async () => {
  const renderer = await createRenderer(fileURLToPath(new URL('..', import.meta.url)));
  try {
    const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const home = renderPage(template, {root: './', pathname: '/index.html'}, renderer.render);
    assert.match(home, /<div id="root"><main id="main" class="home">/);
    assert.match(home, /<h1>D&amp;D <span>4e<\/span>/);
    assert.match(home, /action="\.\/search.html"/);
    assert.match(home, /<link rel="stylesheet"/);
    const entry = entryPage(template, fixture, '<h1>Magic sword</h1>', renderer.render);
    assert.match(entry, /<div id="root"><header class="site-header detail-header">/);
    assert.match(entry, /class="wordmark" href="\.\.\/\.\.\/index.html"/);
    assert.match(entry, /action="\.\.\/\.\.\/search.html"/);
    assert.match(entry, /<article id="detail"><h1>Magic sword<\/h1>/);
    const search = renderer.render({root: './', pathname: '/search.html?q=fire&category=power'}, renderer.render);
    assert.match(search, /Enable JavaScript to search and filter entries/);
    assert.match(search, /aria-busy="false"/);
    assert.doesNotMatch(search, /Loading entries|Searching the compendium/);
    assert.equal(renderer.render({root: './', pathname: '/search.html'}), search);
    assert.equal(renderer.render({root: './', pathname: '/'}), renderer.render({root: './', pathname: '/index.html'}));
    assert.match(renderer.render({root: './', pathname: '/missing.html'}), /Page not found/);
  } finally { await renderer.close(); }
});

test('entry pages retain static rules and rebase bundled assets and legacy images at any depth', () => {
  const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
    .replace('/web/main.jsx', './assets/main-123.js').replace('/web/icon.svg', './assets/icon-123.svg');
  const page = entryPage(template, {...fixture, file: `item/nested/${fixture.name}.html`},
    '<h1>Magic sword</h1><img src="images/bullet.gif"><img src="http://www.wizards.com/dnd/images/star.gif"><p>$&</p>');
  assert.match(page, /name="app-root" content="\.\.\/\.\.\/\.\.\/"/);
  assert.match(page, /src="\.\.\/\.\.\/\.\.\/assets\/main-123.js"/);
  assert.match(page, /src="\.\.\/\.\.\/\.\.\/images\/bullet.gif"/);
  assert.match(page, /src="\.\.\/\.\.\/\.\.\/images\/star.gif"/);
  assert.match(page, /Wizard&#39;s #1 \+ Sword/);
  assert.match(page, /<article id="detail"><h1>Magic sword<\/h1>/);
  assert.match(page, /<p>\$&<\/p>/);
  assert.match(entryPage(template, {...fixture, text: ''}, ''), /The source file for this entry is empty/);
});

test('catalog preserves filter contracts, mixed numeric fields and variants', () => {
  const data = catalog([fixture, {...fixture, level: 'Your level'}]);
  assert.equal(data.count, 2);
  assert.equal(data.categories.item.label, 'Items');
  assert.equal(data.categories.item.fields.level.numeric, false);
  assert.equal(data.categories.item.fields.variant_level.numeric, true);
  assert.equal(data.categories.item.fields.variant_price.numeric, false);
  assert.equal(data.categories.item.fields.attributes, undefined);
});

test('table loading rejects traversal and duplicate destinations', () => {
  const directory = mkdtempSync(path.join(tmpdir(), '4e-tables-'));
  try {
    assert.throws(() => loadTables(directory), /No tables/);
    for (const file of ['../secret.html', '/secret.html', 'item/../../secret.html', 'item/../secret.html', 'item\\secret.html']) {
      writeFileSync(path.join(directory, 'item.json'), JSON.stringify([{...fixture, file}]));
      assert.throws(() => loadTables(directory), /Unsafe content path/);
    }
    writeFileSync(path.join(directory, 'item.json'), JSON.stringify([fixture, fixture]));
    assert.throws(() => loadTables(directory), /Duplicate content path/);
    writeFileSync(path.join(directory, 'item.json'), JSON.stringify([fixture]));
    assert.deepEqual(loadTables(directory), [fixture]);
  } finally { rmSync(directory, {recursive: true, force: true}); }
});

test('public configuration preserves an indexed key on rebuild and excludes the admin key', () => {
  const config = publicConfig({TYPESENSE_URL: 'http://internal:8108', TYPESENSE_PUBLIC_URL: 'https://search.example/',
    TYPESENSE_SEARCH_KEY: 'public-key', TYPESENSE_ADMIN_KEY: 'private-key'});
  assert.deepEqual(config, {endpoint: 'https://search.example', searchKey: 'public-key', collection: 'compendium'});
  assert.deepEqual(publicConfig({TYPESENSE_URL: 'http://internal:8108'}, config), config);
  assert.throws(() => publicConfig({TYPESENSE_SEARCH_KEY: 'private', TYPESENSE_ADMIN_KEY: 'private'}), /must differ/);
});

test('entry URLs retain punctuation and subdirectory deployment while rejecting external paths', () => {
  const root = new URL('https://example.com/4e/');
  assert.equal(safeEntryURL('content/item/Wizard%27s%20%231%20%2B%20Sword.html', root),
    'https://example.com/4e/content/item/Wizard%27s%20%231%20%2B%20Sword.html');
  for (const url of ['https://other.example/content/test.html', '../content/test.html', 'javascript:alert(1)', 'http://[']) {
    assert.equal(safeEntryURL(url, root), 'https://example.com/4e/search.html');
  }
});

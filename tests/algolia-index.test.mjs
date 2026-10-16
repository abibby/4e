import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { algoliasearch } from 'algoliasearch';
import { buildRecords, chunkRecord, fieldsFor, htmlToText, tagsFor, uploadRecords } from '../build/algolia.ts';

const row = { file: 'power/test.html', name: 'Test', category: 'power' };

test('extracts readable HTML text, decodes entities, and excludes scripts and comments', () => {
  assert.equal(htmlToText('<h1>Magic &amp; Ice</h1><p>cold<b>er</b>&nbsp;now<br>next &#x1F525;</p><!-- hidden --><script>secret</script><style>hidden</style>'),
    'Magic & Ice colder now next 🔥');
  assert.equal(htmlToText('<p>Daily <img src="images/bullet.gif"> Fire</p>'), 'Daily • Fire');
});

test('tags retain explicit tags, structured arrays, zero values, and item variants', () => {
  assert.deepEqual(tagsFor({
    ...row, tags: ['custom', 'custom'], _tags: ['existing'], level: 0,
    keywords: ['Fire', 'Cold', 'Fire'], role: null, languages: 'Common',
    variants: [{ level: 5, price: '1,000 gp', enhancement: '+1' }],
  }, ['languages']), [
    'category:power', 'custom', 'existing', 'keywords:Cold', 'keywords:Fire',
    'languages:Common', 'level:0', 'variant_enhancement:+1', 'variant_level:5', 'variant_price:1,000 gp',
  ]);
});

test('filter fields preserve numbers, booleans, arrays, and variant values', () => {
  assert.deepEqual(fieldsFor({
    ...row, level: 0, keywords: ['Fire', 'Cold', 'Fire'], role: null,
    languages: ['Common'], enabled: false, tags: ['custom'],
    variants: [{ level: 5, price: '1,000 gp', enhancement: '+1' }, { level: 5 }],
  }), {
    ...row, level: 0, keywords: ['Fire', 'Cold'], languages: ['Common'], enabled: false, tags: ['custom'],
    variant_level: [5], variant_price: ['1,000 gp'], variant_enhancement: ['+1'],
  });
  for (const field of ['text', 'objectID', '_tags', 'tags', 'filterOnly(level)']) {
    assert.throws(() => fieldsFor(row, [field]), /Invalid filter field/);
  }
});

test('chunks preserve Unicode text and tags within the serialized byte limit', () => {
  const text = 'Magic 🔥 "fire" \\ ice '.repeat(3000);
  const base = { ...row, text, level: 5, keywords: ['Fire'], _tags: ['category:power'] };
  const chunks = chunkRecord(base);
  assert.ok(chunks.length > 1);
  assert.equal(new Set(chunks.map(chunk => chunk.objectID)).size, chunks.length);
  let reconstructed = chunks[0].text;
  for (let i = 0; i < chunks.length; i++) {
    assert.ok(Buffer.byteLength(JSON.stringify(chunks[i])) < 9000);
    assert.ok(chunks[i].text.isWellFormed());
    assert.deepEqual(chunks[i]._tags, base._tags);
    assert.equal(chunks[i].level, 5);
    assert.deepEqual(chunks[i].keywords, ['Fire']);
    if (i) {
      assert.equal(Array.from(chunks[i - 1].text).slice(-200).join(''), Array.from(chunks[i].text).slice(0, 200).join(''));
      reconstructed += Array.from(chunks[i].text).slice(200).join('');
    }
  }
  assert.equal(reconstructed, text);
  assert.deepEqual(chunkRecord(base), chunks);
  assert.throws(() => chunkRecord({ ...base, _tags: ['x'.repeat(9000)] }), /Metadata is too large/);
});

test('joins by relative path, reads current HTML, skips navigation, and rejects missing metadata', async t => {
  const directory = await mkdtemp(join(tmpdir(), '4e-algolia-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const content = join(directory, 'content');
  const tables = join(directory, 'tables');
  await mkdir(join(content, 'power'), { recursive: true });
  await mkdir(tables);
  await writeFile(join(content, row.file), '<h1>Current HTML</h1><p>New searchable content</p>');
  await writeFile(join(content, 'power/index.html'), 'navigation');
  await writeFile(join(tables, 'power.json'), JSON.stringify([{ ...row, text: 'stale', level: 1, range: 'Melee 1', attack: 'Strength vs. AC' }]));
  const records = await buildRecords(content, tables);
  assert.equal(records.length, 1);
  assert.equal(records[0].file, row.file);
  assert.equal(records[0].text, 'Current HTML New searchable content');
  assert.equal(records[0].level, 1);
  assert.equal(records[0].category, 'power');
  assert.equal(records[0].range, 'Melee 1');
  assert.equal(records[0].attack, 'Strength vs. AC');
  assert.deepEqual(records[0]._tags, ['category:power', 'level:1']);
  await writeFile(join(content, 'power/missing.html'), 'missing');
  await assert.rejects(buildRecords(content, tables), /Missing table metadata for power\/missing.html/);
});

function fakeClient(failBatch = false) {
  const requests = [];
  const client = algoliasearch('EXAMPLE', 'test-only', { requester: {
    async send(request) {
      const body = request.data ? JSON.parse(request.data) : undefined;
      const url = new URL(request.url).pathname;
      requests.push({ url, method: request.method, body });
      const failed = failBatch && url.endsWith('/batch');
      return {
        status: failed ? 403 : 200,
        content: JSON.stringify(failed ? { message: 'Denied', status: 403 } : { taskID: 1, status: 'published', objectIDs: [] }),
        isTimedOut: false,
      };
    },
  } });
  return { client, requests };
}

test('SDK uploads to a temporary index and waits for records before moving it', async () => {
  const { client, requests } = fakeClient();
  await uploadRecords(client, 'compendium', chunkRecord({
    ...row, text: 'Hello', level: 5, languages: ['Common'], keywords: ['Fire'], variant_level: [5], _tags: ['category:power'],
  }));
  assert.deepEqual(requests.map(request => request.url.split('/').at(-1)),
    ['settings', '1', 'batch', '1', 'operation', '1']);
  assert.equal(requests[0].body.attributeForDistinct, 'file');
  const facets = requests[0].body.attributesForFaceting;
  for (const field of ['category', 'level', 'keywords', 'variant_level', 'languages', 'file', 'name']) {
    assert.ok(facets.includes(`filterOnly(${field})`));
  }
  for (const field of ['objectID', 'text', '_tags']) {
    assert.ok(!facets.includes(`filterOnly(${field})`));
  }
  assert.match(requests[2].url, /compendium_tmp_[^/]+\/batch$/);
  assert.equal(requests[2].body.requests[0].body.objectID, 'power/test.html#0');
  assert.equal(requests[2].body.requests[0].body.level, 5);
  assert.deepEqual(requests[2].body.requests[0].body.languages, ['Common']);
  assert.deepEqual(requests[4].body, { operation: 'move', destination: 'compendium' });
  assert.match(requests[5].url, /\/compendium\/task\/1$/);
});

test('a failed batch never replaces the live index', async () => {
  const { client, requests } = fakeClient(true);
  await assert.rejects(uploadRecords(client, 'compendium', chunkRecord({ ...row, text: 'Hello', _tags: [] })),
    error => error.status === 403);
  assert.ok(!requests.some(request => request.url.endsWith('/operation')));
});

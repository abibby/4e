import assert from 'node:assert/strict';
import { test } from 'node:test';
import { algoliasearch } from 'algoliasearch';
import { AlgoliaSearch } from '../src/search/algolia.ts';

const config = { applicationId: 'EXAMPLE', searchKey: 'search-only', indexName: '4e test' };
const empty = { hits: [], nbHits: 0, page: 0, hitsPerPage: 20, nbPages: 0 };

function withRequester(send) {
  return new AlgoliaSearch(config, algoliasearch(config.applicationId, config.searchKey, {
    requester: { send },
  }));
}
const response = (body, status = 200) => ({ status, content: JSON.stringify(body), isTimedOut: false });

test('SDK sends full text and literal AND tags and maps results', async () => {
  const client = withRequester(async request => {
    assert.match(request.url, /\/1\/indexes\/4e%20test\/query/);
    assert.equal(request.headers['x-algolia-api-key'], 'search-only');
    const body = JSON.parse(request.data);
    assert.equal(body.query, 'ongoing fire');
    assert.deepEqual(body.tagFilters, ['category:monster', 'level:1', 'sources:A, B ("C")']);
    assert.equal(body.distinct, 1);
    assert.equal(body.page, 2);
    assert.equal(body.hitsPerPage, 10);
    return response({
      hits: [{ objectID: 'chunk:2', file: 'monster/Test.html', name: 'Test', category: 'monster', text: 'A'.repeat(500), _tags: ['level:1'] }],
      nbHits: 42, page: 2, hitsPerPage: 10, nbPages: 5,
    });
  });
  const result = await client.search({ query: 'ongoing fire', tags: ['category:monster', 'level:1', 'level:1', 'sources:A, B ("C")'], page: 2, pageSize: 10 });
  assert.equal(result.hits[0].id, 'monster/Test.html');
  assert.equal(result.hits[0].summary.length, 340);
  assert.deepEqual(result.hits[0].tags, ['level:1']);
  assert.equal(result.total, 42);
  assert.equal(result.pageCount, 5);
});

test('supports tag-only searches and browsing without filters', async () => {
  const bodies = [];
  const client = withRequester(async request => {
    bodies.push(JSON.parse(request.data));
    return response(empty);
  });
  assert.deepEqual((await client.search({ tags: ['keywords:undead'] })).hits, []);
  await client.search({});
  assert.equal(bodies[0].query, '');
  assert.deepEqual(bodies[0].tagFilters, ['keywords:undead']);
  assert.deepEqual(bodies[1].tagFilters, []);
});

test('propagates Algolia SDK errors', async () => {
  const client = withRequester(async () => response({ message: 'Invalid API key', status: 403 }, 403));
  await assert.rejects(client.search({}), error => error.message === 'Invalid API key' && error.status === 403);
});

test('validates configuration and pagination before requesting', async () => {
  assert.throws(() => new AlgoliaSearch({ ...config, searchKey: '' }), /Configure/);
  const client = withRequester(async () => assert.fail('Unexpected network request'));
  for (const request of [{ page: -1 }, { page: 1.5 }, { pageSize: 0 }, { pageSize: 101 }]) {
    await assert.rejects(client.search(request), RangeError);
  }
});

test('does not start cancelled searches', async () => {
  const client = withRequester(async () => assert.fail('Unexpected network request'));
  const signal = AbortSignal.abort();
  await assert.rejects(client.search({ signal }), { name: 'AbortError' });
});

test('cancels waiting for an SDK request and safely ignores its later failure', async () => {
  let finish;
  const controller = new AbortController();
  const client = new AlgoliaSearch(config, {
    searchSingleIndex: () => new Promise((_, reject) => { finish = reject; }),
  });
  const pending = client.search({ signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  finish(new Error('Late SDK failure'));
  await new Promise(resolve => setImmediate(resolve));
});

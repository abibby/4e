import test from 'node:test';
import assert from 'node:assert/strict';
import {readState, stateParams, filterBy} from '../web/lib/search-state.js';
import {SearchClient} from '../web/lib/search-client.js';

test('shareable state preserves punctuation, ranges, pagination and sorting', () => {
  const state = readState('?q=magic+%26+fire&category=item&min_level=5&f_price=1%2C000+gp&sort=name&page=3');
  assert.deepEqual(readState('?' + stateParams(state)), state);
  assert.equal(readState('?page=-5').page, 1);
  assert.equal(readState('?page=nope').page, 1);
});
test('filters escape literals and ignore unknown fields and invalid numbers', () => {
  const state = readState('?category=item&f_price=rare%60%20%7C%7C%20category%3A*&min_level=5&max_level=NaN&f_secret=x');
  assert.equal(filterBy(state, new Set(['price', 'level'])), 'category:=`item` && f_price:=`rare\\` || category:*` && n_level:>=5');
});
test('browser connects directly with only the public search key', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url.origin, 'https://search.example');
      assert.equal(url.pathname, '/collections/compendium/documents/search');
      assert.equal(url.searchParams.get('q'), 'fire');
      assert.equal(options.headers['X-TYPESENSE-API-KEY'], 'public-key');
      return {ok: true, json: async () => ({found: 1, hits: []})};
    };
    const client = new SearchClient({endpoint: 'https://search.example', searchKey: 'public-key', collection: 'compendium'});
    assert.equal((await client.search({q: 'fire'})).found, 1);
  } finally { globalThis.fetch = original; }
});
test('missing configuration and service errors are visible', async () => {
  await assert.rejects(new SearchClient({}).search({}), /not connected/);
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ok: false, status: 503});
    await assert.rejects(new SearchClient({endpoint: 'https://search.example', searchKey: 'public', collection: 'test'}).search({}), /try again/);
  } finally { globalThis.fetch = original; }
});

test('numeric array bounds use a single range so one value must satisfy both', () => {
  assert.equal(filterBy(readState('?min_variant_level=2&max_variant_level=5'), new Set(['variant_level'])), 'n_variant_level:[2..5]');
});

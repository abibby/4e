import {test as base, expect} from '@playwright/test';

const entryPath = 'content/background/Accidental%20Initiate.html';
const fields = {level: {label: 'Level', numeric: true}, role: {label: 'Role', numeric: false}, sources: {label: 'Sources', numeric: false}};
const catalog = {count: 45, featured: ['level', 'role', 'sources'], categories: {
  background: {label: 'Backgrounds', count: 25, fields}, monster: {label: 'Monsters', count: 20, fields},
}};

const test = base.extend({
  page: async ({page}, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (/hydration|didn't match|server rendered/i.test(message.text())) errors.push(message.text()); });
    await page.route('**/assets/config.json', route => route.fulfill({json: {
      endpoint: 'https://search.test', searchKey: 'public-test-key', collection: 'compendium',
    }}));
    await page.route('**/assets/catalog.json', route => route.fulfill({json: catalog}));
    await page.route('https://search.test/**', async route => {
      const params = new URL(route.request().url()).searchParams;
      const q = params.get('q');
      if (q === 'error') return route.fulfill({status: 503});
      const found = q === 'empty' ? 0 : 45;
      const facets = (params.get('facet_by') || '').split(',').filter(Boolean).map(field_name => ({
        field_name, counts: [{value: 'Skirmisher', count: 20}],
      }));
      return route.fulfill({json: {found, facet_counts: facets,
        hits: found && params.get('per_page') !== '0' ? [{document: {
          name: 'Accidental Initiate', category: 'background', url: entryPath,
          summary: `Query ${q}, page ${params.get('page') || 1}`,
          metadata: {level: ['5'], role: ['Skirmisher'], sources: ['Book, page 1']},
        }}] : [],
      }});
    });
    await use(page);
    expect(errors).toEqual([]);
  },
});

test('home and search navigate without reloading; entries remain complete static documents', async ({page}) => {
  await page.goto('./');
  await page.evaluate(() => { window.documentToken = 'same-document'; });
  await page.locator('#query').fill('magic');
  await page.getByRole('button', {name: 'Search all entries'}).click();
  await expect(page).toHaveURL(/\/4e\/search.html\?q=magic$/);
  await expect(page.locator('.result-card')).toHaveCount(1);
  expect(await page.evaluate(() => window.documentToken)).toBe('same-document');
  await page.getByRole('link', {name: 'Next →', exact: true}).click();
  await expect(page.locator('#result-count')).toContainText('Page 2 of 3');
  await page.goBack();
  await expect(page.locator('#result-count')).toContainText('Page 1 of 3');
  await page.locator('.wordmark').click();
  await expect(page.locator('.home')).toBeVisible();
  expect(await page.evaluate(() => window.documentToken)).toBe('same-document');
  await page.goBack();
  await expect(page.locator('#query')).toHaveValue('magic');
  await page.locator('.result-card h2 a').click();
  await expect(page.locator('#detail')).toContainText('Accidental Initiate');
  expect(await page.evaluate(() => window.documentToken)).toBeUndefined();
  await page.locator('.wordmark').click();
  await expect(page.locator('.home')).toBeVisible();
  await expect(page.locator('#detail')).toHaveCount(0);
});

test('URL filters, facets, sorting and pagination survive history and reload', async ({page}) => {
  await page.goto('search.html?q=fire&category=monster&min_level=5&max_level=10&sort=name&page=2');
  await expect(page.locator('#result-count')).toContainText('Page 2 of 3');
  await expect(page.locator('#query')).toHaveValue('fire');
  await expect(page.locator('#field-level')).toHaveValue('5');
  await expect(page.locator('#sort')).toHaveValue('name');
  await page.locator('#field-role').fill('Skirmisher');
  await expect(page.locator('#field-role-values option')).toHaveCount(1);
  await page.locator('#field-role').press('Tab');
  await expect(page).toHaveURL(/f_role=Skirmisher/);
  await expect(page.locator('#result-count')).toContainText('Page 1 of 3');
  await page.reload();
  await expect(page.locator('#field-role')).toHaveValue('Skirmisher');
  await page.getByRole('button', {name: 'Remove Role Skirmisher filter'}).click();
  await expect(page.locator('#field-role')).toHaveValue('');
  await page.goBack();
  await expect(page.locator('#field-role')).toHaveValue('Skirmisher');
  await page.locator('#clear-filters').click();
  await expect(page.locator('#category')).toHaveValue('');
  await expect(page.locator('.filter-chip')).toHaveCount(0);
});

test('autocomplete handles keyboard selection and cancels stale responses', async ({page}) => {
  let finishOldRequest;
  const oldRequest = new Promise(resolve => { finishOldRequest = resolve; });
  await page.route('https://search.test/**', async route => {
    const q = new URL(route.request().url()).searchParams.get('q');
    if (q !== 'slow') return route.fallback();
    await oldRequest;
    await route.fulfill({json: {found: 1, hits: [{document: {name: 'Stale entry', url: entryPath, category: 'background'}}]}}).catch(() => {});
  });
  await page.goto('./');
  const pending = page.waitForRequest(request => new URL(request.url()).searchParams.get('q') === 'slow');
  await page.locator('#query').fill('slow');
  await pending;
  await page.locator('#query').fill('magic');
  await expect(page.locator('.quick-option')).toContainText('Accidental Initiate');
  finishOldRequest();
  await page.locator('#query').press('Escape');
  await expect(page.locator('#quick-panel')).toBeHidden();
  await page.locator('#query').fill('another');
  await expect(page.locator('.quick-option')).toContainText('Accidental Initiate');
  await page.locator('#query').press('ArrowDown');
  await expect(page.locator('#query')).toHaveAttribute('aria-activedescendant', 'suggestion-0');
  await page.locator('#query').press('Enter');
  await expect(page.locator('#detail')).toContainText('Accidental Initiate');
});

test('empty results and failed requests recover on retry', async ({page}) => {
  await page.goto('search.html?q=empty');
  await expect(page.getByRole('heading', {name: 'No entries found'})).toBeVisible();
  await page.locator('#query').fill('error');
  await page.getByRole('button', {name: 'Search all entries'}).click();
  await expect(page.getByRole('heading', {name: 'Couldn’t load results'})).toBeVisible();
  await page.route('https://search.test/**', route => route.fulfill({json: {found: 0, hits: []}}));
  await page.getByRole('button', {name: 'Try again'}).click();
  await expect(page.getByRole('heading', {name: 'No entries found'})).toBeVisible();
});

test('SSR styles, headers and rules work with JavaScript disabled', async ({browser, baseURL}) => {
  const context = await browser.newContext({javaScriptEnabled: false});
  try {
    const page = await context.newPage();
    await page.goto(baseURL);
    await expect(page.locator('h1')).toContainText('COMPENDIUM');
    await expect(page.locator('.home')).toHaveCSS('display', 'grid');
    await page.goto(new URL(entryPath, baseURL).href);
    await expect(page.locator('.wordmark')).toBeVisible();
    await expect(page.locator('#detail')).toContainText('Accidental Initiate');
    await expect(page.locator('#detail')).toHaveCSS('font-size', '14.4px');
    await page.locator('#query').fill('magic');
    await page.getByRole('button', {name: 'Search all entries'}).click();
    await expect(page.locator('#results')).toContainText('Enable JavaScript');
    await expect(page.locator('#results')).toHaveAttribute('aria-busy', 'false');
  } finally { await context.close(); }
});

test('hydration preserves the server DOM and text entered before JavaScript loads', async ({page}) => {
  let hydrate;
  const pending = new Promise(resolve => { hydrate = resolve; });
  await page.route('**/assets/*.js', async route => { await pending; await route.continue(); });
  await page.goto('./', {waitUntil: 'commit'});
  await expect(page.locator('.home')).toBeVisible();
  await page.evaluate(() => { window.serverHome = document.querySelector('.home'); });
  await page.locator('#query').fill('magic');
  hydrate();
  await expect(page.locator('.quick-option')).toContainText('Accidental Initiate');
  await expect(page.locator('#query')).toHaveValue('magic');
  expect(await page.evaluate(() => window.serverHome === document.querySelector('.home'))).toBe(true);
});

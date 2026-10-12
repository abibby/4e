import {SearchClient, readState, stateParams, filterBy} from './search-client.js';

const root = new URL(document.querySelector('meta[name="app-root"]').content, location.href);
const mode = document.body.dataset.page;
const $ = (selector) => document.querySelector(selector);
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
function link(path) { return new URL(path, root).href; }
function safeEntryURL(path) {
  const url = new URL(path, root);
  return url.origin === root.origin && url.pathname.startsWith(root.pathname + 'content/') ? url.href : link('search.html');
}
function debounce(fn, ms = 180) {
  let timer;
  const run = (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  run.cancel = () => clearTimeout(timer);
  return run;
}
let client, catalog;
let state = readState(location.search);
const input = $('#query');
input.value = state.q;

function categoryLabel(category) { return catalog.categories[category]?.label || category; }
function shortMetadata(doc) {
  const keys = ['level', 'role', 'rarity', 'item_type', 'class_or_path', 'usage', 'tier'];
  return keys.flatMap(key => (doc.metadata?.[key] || []).slice(0, 1).map(value => key === 'level' ? `Level ${value}` : value)).slice(0, 3).join(' · ');
}
function resultsURL(query) { return link('search.html') + '?' + new URLSearchParams({q: query}); }

function setupQuickSearch() {
  const panel = $('#quick-panel');
  const list = $('#suggestions');
  const status = $('#search-status');
  let controller, sequence = 0, active = -1;
  const close = () => {
    sequence++; controller?.abort(); run.cancel();
    panel.hidden = true; input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant'); active = -1;
  };
  const run = debounce(async () => {
    const q = input.value.trim();
    if (!q) return close();
    const current = ++sequence;
    controller?.abort(); controller = new AbortController();
    status.textContent = 'Searching…';
    try {
      const data = await client.search({q, per_page: 6}, controller.signal);
      if (sequence !== current) return;
      list.replaceChildren(); active = -1;
      input.removeAttribute('aria-activedescendant');
      for (const [index, hit] of (data.hits || []).entries()) {
        const doc = hit.document;
        const option = el('a', 'quick-option');
        option.href = safeEntryURL(doc.url); option.id = `suggestion-${index}`;
        option.setAttribute('role', 'option'); option.setAttribute('aria-selected', 'false');
        option.tabIndex = -1;
        const main = el('span', 'quick-main');
        main.append(el('strong', '', doc.name), el('small', '', shortMetadata(doc)));
        option.append(main, el('span', 'category-badge', categoryLabel(doc.category)));
        list.append(option);
      }
      if (!data.hits?.length) list.append(el('p', 'quick-empty', 'No matching entries. Try a different name or keyword.'));
      $('#all-results').href = resultsURL(q);
      panel.hidden = false; input.setAttribute('aria-expanded', 'true');
      status.textContent = `${data.found.toLocaleString()} matching entries`;
    } catch (error) {
      if (sequence !== current || error.name === 'AbortError') return;
      close(); status.textContent = error.message;
    }
  });
  input.addEventListener('input', () => {
    sequence++; controller?.abort(); panel.hidden = true;
    input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');
    active = -1; status.textContent = ''; run();
  });
  input.addEventListener('focus', () => { if (input.value.trim()) run(); });
  input.addEventListener('keydown', event => {
    const options = [...list.querySelectorAll('[role="option"]')];
    if (event.key === 'Escape') { close(); status.textContent = ''; }
    if (!panel.hidden && options.length && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      active = active < 0 ? (event.key === 'ArrowDown' ? 0 : options.length - 1)
        : (active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options.forEach((node, i) => node.setAttribute('aria-selected', String(i === active)));
      input.setAttribute('aria-activedescendant', options[active].id);
      options[active].scrollIntoView({block: 'nearest'});
    }
    if (event.key === 'Enter' && !panel.hidden && active >= 0) {
      event.preventDefault(); location.assign(options[active].href);
    }
    if (event.key === 'Tab') close();
  });
  document.addEventListener('click', event => { if (!event.target.closest('.search-form')) close(); });
  if (input.value.trim() && document.activeElement === input) run();
  $('.search-form').addEventListener('submit', event => {
    close();
    if (mode === 'results') { event.preventDefault(); state.q = input.value.trim(); state.page = 1; navigate(); }
  });
}

function currentFields() {
  if (state.category) return catalog.categories[state.category]?.fields || {};
  return {sources: {label: 'Sources', numeric: false}};
}
function allowedFields() {
  return new Set(Object.values(catalog.categories).flatMap(cat => Object.keys(cat.fields)));
}
function getFilter(key) { return state.filters.find(([name]) => name === key)?.[1] || ''; }
function setFilter(key, value) {
  state.filters = state.filters.filter(([name]) => name !== key);
  if (value) state.filters.push([key, value]);
  state.page = 1; navigate();
}
let facetSequence = 0;
function filterControl(field, descriptor, suffix = '') {
  const group = el('div', 'filter-control');
  const id = `field-${field}${suffix}`;
  const label = el('label', '', descriptor.label); label.htmlFor = id; group.append(label);
  if (descriptor.numeric) {
    const range = el('div', 'range');
    for (const kind of ['min', 'max']) {
      const control = el('input'); control.type = 'number'; control.step = 'any';
      control.id = kind === 'min' ? id : id + '-max';
      control.setAttribute('aria-label', `${descriptor.label} ${kind === 'min' ? 'minimum' : 'maximum'}`);
      control.placeholder = kind === 'min' ? 'Min' : 'Max'; control.value = getFilter(`${kind}_${field}`);
      control.addEventListener('change', () => setFilter(`${kind}_${field}`, control.value));
      range.append(control);
    }
    group.append(range);
  } else {
    const control = el('input'); control.type = 'text'; control.id = id;
    control.placeholder = 'Any'; control.value = getFilter('f_' + field);
    control.setAttribute('list', id + '-values'); control.autocomplete = 'off';
    const datalist = el('datalist'); datalist.id = id + '-values'; datalist.dataset.field = field;
    let controller;
    const updateOptions = debounce(async () => {
      controller?.abort(); controller = new AbortController();
      const generation = facetSequence;
      try {
        const data = await client.search({q: '*', per_page: 0, facet_by: 'f_' + field,
          facet_query: `f_${field}:${control.value}`, max_facet_values: 50,
          filter_by: filterBy({...state, filters: []}, allowedFields())}, controller.signal);
        if (generation !== facetSequence || !control.isConnected) return;
        fillOptions(datalist, data.facet_counts?.[0]?.counts || []);
      } catch { /* The results request displays service failures. */ }
    });
    control.addEventListener('input', updateOptions);
    control.addEventListener('focus', updateOptions);
    control.addEventListener('change', () => { updateOptions.cancel(); controller?.abort(); setFilter('f_' + field, control.value.trim()); });
    group.append(control, datalist);
  }
  return group;
}
function fillOptions(list, counts) {
  list.replaceChildren(...counts.map(item => {
    const option = el('option'); option.value = item.value; option.label = `${item.count.toLocaleString()} entries`; return option;
  }));
}
function renderFilters() {
  facetSequence++;
  const fields = currentFields();
  $('#category').value = state.category;
  const main = $('#category-filters'); main.replaceChildren();
  const featured = catalog.featured.filter(field => fields[field]).slice(0, 7);
  featured.forEach(field => main.append(filterControl(field, fields[field])));
  const select = $('#attribute'); select.replaceChildren(new Option('Choose an attribute', ''));
  Object.entries(fields).sort((a, b) => a[1].label.localeCompare(b[1].label)).forEach(([key, info]) => select.add(new Option(info.label, key)));
  $('#attribute-filter').replaceChildren();
  const chips = $('#active-filters'); chips.replaceChildren();
  for (const [key, value] of state.filters) {
    const field = key.replace(/^(f|min|max)_/, '');
    const button = el('button', 'filter-chip', `${fields[field]?.label || field} ${key.startsWith('min_') ? '≥ ' : key.startsWith('max_') ? '≤ ' : ''}${value} ×`);
    button.type = 'button'; button.setAttribute('aria-label', `Remove ${button.textContent.slice(0, -2)} filter`);
    button.addEventListener('click', () => setFilter(key, '')); chips.append(button);
  }
}
function highlightedSnippet(hit) {
  const node = el('p', 'result-snippet');
  const text = hit.highlights?.find(item => item.field === 'text')?.snippet || hit.document.summary || '';
  for (const part of text.split(/(⟦.*?⟧)/g)) {
    if (part.startsWith('⟦') && part.endsWith('⟧')) node.append(el('mark', '', part.slice(1, -1)));
    else node.append(document.createTextNode(part));
  }
  return node;
}
function renderHit(hit) {
  const doc = hit.document;
  const card = el('article', 'result-card');
  const top = el('div', 'result-top');
  top.append(el('span', 'category-badge', categoryLabel(doc.category)), el('span', 'result-meta', shortMetadata(doc)));
  const heading = el('h2'); const anchor = el('a', '', doc.name); anchor.href = safeEntryURL(doc.url); heading.append(anchor);
  card.append(top, heading, highlightedSnippet(hit));
  const footer = el('div', 'result-footer');
  footer.append(el('span', 'source', (doc.metadata?.sources || []).join(' · ')));
  const more = el('a', 'view-entry', 'View entry →'); more.href = anchor.href;
  more.setAttribute('aria-label', `View ${doc.name}`); footer.append(more); card.append(footer);
  return card;
}
let resultsController, resultsSequence = 0;
async function loadResults() {
  const sequence = ++resultsSequence;
  resultsController?.abort(); resultsController = new AbortController();
  const target = $('#results'); target.setAttribute('aria-busy', 'true');
  target.replaceChildren(el('div', 'empty-state', 'Searching the compendium…'));
  $('#pagination').replaceChildren(); $('#result-count').textContent = 'Loading entries…';
  $('#results-title').textContent = state.q ? `Results for “${state.q}”` : state.category ? categoryLabel(state.category) : 'All entries';
  $('#sort').value = state.sort;
  const facetFields = [...new Set([...document.querySelectorAll('datalist[data-field]')].map(list => 'f_' + list.dataset.field))];
  try {
    const data = await client.search({q: state.q || '*', page: state.page, per_page: 20,
      filter_by: filterBy(state, allowedFields()), facet_by: facetFields.join(','), max_facet_values: 50,
      sort_by: state.sort === 'name' || !state.q ? 'name:asc' : '_text_match:desc,name:asc'}, resultsController.signal);
    if (sequence !== resultsSequence) return;
    const pages = Math.ceil(data.found / 20);
    if (pages && state.page > pages) { state.page = pages; navigate(true); return; }
    $('#result-count').textContent = `${data.found.toLocaleString()} ${data.found === 1 ? 'entry' : 'entries'}${data.found ? ` · Page ${state.page} of ${pages.toLocaleString()}` : ''}`;
    target.replaceChildren(...(data.hits || []).map(renderHit));
    if (!data.hits?.length) {
      const empty = el('div', 'empty-state'); empty.append(el('h2', '', 'No entries found'), el('p', '', 'Try a broader search or remove a filter.'));
      target.append(empty);
    }
    for (const facet of data.facet_counts || []) {
      document.querySelectorAll('datalist[data-field]').forEach(list => {
        if ('f_' + list.dataset.field === facet.field_name) fillOptions(list, facet.counts);
      });
    }
    const nav = $('#pagination');
    for (const [label, page] of [['← Previous', state.page - 1], ['Next →', state.page + 1]]) {
      if (page < 1 || page > pages) continue;
      const anchor = el('a', 'page-link', label); anchor.href = link('search.html') + '?' + stateParams({...state, page});
      anchor.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); state.page = page; navigate(); $('#results-title').scrollIntoView({block: 'start'});
      }); nav.append(anchor);
    }
  } catch (error) {
    if (sequence !== resultsSequence || error.name === 'AbortError') return;
    $('#result-count').textContent = 'Search unavailable';
    const box = el('div', 'empty-state'); box.append(el('h2', '', 'Couldn’t load results'), el('p', '', error.message));
    const retry = el('button', 'retry', 'Try again'); retry.type = 'button'; retry.addEventListener('click', loadResults); box.append(retry);
    target.replaceChildren(box);
  } finally { if (sequence === resultsSequence) target.setAttribute('aria-busy', 'false'); }
}
function navigate(replace = false) {
  history[replace ? 'replaceState' : 'pushState']({}, '', link('search.html') + '?' + stateParams(state));
  renderFilters(); loadResults();
}
function setupResults() {
  for (const [key, cat] of Object.entries(catalog.categories)) $('#category').add(new Option(`${cat.label} (${cat.count.toLocaleString()})`, key));
  if (!catalog.categories[state.category]) state.category = '';
  state.filters = state.filters.filter(([key]) => allowedFields().has(key.replace(/^(f|min|max)_/, '')));
  $('#category').addEventListener('change', event => { state.category = event.target.value; state.filters = []; state.page = 1; navigate(); });
  $('#sort').addEventListener('change', event => { state.sort = event.target.value; state.page = 1; navigate(); });
  $('#clear-filters').addEventListener('click', () => { state.category = ''; state.filters = []; state.page = 1; navigate(); });
  $('#attribute').addEventListener('change', event => {
    const field = event.target.value; $('#attribute-filter').replaceChildren();
    if (field) $('#attribute-filter').append(filterControl(field, currentFields()[field], '-extra'));
  });
  window.addEventListener('popstate', () => { state = readState(location.search); input.value = state.q; renderFilters(); loadResults(); });
  renderFilters(); loadResults();
}

try {
  const responses = await Promise.all(['config', 'catalog'].map(async name => {
    const response = await fetch(link(`assets/${name}.json`));
    if (!response.ok) throw new Error('Unable to load the compendium. Please refresh the page.');
    return response.json();
  }));
  client = new SearchClient(responses[0]); catalog = responses[1];
  setupQuickSearch();
  if (mode === 'results') setupResults();
} catch (error) {
  $('#search-status').textContent = error.message;
  if (mode === 'results') {
    $('#result-count').textContent = 'Unable to load search';
    $('#results').setAttribute('aria-busy', 'false');
    $('#results').replaceChildren(el('p', 'empty-state', error.message));
  }
}

export function readState(search) {
  const params = new URLSearchParams(search);
  return {
    q: params.get('q') || '', category: params.get('category') || '',
    page: Math.max(1, Math.min(100000, Number.parseInt(params.get('page'), 10) || 1)),
    sort: params.get('sort') === 'name' ? 'name' : 'relevance',
    filters: [...params].filter(([key]) => /^(f|min|max)_[a-z][a-z0-9_]*$/.test(key)),
  };
}

export function stateParams(state) {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.category) params.set('category', state.category);
  if (state.page > 1) params.set('page', state.page);
  if (state.sort !== 'relevance') params.set('sort', state.sort);
  for (const [key, value] of state.filters) if (value !== '') params.set(key, value);
  return params;
}

export function literal(value) {
  return '`' + String(value).replaceAll('\\', '\\\\').replaceAll('`', '\\`') + '`';
}

export function filterBy(state, allowedFields) {
  const parts = [];
  if (state.category) parts.push(`category:=${literal(state.category)}`);
  const ranges = new Map();
  for (const [key, value] of state.filters) {
    const [, kind, field] = key.match(/^(f|min|max)_(.*)$/) || [];
    if (!allowedFields.has(field)) continue;
    if (kind === 'f') parts.push(`f_${field}:=${literal(value)}`);
    else if (value.trim() !== '' && Number.isFinite(Number(value))) {
      const range = ranges.get(field) || {};
      range[kind] = Number(value); ranges.set(field, range);
    }
  }
  for (const [field, range] of ranges) {
    if (range.min !== undefined && range.max !== undefined) parts.push(`n_${field}:[${range.min}..${range.max}]`);
    else parts.push(`n_${field}:${range.min !== undefined ? '>=' + range.min : '<=' + range.max}`);
  }
  return parts.join(' && ');
}

export class SearchClient {
  constructor(config) { this.config = config; }
  async search(params, signal) {
    const {endpoint, searchKey, collection} = this.config;
    if (!endpoint || !searchKey) throw new Error('Search is not connected yet. Please try again later.');
    const url = new URL(`${endpoint}/collections/${encodeURIComponent(collection)}/documents/search`);
    url.search = new URLSearchParams({q: '*', query_by: 'name,searchable_metadata,text',
      query_by_weights: '8,2,1', prefix: 'true,false,false',
      include_fields: 'name,category,url,summary,metadata', highlight_fields: 'text',
      highlight_start_tag: '⟦', highlight_end_tag: '⟧', snippet_threshold: 40, ...params});
    const response = await fetch(url, {headers: {'X-TYPESENSE-API-KEY': searchKey}, signal});
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403
      ? 'Search is temporarily unavailable. Please try again later.'
      : 'Unable to load search results. Please try again.');
    return response.json();
  }
}

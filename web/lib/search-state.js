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


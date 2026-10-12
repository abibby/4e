export function allowedFields(catalog) {
  return new Set(Object.values(catalog?.categories || {}).flatMap(category => Object.keys(category.fields)));
}

export function currentFields(catalog, category) {
  return category ? catalog?.categories[category]?.fields || {} : {sources: {label: 'Sources', numeric: false}};
}

export function featuredFields(catalog, category) {
  const fields = currentFields(catalog, category);
  return (catalog?.featured || []).filter(field => fields[field]).slice(0, 7);
}

export function normalizeState(state, catalog) {
  if (!catalog) return state;
  const allowed = allowedFields(catalog);
  return {...state, category: catalog.categories[state.category] ? state.category : '',
    filters: state.filters.filter(([key]) => allowed.has(key.replace(/^(f|min|max)_/, '')))};
}

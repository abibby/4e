import {useEffect, useMemo} from 'react';
import {allowedFields, currentFields, featuredFields} from '../lib/catalog.js';
import {filterBy} from '../lib/search-state.js';
import {useSearchRequest} from './use-search-request.js';

export const PAGE_SIZE = 20;

export function useSearchResults({client, catalog, state, setState}) {
  const allowed = useMemo(() => allowedFields(catalog), [catalog]);
  const params = useMemo(() => {
    const fields = currentFields(catalog, state.category);
    const facets = featuredFields(catalog, state.category).filter(field => !fields[field].numeric);
    return {q: state.q || '*', page: state.page, per_page: PAGE_SIZE,
      filter_by: filterBy(state, allowed), facet_by: facets.map(field => `f_${field}`).join(','), max_facet_values: 50,
      sort_by: state.sort === 'name' || !state.q ? 'name:asc' : '_text_match:desc,name:asc'};
  }, [catalog, state, allowed]);
  const request = useSearchRequest(client, params, {enabled: Boolean(catalog)});
  const pages = Math.ceil((request.data?.found || 0) / PAGE_SIZE);

  useEffect(() => {
    if (pages && state.page > pages) setState({...state, page: pages}, true);
  }, [pages, state, setState]);

  return {...request, pages};
}

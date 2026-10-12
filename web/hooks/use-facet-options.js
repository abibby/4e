import {useMemo} from 'react';
import {filterBy} from '../lib/search-state.js';
import {useSearchRequest} from './use-search-request.js';

export function useFacetOptions({client, field, category, query, enabled}) {
  const params = useMemo(() => ({
    q: '*', per_page: 0, facet_by: `f_${field}`, facet_query: `f_${field}:${query}`, max_facet_values: 50,
    filter_by: filterBy({category, filters: []}, new Set()),
  }), [field, category, query]);
  const {data} = useSearchRequest(client, params, {enabled, delay: 180});
  return data?.facet_counts?.[0]?.counts;
}

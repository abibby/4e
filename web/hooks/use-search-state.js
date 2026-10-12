import {useCallback, useMemo} from 'react';
import {useLocation, useNavigate} from 'react-router';
import {readState, stateParams} from '../lib/search-state.js';
import {normalizeState} from '../lib/catalog.js';
import {useCompendium} from '../providers/compendium-provider.jsx';
import {useHydrated} from './use-hydrated.js';

export function useSearchState() {
  const {search} = useLocation();
  const navigate = useNavigate();
  const {catalog} = useCompendium();
  const hydrated = useHydrated();
  // Static HTML has no query-specific data; defer URL filters until hydration.
  const query = hydrated ? search : '';
  const state = useMemo(() => normalizeState(readState(query), catalog), [query, catalog]);
  const setState = useCallback((next, replace = false) => {
    navigate({pathname: '/search.html', search: stateParams(next).toString()}, {replace});
  }, [navigate]);

  return {state, setState, hydrated};
}

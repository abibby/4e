import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {safeEntryURL} from '../lib/urls.js';
import {useSearchRequest} from './use-search-request.js';

export function useAutocomplete({query, client, root}) {
  const formRef = useRef(null);
  const previousQuery = useRef(query);
  const [value, setValue] = useState(query);
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(-1);
  const close = useCallback(() => { setEnabled(false); setActive(-1); }, []);
  const params = useMemo(() => ({q: value.trim(), per_page: 6}), [value]);
  const request = useSearchRequest(client, params, {enabled: enabled && Boolean(params.q), delay: 180});
  const hits = request.data?.hits || [];
  const open = enabled && request.status === 'success';

  useEffect(() => {
    // Preserve edits made to the server-rendered field before JS finished loading.
    const input = formRef.current.elements.q;
    setValue(input.value);
    setEnabled(document.activeElement === input);
  }, []);
  useEffect(() => {
    if (previousQuery.current === query) return;
    previousQuery.current = query;
    setValue(query);
    close();
  }, [query, close]);
  useEffect(() => {
    const outside = event => { if (!formRef.current?.contains(event.target)) close(); };
    document.addEventListener('click', outside);
    return () => document.removeEventListener('click', outside);
  }, [close]);
  useEffect(() => {
    if (active >= 0) formRef.current?.querySelector(`#suggestion-${active}`)?.scrollIntoView({block: 'nearest'});
  }, [active]);

  function keyDown(event) {
    if (event.key === 'Escape' || event.key === 'Tab') close();
    if (open && hits.length && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      setActive(index => index < 0 ? (event.key === 'ArrowDown' ? 0 : hits.length - 1)
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length);
    }
    if (event.key === 'Enter' && open && hits[active]) {
      event.preventDefault();
      window.location.assign(safeEntryURL(hits[active].document.url, root));
    }
  }

  return {formRef, value, open, hits, active, close, keyDown,
    focus: () => setEnabled(true),
    change: value => { setValue(value); setEnabled(true); setActive(-1); },
    status: request.status === 'loading' ? 'Searching…' : request.error || (open ? `${request.data.found.toLocaleString()} matching entries` : ''),
  };
}

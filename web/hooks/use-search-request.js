import {useCallback, useEffect, useState} from 'react';

// Share cancellation and stale-response protection across results and suggestions.
// Callers memoize params so unrelated renders do not restart a request.
export function useSearchRequest(client, params, {enabled = true, delay = 0} = {}) {
  const [request, setRequest] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const active = Boolean(client && enabled);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let current = true;
    setRequest({params, attempt, status: 'loading'});
    const timer = setTimeout(async () => {
      try {
        const data = await client.search(params, controller.signal);
        if (current) setRequest({params, attempt, status: 'success', data});
      } catch (error) {
        if (current && error.name !== 'AbortError') setRequest({params, attempt, status: 'error', error: error.message});
      }
    }, delay);
    return () => { current = false; clearTimeout(timer); controller.abort(); };
  }, [client, params, active, delay, attempt]);

  const result = !active ? {status: 'idle'}
    : request?.params === params && request.attempt === attempt ? request : {status: 'loading'};
  return {...result, retry};
}

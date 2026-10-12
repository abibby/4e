import {useCallback, useEffect, useState} from 'react';
import {SearchClient} from '../lib/search-client.js';

export function useCompendiumResources(root) {
  const [resources, setResources] = useState({status: 'loading'});
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setResources({status: 'loading'});
    Promise.all(['config', 'catalog'].map(async name => {
      const response = await fetch(`${root}assets/${name}.json`, {signal: controller.signal});
      if (!response.ok) throw new Error('Unable to load the compendium. Please refresh the page.');
      return response.json();
    })).then(([config, catalog]) => {
      if (current) setResources({status: 'ready', client: new SearchClient(config), catalog});
    }).catch(error => {
      if (current && error.name !== 'AbortError') setResources({status: 'error', error: error.message});
    });
    return () => { current = false; controller.abort(); };
  }, [root, attempt]);

  return {...resources, retry};
}

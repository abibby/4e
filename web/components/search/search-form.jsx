import {useLocation} from 'react-router';
import {useCompendium} from '../../providers/compendium-provider.jsx';
import {useSearchState} from '../../hooks/use-search-state.js';
import {useAutocomplete} from '../../hooks/use-autocomplete.js';
import {QuickResults} from './quick-results.jsx';

export function SearchForm() {
  const {root, client, catalog, error} = useCompendium();
  const {pathname} = useLocation();
  const {state, setState} = useSearchState();
  const search = useAutocomplete({query: state.q, client, root});
  const {formRef, value, open, active, hits} = search;

  function submit(event) {
    search.close();
    if (pathname.startsWith('/content/')) return;
    event.preventDefault();
    setState({...state, q: value.trim(), page: 1});
  }

  return <form ref={formRef} className="search-form" action={`${root}search.html`} role="search" autoComplete="off" onSubmit={submit}>
    <label className="sr-only" htmlFor="query">Search the compendium</label>
    <div className="search-box">
      <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
      <input id="query" name="q" type="search" placeholder="Search the compendium…" role="combobox"
        aria-autocomplete="list" aria-expanded={open} aria-controls="suggestions"
        aria-activedescendant={open && active >= 0 ? `suggestion-${active}` : undefined}
        spellCheck={false} value={value} onKeyDown={search.keyDown} onFocus={search.focus}
        onChange={event => search.change(event.target.value)}/>
      <button type="submit" aria-label="Search all entries">Search <span aria-hidden="true">↗</span></button>
    </div>
    <QuickResults open={open} hits={hits} active={active} query={value} root={root} catalog={catalog} onSelect={search.close}/>
    <p id="search-status" className="search-status" role="status">{error || search.status}</p>
  </form>;
}

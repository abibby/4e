import {stateParams} from '../../lib/search-state.js';
import {SiteLink} from '../layout/site-link.jsx';

export function Pagination({state, pages, visible}) {
  const links = [['← Previous', state.page - 1], ['Next →', state.page + 1]];
  return <nav id="pagination" className="pagination" aria-label="Results pages">
    {visible && links.filter(([, page]) => page >= 1 && page <= pages).map(([label, page]) =>
      <SiteLink key={label} className="page-link" to={`/search.html?${stateParams({...state, page})}`} onClick={event => {
        if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
          document.getElementById('results-title')?.scrollIntoView({block: 'start'});
        }
      }}>{label}</SiteLink>)}
  </nav>;
}

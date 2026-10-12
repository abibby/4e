import {safeEntryURL, shortMetadata} from '../../lib/urls.js';
import {SiteLink} from '../layout/site-link.jsx';

export function QuickResults({open, hits, active, query, root, catalog, onSelect}) {
  return <div id="quick-panel" className="quick-panel" hidden={!open}>
    <div id="suggestions" role="listbox" aria-label="Quick results">
      {hits.map(({document: doc}, index) => <a key={doc.url} id={`suggestion-${index}`} className="quick-option"
        href={safeEntryURL(doc.url, root)} role="option" aria-selected={index === active} tabIndex={-1}>
        <span className="quick-main"><strong>{doc.name}</strong><small>{shortMetadata(doc)}</small></span>
        <span className="category-badge">{catalog.categories[doc.category]?.label || doc.category}</span>
      </a>)}
      {!hits.length && <p className="quick-empty">No matching entries. Try a different name or keyword.</p>}
    </div>
    <SiteLink id="all-results" className="all-results" to={`/search.html?${new URLSearchParams({q: query.trim()})}`} onClick={onSelect}>
      View all results <span aria-hidden="true">→</span>
    </SiteLink>
  </div>;
}

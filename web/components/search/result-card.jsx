import {safeEntryURL, shortMetadata} from '../../lib/urls.js';

export function ResultCard({hit, root, catalog}) {
  const doc = hit.document;
  const url = safeEntryURL(doc.url, root);
  const snippet = hit.highlights?.find(item => item.field === 'text')?.snippet || doc.summary || '';
  return <article className="result-card">
    <div className="result-top"><span className="category-badge">{catalog.categories[doc.category]?.label || doc.category}</span>
      <span className="result-meta">{shortMetadata(doc)}</span></div>
    <h2><a href={url}>{doc.name}</a></h2>
    <p className="result-snippet">{snippet.split(/(⟦.*?⟧)/g).map((part, index) => part.startsWith('⟦') && part.endsWith('⟧')
      ? <mark key={index}>{part.slice(1, -1)}</mark> : part)}</p>
    <div className="result-footer"><span className="source">{(doc.metadata?.sources || []).join(' · ')}</span>
      <a className="view-entry" href={url} aria-label={`View ${doc.name}`}>View entry →</a></div>
  </article>;
}

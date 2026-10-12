import {ResultCard} from './result-card.jsx';

export function ResultsList({hydrated, loading, error, retry, data, root, catalog}) {
  let content;
  if (!hydrated) content = <div className="empty-state">Enable JavaScript to search and filter entries.</div>;
  else if (loading) content = <div className="empty-state">Searching the compendium…</div>;
  else if (error) content = <div className="empty-state"><h2>Couldn’t load results</h2><p>{error}</p>
    <button className="retry" type="button" onClick={retry}>Try again</button></div>;
  else if (data?.hits?.length) content = data.hits.map(hit => <ResultCard key={hit.document.url} hit={hit} root={root} catalog={catalog}/>);
  else content = <div className="empty-state"><h2>No entries found</h2><p>Try a broader search or remove a filter.</p></div>;
  return <div id="results" aria-busy={loading}>{content}</div>;
}

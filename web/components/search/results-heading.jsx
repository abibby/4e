export function ResultsHeading({title, state, setState, hydrated, loading, error, data, pages}) {
  let count = 'Search the compendium by name or keyword.';
  if (hydrated) {
    if (error) count = 'Search unavailable';
    else if (loading) count = 'Loading entries…';
    else if (data) count = `${data.found.toLocaleString()} ${data.found === 1 ? 'entry' : 'entries'}${data.found ? ` · Page ${state.page} of ${pages.toLocaleString()}` : ''}`;
  }
  return <div className="results-heading"><div>
    <p className="eyebrow">THE COMPENDIUM</p><h1 id="results-title">{title}</h1>
    <p id="result-count" role="status">{count}</p>
  </div><label className="sort-label">Sort by
    <select id="sort" disabled={!hydrated} value={state.sort} onChange={event => setState({...state, sort: event.target.value, page: 1})}>
      <option value="relevance">Relevance</option><option value="name">Name A–Z</option>
    </select>
  </label></div>;
}

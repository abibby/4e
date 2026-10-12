import {Filters} from '../components/filters/filters.jsx';
import {ResultsHeading} from '../components/search/results-heading.jsx';
import {ResultsList} from '../components/search/results-list.jsx';
import {Pagination} from '../components/search/pagination.jsx';
import {useCompendium} from '../providers/compendium-provider.jsx';
import {useSearchState} from '../hooks/use-search-state.js';
import {useSearchResults} from '../hooks/use-search-results.js';
import {usePageTitle} from '../hooks/use-page-title.js';

export function SearchPage() {
  usePageTitle('Search');
  const resources = useCompendium();
  const {root, client, catalog} = resources;
  const {state, setState, hydrated} = useSearchState();
  const results = useSearchResults({client, catalog, state, setState});
  const error = resources.error || results.error;
  const loading = hydrated && !error && (resources.status === 'loading' || results.status === 'loading');
  const title = state.q ? `Results for “${state.q}”` : catalog?.categories[state.category]?.label || 'All entries';
  const retry = resources.error ? resources.retry : results.retry;

  return <main id="main" className="results-layout">
    {catalog && <Filters key={state.category} catalog={catalog} state={state} setState={setState} client={client} facets={results.data?.facet_counts}/>}
    <section className="results-section" aria-label="Search results">
      <ResultsHeading title={title} state={state} setState={setState} hydrated={hydrated} loading={loading} error={error} data={results.data} pages={results.pages}/>
      <ResultsList hydrated={hydrated} loading={loading} error={error} retry={retry} data={results.data} root={root} catalog={catalog}/>
      <Pagination state={state} pages={results.pages} visible={hydrated && !loading && !error}/>
    </section>
  </main>;
}

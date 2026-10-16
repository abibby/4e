import type { LoaderFunctionArgs } from "react-router";
import {
  Form,
  Link,
  useLoaderData,
  useLocation,
  useNavigation,
} from "react-router";
import { createSearch } from "../search";
import type { SearchResponse } from "../search";
import {
  categoryLabel,
  filterDefinitions,
  readSearchParams,
  toFieldFilters,
} from "../search/filters";
import { SearchBox, EmptyState } from "../components/ui";
import { SearchFilters } from "../components/search-filters";
import { Pagination, ResultCard } from "../components/search-results";
import { useSearchLinks } from "../hooks/use-search";

export async function loader({ request }: LoaderFunctionArgs) {
  const state = readSearchParams(new URL(request.url).searchParams);
  let results: SearchResponse | null = null;
  let error: string | null = null;
  try {
    const filters = toFieldFilters(state);
    results = await createSearch().search({
      query: state.query,
      filters,
      tags: state.tags,
      page: state.page,
      pageSize: state.pageSize,
      signal: request.signal,
    });
  } catch (cause) {
    if (request.signal.aborted) throw cause;
    error =
      cause instanceof Error
        ? cause.message
        : "Search is unavailable. Please try again.";
  }
  return { state, results, error };
}

export function Search() {
  const { state, results, error } = useLoaderData<typeof loader>();
  const location = useLocation();
  const busy = useNavigation().state !== "idle";
  const { pageLink, removeFilter, removeTag, clearFilters } =
    useSearchLinks(state);
  const activeFilters = Object.entries(state.values).filter(
    ([, value]) => value,
  );
  const filterCount = activeFilters.length + state.tags.length;
  const labels = Object.fromEntries(
    filterDefinitions.map((field) => [field.name, field.label]),
  );
  Object.assign(labels, {
    category: "Type",
    minLevel: "Min level",
    maxLevel: "Max level",
  });
  return (
    <>
      <div className="search-heading">
        <div className="eyebrow">THE COMPENDIUM</div>
        <h1>Find your next discovery.</h1>
        <p>Every great adventure starts with a little research.</p>
      </div>
      <Form
        action="/search"
        role="search"
        className="search-layout"
        key={location.search}
      >
        <div className="search-bar">
          <SearchBox defaultValue={state.query} busy={busy} />
        </div>
        <SearchFilters state={state} />
        <section
          className="results-panel"
          aria-label="Search results"
          aria-busy={busy}
        >
          <div className="results-heading">
            <h2>
              {state.query
                ? `Results for “${state.query}”`
                : "Explore the collection"}
            </h2>
            <span role="status" aria-live="polite">
              {busy
                ? "Searching…"
                : results
                  ? `${results.total.toLocaleString()} results`
                  : "Search unavailable"}
            </span>
          </div>
          {filterCount > 0 && (
            <div className="active-filters" aria-label="Applied filters">
              {activeFilters.map(([name, value]) => (
                <Link
                  className="filter-chip"
                  key={name}
                  to={removeFilter(name)}
                  aria-label={`Remove ${labels[name]}: ${value}`}
                >
                  {labels[name]}:{" "}
                  {name === "category" ? categoryLabel(value) : value}
                  <span aria-hidden="true">×</span>
                </Link>
              ))}
              {state.tags.map((tag, index) => (
                <Link
                  className="filter-chip"
                  key={`${tag}-${index}`}
                  to={removeTag(index)}
                  aria-label={`Remove filter ${tag}`}
                >
                  {tag}
                  <span aria-hidden="true">×</span>
                </Link>
              ))}
              <Link className="clear-filters" to={clearFilters}>
                Clear filters
              </Link>
            </div>
          )}
          {error && (
            <EmptyState title="We couldn’t complete your search" error>
              <p>{error}</p>
              <button
                className="button secondary"
                type="submit"
                disabled={busy}
              >
                Try again
              </button>
            </EmptyState>
          )}
          {results?.hits.length === 0 && (
            <EmptyState title="No entries found">
              <p>
                Try a broader search or remove a filter to explore more of the
                compendium.
              </p>
              <Link
                className="button secondary"
                to={
                  state.page > 0
                    ? pageLink(0)
                    : filterCount
                      ? clearFilters
                      : "/search"
                }
              >
                {state.page > 0
                  ? "Return to first page"
                  : filterCount
                    ? "Clear filters"
                    : "Browse all resources"}
              </Link>
            </EmptyState>
          )}
          {results && results.hits.length > 0 && (
            <>
              <ul className="results-list">
                {results.hits.map((hit) => (
                  <ResultCard
                    hit={hit}
                    key={hit.id}
                    returnTo={`${location.pathname}${location.search}`}
                  />
                ))}
              </ul>
              <Pagination results={results} pageLink={pageLink} />
            </>
          )}
        </section>
      </Form>
    </>
  );
}

import type { LoaderFunctionArgs } from "react-router";
import { Form, Link, useLoaderData, useNavigation } from "react-router";
import { createSearch } from "../search";
import type { SearchResponse } from "../search";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const tags = url.searchParams.getAll("tag").map(tag => tag.trim()).filter(Boolean);
  const requestedPage = Number(url.searchParams.get("page") ?? 0);
  const page = Number.isInteger(requestedPage) && requestedPage >= 0 ? requestedPage : 0;
  let results: SearchResponse | null = null;
  let error: string | null = null;
  try {
    results = await createSearch().search({ query, tags, page, signal: request.signal });
  } catch (cause) {
    if (request.signal.aborted) throw cause;
    error = cause instanceof Error ? cause.message : "Search is unavailable. Please try again.";
  }
  return { query, tags, results, error };
}

export function Search() {
  const { query, tags, results, error } = useLoaderData<typeof loader>();
  const busy = useNavigation().state !== "idle";
  function pageLink(page: number) {
    const params = new URLSearchParams({ q: query, page: String(page) });
    tags.forEach(tag => params.append("tag", tag));
    return `/search?${params}`;
  }
  return (
    <main>
      <Link to="/">Home</Link>
      <h1>Search the compendium</h1>
      <Form action="/search" role="search" key={JSON.stringify([query, tags])}>
        <label>Search <input name="q" type="search" defaultValue={query} /></label>
        <fieldset>
          <legend>Tags (all must match)</legend>
          <p>Use exact table values, such as category:monster, level:1, or keywords:undead. Add one tag per box.</p>
          {[...tags, ""].map((tag, index) => (
            <label key={index}>Tag {index + 1} <input name="tag" defaultValue={tag} /></label>
          ))}
        </fieldset>
        <button type="submit" disabled={busy}>Search</button>
      </Form>
      {error && <p role="alert">{error}</p>}
      <section aria-label="Search results" aria-busy={busy}>
        <p role="status">{busy ? "Searching…" : results ? `${results.total} results` : ""}</p>
        {results?.hits.length === 0 && <p>No entries found. Try another query or remove a tag.</p>}
        <ul>
          {results?.hits.map(hit => (
            <li key={hit.id}>
              <Link to={`/c/${hit.file.split("/").map(encodeURIComponent).join("/")}`}>{hit.name}</Link>
              <small> · {hit.category}</small>
              <p>{hit.summary}</p>
            </li>
          ))}
        </ul>
        {results && <nav aria-label="Search pages">
          {results.page > 0 && <Link to={pageLink(results.page - 1)}>Previous</Link>}
          {results.pageCount > 0 && <span> Page {results.page + 1} of {results.pageCount} </span>}
          {results.page + 1 < results.pageCount && <Link to={pageLink(results.page + 1)}>Next</Link>}
        </nav>}
      </section>
    </main>
  );
}

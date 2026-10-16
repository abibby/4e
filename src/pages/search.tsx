import type { LoaderFunctionArgs } from "react-router";
import { Form, Link, useLoaderData, useNavigation } from "react-router";
import { createSearch } from "../search";
import type { FieldFilters, SearchResponse } from "../search";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const tags = url.searchParams.getAll("tag").map(tag => tag.trim()).filter(Boolean);
  const category = url.searchParams.get("category")?.trim() ?? "";
  const rarity = url.searchParams.get("rarity")?.trim() ?? "";
  const minLevel = url.searchParams.get("minLevel")?.trim() ?? "";
  const maxLevel = url.searchParams.get("maxLevel")?.trim() ?? "";
  const filters: FieldFilters = {
    ...(category ? { category } : {}),
    ...(rarity ? { rarity } : {}),
    ...(minLevel || maxLevel ? { level: {
      ...(minLevel ? { min: Number(minLevel) } : {}),
      ...(maxLevel ? { max: Number(maxLevel) } : {}),
    } } : {}),
  };
  const requestedPage = Number(url.searchParams.get("page") ?? 0);
  const page = Number.isInteger(requestedPage) && requestedPage >= 0 ? requestedPage : 0;
  let results: SearchResponse | null = null;
  let error: string | null = null;
  try {
    results = await createSearch().search({ query, filters, tags, page, signal: request.signal });
  } catch (cause) {
    if (request.signal.aborted) throw cause;
    error = cause instanceof Error ? cause.message : "Search is unavailable. Please try again.";
  }
  return { query, category, rarity, minLevel, maxLevel, tags, results, error };
}

export function Search() {
  const { query, category, rarity, minLevel, maxLevel, tags, results, error } = useLoaderData<typeof loader>();
  const busy = useNavigation().state !== "idle";
  function pageLink(page: number) {
    const params = new URLSearchParams({ q: query, page: String(page) });
    tags.forEach(tag => params.append("tag", tag));
    for (const [field, value] of Object.entries({ category, rarity, minLevel, maxLevel })) {
      if (value) params.set(field, value);
    }
    return `/search?${params}`;
  }
  return (
    <main>
      <Link to="/">Home</Link>
      <h1>Search the compendium</h1>
      <Form action="/search" role="search" key={JSON.stringify([query, category, rarity, minLevel, maxLevel, tags])}>
        <label>Search <input name="q" type="search" defaultValue={query} /></label>
        <fieldset>
          <legend>Resource fields</legend>
          <label>Category <input name="category" defaultValue={category} placeholder="item" /></label>
          <label>Minimum level <input name="minLevel" type="number" step="1" defaultValue={minLevel} /></label>
          <label>Maximum level <input name="maxLevel" type="number" step="1" defaultValue={maxLevel} /></label>
          <label htmlFor="rarity">Rarity</label>
          <select id="rarity" name="rarity" defaultValue={rarity}>
            <option value="">Any rarity</option>
            {["Common", "Uncommon", "Rare", "Artifact"].map(value => <option key={value} value={value}>{value}</option>)}
          </select>
          <p>Level bounds are inclusive. Leave the search text empty to browse matching resources.</p>
        </fieldset>
        <fieldset>
          <legend>Additional fields (all must match)</legend>
          <p>Use table values, such as category:monster, level:1, or keywords:undead. Add one filter per box.</p>
          {[...tags, ""].map((tag, index) => (
            <label key={index}>Filter {index + 1} <input name="tag" defaultValue={tag} /></label>
          ))}
        </fieldset>
        <button type="submit" disabled={busy}>Search</button>
      </Form>
      {error && <p role="alert">{error}</p>}
      <section aria-label="Search results" aria-busy={busy}>
        <p role="status">{busy ? "Searching…" : results ? `${results.total} results` : ""}</p>
        {results?.hits.length === 0 && <p>No entries found. Try another query or remove a filter.</p>}
        <ul>
          {results?.hits.map(hit => (
            <li key={hit.id}>
              <Link to={`/c/${hit.file.split("/").map(encodeURIComponent).join("/")}`}>{hit.name}</Link>
              <small> · {hit.category}</small>
              {hit.level !== undefined && hit.level !== null && <small> · Level {hit.level}</small>}
              {hit.rarity && <small> · {hit.rarity}</small>}
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

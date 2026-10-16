import { Link } from "react-router";
import type { SearchHit, SearchResponse } from "../search";
import { categoryLabel } from "../search/filters";
import { Icon } from "./ui";

export function ResultCard({
  hit,
  returnTo,
}: {
  hit: SearchHit;
  returnTo: string;
}) {
  return (
    <li className="result-card">
      <div className="result-meta">
        <span className={`resource-badge category-${hit.category}`}>
          {categoryLabel(hit.category)}
        </span>
        {hit.level != null && <span>Level {hit.level}</span>}
        {hit.rarity && <span>{hit.rarity}</span>}
      </div>
      <h2>
        <Link
          to={`/c/${hit.file.split("/").map(encodeURIComponent).join("/")}`}
          state={{ returnTo }}
        >
          {hit.name}
          <Icon name="arrow" />
        </Link>
      </h2>
      <p>{hit.summary}</p>
    </li>
  );
}

export function Pagination({
  results,
  pageLink,
}: {
  results: SearchResponse;
  pageLink: (page: number) => string;
}) {
  if (!results.pageCount) return null;
  return (
    <nav className="pagination" aria-label="Search pages">
      {results.page > 0 ? (
        <Link
          className="button secondary"
          rel="prev"
          to={pageLink(results.page - 1)}
        >
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span>
        Page <strong>{results.page + 1}</strong> of{" "}
        {results.pageCount.toLocaleString()}
      </span>
      {results.page + 1 < results.pageCount ? (
        <Link
          className="button secondary"
          rel="next"
          to={pageLink(results.page + 1)}
        >
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

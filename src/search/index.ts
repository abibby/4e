import { AlgoliaSearch } from "./algolia";
import type { Search } from "./search";

export type { Search, SearchRequest, SearchResponse, SearchHit, FieldFilters, NumericRange } from "./search";
export { AlgoliaSearch } from "./algolia";

export function createSearch(): Search {
  return new AlgoliaSearch({
    applicationId: import.meta.env.VITE_ALGOLIA_APP_ID ?? "",
    searchKey: import.meta.env.VITE_ALGOLIA_SEARCH_KEY ?? "",
    indexName: import.meta.env.VITE_ALGOLIA_INDEX_NAME ?? "",
  });
}

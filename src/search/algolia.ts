import { algoliasearch } from "algoliasearch";
import type { Search, SearchRequest, SearchResponse } from "./search.ts";

export interface AlgoliaConfig {
  applicationId: string;
  searchKey: string;
  indexName: string;
}

interface AlgoliaRecord {
  file: string;
  name: string;
  category: string;
  text: string;
  _tags: string[];
}

type SearchClient = Pick<ReturnType<typeof algoliasearch>, "searchSingleIndex">;

// The SDK doesn't expose AbortSignal support. Cancel waiting for a result;
// its shared/cached network request may still finish in the background.
function withCancellation<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) abort();
  });
}

export class AlgoliaSearch implements Search {
  private readonly config: AlgoliaConfig;
  private readonly client: SearchClient;

  constructor(config: AlgoliaConfig, client?: SearchClient) {
    if (!/^[a-zA-Z0-9]+$/.test(config.applicationId) || !config.searchKey || !config.indexName) {
      throw new Error("Configure VITE_ALGOLIA_APP_ID, VITE_ALGOLIA_SEARCH_KEY, and VITE_ALGOLIA_INDEX_NAME to enable search.");
    }
    this.config = { ...config };
    this.client = client ?? algoliasearch(config.applicationId, config.searchKey);
  }

  async search({ query = "", tags = [], page = 0, pageSize = 20, signal }: SearchRequest): Promise<SearchResponse> {
    if (!Number.isInteger(page) || page < 0 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new RangeError("Search page must be non-negative and pageSize must be between 1 and 100.");
    }
    signal?.throwIfAborted();
    const result = await withCancellation(this.client.searchSingleIndex<AlgoliaRecord>({
      indexName: this.config.indexName,
      searchParams: {
        query,
        // Array syntax preserves punctuation without building a filter expression.
        tagFilters: [...new Set(tags.filter(Boolean))].map(tag => tag.startsWith("-") ? `\\${tag}` : tag),
        page,
        hitsPerPage: pageSize,
        distinct: 1,
        attributesToRetrieve: ["file", "name", "category", "text", "_tags"],
        attributesToHighlight: [],
      },
    }), signal);
    return {
      hits: result.hits.map(hit => ({
        id: hit.file,
        file: hit.file,
        name: hit.name,
        category: hit.category,
        summary: hit.text.slice(0, 340),
        tags: hit._tags,
      })),
      total: result.nbHits ?? 0,
      page: result.page ?? page,
      pageSize: result.hitsPerPage ?? pageSize,
      pageCount: result.nbPages ?? 0,
    };
  }
}

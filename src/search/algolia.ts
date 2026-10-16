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
  level?: number;
  rarity?: string;
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

  async search({ query = "", filters = {}, tags = [], page = 0, pageSize = 20, signal }: SearchRequest): Promise<SearchResponse> {
    if (!Number.isInteger(page) || page < 0 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new RangeError("Search page must be non-negative and pageSize must be between 1 and 100.");
    }
    signal?.throwIfAborted();
    const facetFilters: string[] = [];
    const numericFilters: string[] = [];
    const tagFilters: string[] = [];
    const facet = (field: string, value: string) => `${field}:${value.startsWith("-") ? "\\" : ""}${value}`;
    const numeric = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
    for (const [field, value] of Object.entries(filters)) {
      if (!/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/i.test(field)) {
        throw new Error(`Invalid filter field: ${field}`);
      }
      if (typeof value === "string" || typeof value === "boolean") {
        facetFilters.push(facet(field, String(value)));
      } else if (typeof value === "number") {
        if (!numeric(value)) throw new RangeError(`Invalid numeric value for ${field}`);
        numericFilters.push(`${field} = ${value}`);
      } else {
        if (!value || (value.min === undefined && value.max === undefined)
          || (value.min !== undefined && !numeric(value.min))
          || (value.max !== undefined && !numeric(value.max))
          || (value.min !== undefined && value.max !== undefined && value.min > value.max)) {
          throw new RangeError(`Invalid range for ${field}: provide a minimum and/or maximum, with minimum <= maximum`);
        }
        if (value.min !== undefined && value.max !== undefined) {
          numericFilters.push(`${field}:${value.min} TO ${value.max}`);
        } else if (value.min !== undefined) numericFilters.push(`${field} >= ${value.min}`);
        else numericFilters.push(`${field} <= ${value.max}`);
      }
    }
    for (const tag of new Set(tags.filter(Boolean))) {
      const separator = tag.indexOf(":");
      if (separator > 0) {
        const field = tag.slice(0, separator);
        const value = tag.slice(separator + 1);
        // Escape a leading minus so a literal value doesn't become a NOT filter.
        facetFilters.push(facet(field, value));
      } else {
        tagFilters.push(tag.startsWith("-") ? `\\${tag}` : tag);
      }
    }
    const result = await withCancellation(this.client.searchSingleIndex<AlgoliaRecord>({
      indexName: this.config.indexName,
      searchParams: {
        query,
        // Array syntax preserves punctuation without building a filter expression.
        facetFilters,
        numericFilters,
        tagFilters,
        page,
        hitsPerPage: pageSize,
        distinct: 1,
        attributesToRetrieve: ["file", "name", "category", "text", "_tags", "level", "rarity"],
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
        level: hit.level,
        rarity: hit.rarity,
      })),
      total: result.nbHits ?? 0,
      page: result.page ?? page,
      pageSize: result.hitsPerPage ?? pageSize,
      pageCount: result.nbPages ?? 0,
    };
  }
}

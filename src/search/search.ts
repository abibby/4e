/** Provider-independent search over compendium entries. Pages are zero-based. */
export interface SearchRequest {
  query?: string;
  /** Exact, case-sensitive field:value tags. All tags must match. */
  tags?: readonly string[];
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}

export interface SearchHit {
  id: string;
  file: string;
  name: string;
  category: string;
  summary: string;
  tags: string[];
}

export interface SearchResponse {
  hits: SearchHit[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface Search {
  /** Empty query supports browsing, including tag-only searches. */
  search(request: SearchRequest): Promise<SearchResponse>;
}

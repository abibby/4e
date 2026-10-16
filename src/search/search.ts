/** Inclusive numeric bounds. Omit one bound for an open-ended range. */
export interface NumericRange {
  min?: number;
  max?: number;
}

export type FieldFilters = Readonly<Record<string, string | number | boolean | NumericRange>>;

/** Provider-independent search over compendium entries. Pages are zero-based. */
export interface SearchRequest {
  query?: string;
  /** Table field equality or numeric ranges. All conditions must match. */
  filters?: FieldFilters;
  /** field:value attribute filters, or explicit custom tags. All must match. */
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
  level?: number;
  rarity?: string;
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

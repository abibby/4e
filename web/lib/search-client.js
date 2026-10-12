export class SearchClient {
  constructor(config) { this.config = config; }
  async search(params, signal) {
    const {endpoint, searchKey, collection} = this.config;
    if (!endpoint || !searchKey) throw new Error('Search is not connected yet. Please try again later.');
    const url = new URL(`${endpoint}/collections/${encodeURIComponent(collection)}/documents/search`);
    url.search = new URLSearchParams({q: '*', query_by: 'name,searchable_metadata,text',
      query_by_weights: '8,2,1', prefix: 'true,false,false',
      include_fields: 'name,category,url,summary,metadata', highlight_fields: 'text',
      highlight_start_tag: '⟦', highlight_end_tag: '⟧', snippet_threshold: 40, ...params});
    const response = await fetch(url, {headers: {'X-TYPESENSE-API-KEY': searchKey}, signal});
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403
      ? 'Search is temporarily unavailable. Please try again later.'
      : 'Unable to load search results. Please try again.');
    return response.json();
  }
}

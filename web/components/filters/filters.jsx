import {useState} from 'react';
import {currentFields, featuredFields} from '../../lib/catalog.js';
import {FilterControl} from './filter-control.jsx';
import {ActiveFilters} from './active-filters.jsx';

export function Filters({catalog, state, setState, client, facets}) {
  const [attribute, setAttribute] = useState('');
  const fields = currentFields(catalog, state.category);
  const featured = featuredFields(catalog, state.category);
  function setFilter(key, value) {
    const filters = state.filters.filter(([name]) => name !== key);
    if (value) filters.push([key, value]);
    setState({...state, filters, page: 1});
  }
  const control = (field, suffix = '') => <FilterControl key={`${field}${suffix}`} field={field} descriptor={fields[field]}
    suffix={suffix} state={state} onCommit={setFilter} client={client}
    counts={facets?.find(facet => facet.field_name === `f_${field}`)?.counts}/>;

  return <aside className="filters" aria-label="Filter results">
    <div className="filter-heading"><h2>Refine your search</h2><button id="clear-filters" className="text-button" type="button"
      onClick={() => setState({...state, category: '', filters: [], page: 1})}>Reset</button></div>
    <label htmlFor="category">Category</label>
    <select id="category" value={state.category} onChange={event => setState({...state, category: event.target.value, filters: [], page: 1})}>
      <option value="">All categories</option>
      {Object.entries(catalog.categories).map(([key, category]) => <option key={key} value={key}>{category.label} ({category.count.toLocaleString()})</option>)}
    </select>
    <div id="category-filters">{featured.map(field => control(field))}</div>
    <details className="advanced"><summary>More attributes</summary><label htmlFor="attribute">Attribute</label>
      <select id="attribute" value={attribute} onChange={event => setAttribute(event.target.value)}>
        <option value="">Choose an attribute</option>
        {Object.entries(fields).sort((a, b) => a[1].label.localeCompare(b[1].label)).map(([key, info]) => <option key={key} value={key}>{info.label}</option>)}
      </select>
      <div id="attribute-filter">{fields[attribute] && control(attribute, '-extra')}</div>
    </details>
    <ActiveFilters filters={state.filters} fields={fields} onRemove={key => setFilter(key, '')}/>
  </aside>;
}

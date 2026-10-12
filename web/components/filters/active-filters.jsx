export function ActiveFilters({filters, fields, onRemove}) {
  return <div id="active-filters" className="active-filters" aria-label="Active filters">
    {filters.map(([key, value]) => {
      const field = key.replace(/^(f|min|max)_/, '');
      const text = `${fields[field]?.label || field} ${key.startsWith('min_') ? '≥ ' : key.startsWith('max_') ? '≤ ' : ''}${value}`;
      return <button key={key} type="button" className="filter-chip" aria-label={`Remove ${text} filter`} onClick={() => onRemove(key)}>{text} ×</button>;
    })}
  </div>;
}

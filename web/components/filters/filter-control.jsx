import {useEffect, useState} from 'react';
import {useFacetOptions} from '../../hooks/use-facet-options.js';

function FilterInput({id, field, descriptor, kind, value, onCommit, client, category, counts}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const suggestions = useFacetOptions({client, field, category, query: draft, enabled: !descriptor.numeric && focused});
  useEffect(() => { setDraft(value); }, [value]);

  function commit() {
    if (draft.trim() !== value) onCommit(`${kind}_${field}`, draft.trim());
  }

  return <>
    <input id={id} type={descriptor.numeric ? 'number' : 'text'} step={descriptor.numeric ? 'any' : undefined}
      aria-label={descriptor.numeric ? `${descriptor.label} ${kind === 'min' ? 'minimum' : 'maximum'}` : undefined}
      placeholder={descriptor.numeric ? (kind === 'min' ? 'Min' : 'Max') : 'Any'} value={draft}
      list={descriptor.numeric ? undefined : `${id}-values`} autoComplete="off"
      onChange={event => setDraft(event.target.value)} onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit(); }}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit(); } }}/>
    {!descriptor.numeric && <datalist id={`${id}-values`} data-field={field}>
      {(suggestions || counts || []).map(item => <option key={item.value} value={item.value}
        label={`${item.value} (${item.count.toLocaleString()} ${item.count === 1 ? 'entry' : 'entries'})`}/>)}
    </datalist>}
  </>;
}

export function FilterControl({field, descriptor, suffix = '', state, ...props}) {
  const id = `field-${field}${suffix}`;
  const input = kind => <FilterInput key={kind} {...props} category={state.category} descriptor={descriptor} field={field} kind={kind}
    id={kind === 'max' ? `${id}-max` : id} value={state.filters.find(([key]) => key === `${kind}_${field}`)?.[1] || ''}/>;
  return <div className="filter-control"><label htmlFor={id}>{descriptor.label}</label>
    {descriptor.numeric ? <div className="range">{input('min')}{input('max')}</div> : input('f')}
  </div>;
}

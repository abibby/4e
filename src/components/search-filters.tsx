import { useId, useState } from "react";
import { InputField, SelectField, Icon } from "./ui";
import { categories, filterDefinitions } from "../search/filters";
import type { SearchState } from "../search/filters";
import { useSearchForm } from "../hooks/use-search";

export function SearchFilters({ state }: { state: SearchState }) {
  const [expanded, setExpanded] = useState(false);
  const controlsId = useId();
  const { values, setValue, busy } = useSearchForm(state);
  const visibleFields = filterDefinitions.filter(
    (field) =>
      !values.category ||
      !field.categories ||
      field.categories.includes(values.category) ||
      values[field.name],
  );
  return (
    <aside className="filter-panel" aria-label="Search filters">
      <div className="filter-title">
        <Icon name="filter" />
        <h2>Refine your search</h2>
        <button
          type="button"
          className="filter-toggle"
          aria-controls={controlsId}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Hide" : "Show"} filters
        </button>
      </div>
      <div
        id={controlsId}
        className="filter-controls"
        data-expanded={expanded}
        onInvalidCapture={() => setExpanded(true)}
      >
        <SelectField
          label="Resource type"
          name="category"
          value={values.category}
          onChange={(event) => setValue("category", event.target.value)}
        >
          <option value="">All resources</option>
          {values.category &&
            !categories.some(([value]) => value === values.category) && (
              <option value={values.category}>{values.category}</option>
            )}
          {categories.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <fieldset className="level-fields">
          <legend>Level range</legend>
          <div className="field-pair">
            <InputField
              label="Minimum level"
              name="minLevel"
              type="number"
              min="0"
              step="1"
              placeholder="Min"
              value={values.minLevel}
              onChange={(event) => setValue("minLevel", event.target.value)}
            />
            <InputField
              label="Maximum level"
              name="maxLevel"
              type="number"
              min={values.minLevel || "0"}
              step="1"
              placeholder="Max"
              value={values.maxLevel}
              onChange={(event) => setValue("maxLevel", event.target.value)}
            />
          </div>
          <p className="field-hint">Includes both ends of the range.</p>
        </fieldset>
        <details
          className="specific-filters"
          open={Boolean(values.category)}
          key={values.category}
        >
          <summary>
            {values.category ? "Resource details" : "More resource filters"}
          </summary>
          <div className="filter-fields">
            {visibleFields.map((field) =>
              field.options ? (
                <SelectField
                  key={field.name}
                  label={field.label}
                  name={field.name}
                  value={values[field.name]}
                  onChange={(event) => setValue(field.name, event.target.value)}
                >
                  <option value="">Any</option>
                  {values[field.name] &&
                    !field.options.includes(values[field.name]) && (
                      <option value={values[field.name]}>
                        {values[field.name]}
                      </option>
                    )}
                  {field.options.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </SelectField>
              ) : (
                <InputField
                  key={field.name}
                  label={field.label}
                  name={field.name}
                  placeholder={field.placeholder}
                  value={values[field.name]}
                  onChange={(event) => setValue(field.name, event.target.value)}
                />
              ),
            )}
          </div>
          <p className="field-hint">
            Text filters match exact field values. Source references may include
            page numbers. Use the main search for partial matches.
          </p>
        </details>
        <SelectField
          label="Results per page"
          name="pageSize"
          defaultValue={state.pageSize}
        >
          {[20, 40, 60].map((size) => (
            <option key={size} value={size}>
              {size} results
            </option>
          ))}
        </SelectField>
        <button
          className="button primary apply-filters"
          type="submit"
          disabled={busy}
        >
          {busy ? "Applying…" : "Apply filters"}
          <Icon name="arrow" />
        </button>
      </div>
    </aside>
  );
}

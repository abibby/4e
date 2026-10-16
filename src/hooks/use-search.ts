import { useState } from "react";
import { useNavigation } from "react-router";
import { filterDefinitions, searchLink } from "../search/filters";
import type { SearchState } from "../search/filters";

/** Draft filters are applied together; changing resource type drops incompatible fields. */
export function useSearchForm(initial: SearchState) {
  const [values, setValues] = useState(initial.values);
  const busy = useNavigation().state !== "idle";
  function setValue(name: string, value: string) {
    setValues((current) => {
      const next = { ...current, [name]: value };
      if (name === "category" && value) {
        for (const field of filterDefinitions) {
          if (field.categories && !field.categories.includes(value))
            next[field.name] = "";
        }
      }
      return next;
    });
  }
  return { values, setValue, busy };
}

/** Every result navigation retains the complete applied search, including custom tags. */
export function useSearchLinks(state: SearchState) {
  return {
    pageLink: (page: number) => searchLink(state, page),
    removeFilter: (name: string) =>
      searchLink({ ...state, values: { ...state.values, [name]: "" } }),
    removeTag: (index: number) =>
      searchLink({ ...state, tags: state.tags.filter((_, i) => i !== index) }),
    clearFilters: searchLink({ ...state, values: {}, tags: [] }),
  };
}

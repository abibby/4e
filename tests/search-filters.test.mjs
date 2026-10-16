import assert from "node:assert/strict";
import { test } from "node:test";
import {
  readSearchParams,
  searchLink,
  toFieldFilters,
} from "../src/search/filters.ts";

const read = (query) => readSearchParams(new URLSearchParams(query));

test("resource filters, repeated tags, query and page size survive URL round trips", () => {
  const state = read(
    "q=fire+%26+ice&category=power&usage=Daily&action=Minor+Action&class_or_path=Wizard&keywords=Fire&minLevel=0&maxLevel=12&tag=custom&tag=sources%3ABook%3A+Chapter+1&pageSize=40&page=3",
  );
  assert.deepEqual(
    readSearchParams(
      new URL(searchLink(state, 3), "https://example.test").searchParams,
    ),
    state,
  );
  assert.deepEqual(toFieldFilters(state), {
    category: "power",
    class_or_path: "Wizard",
    usage: "Daily",
    action: "Minor Action",
    keywords: "Fire",
    level: { min: 0, max: 12 },
  });
  assert.equal(
    new URL(searchLink(state), "https://example.test").searchParams.has("page"),
    false,
  );
});

test("invalid URL levels are rejected before contacting the search provider", () => {
  for (const query of [
    "minLevel=no",
    "minLevel=-1",
    "maxLevel=1.5",
    "maxLevel=Infinity",
    "minLevel=10&maxLevel=2",
  ]) {
    assert.throws(() => toFieldFilters(read(query)), /level/i);
  }
  assert.deepEqual(toFieldFilters(read("minLevel=3")), {
    level: { min: 3, max: undefined },
  });
  assert.deepEqual(toFieldFilters(read("maxLevel=0")), {
    level: { min: undefined, max: 0 },
  });
});

test("invalid pagination defaults safely; empty filters do not constrain browsing", () => {
  for (const page of ["-1", "1.5", "abc", "Infinity"])
    assert.equal(read(`page=${page}`).page, 0);
  assert.equal(read("pageSize=1000").pageSize, 20);
  assert.deepEqual(toFieldFilters(read("category=+&tag=+&rarity=")), {});
  assert.equal(searchLink(read("")), "/search");
});

import { randomUUID } from "node:crypto";
import { open, readFile, readdir } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { algoliasearch } from "algoliasearch";
import { decodeHTML } from "entities";
import { parse, SyntaxKind } from "html5parser";
import type { INode } from "html5parser";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_RECORD_BYTES = 9_000;
const OVERLAP = 200;
const TAG_LABEL_FIELDS = [
  "category", "level", "role", "rank", "rarity", "item_type", "slot",
  "class_or_path", "power_type", "usage", "action", "tier", "keywords",
  "size", "origin", "creature_type", "power_source", "category_label", "sources",
];
const VARIANT_FIELDS = ["level", "price", "enhancement"];
const RECORD_FIELDS = new Set(["objectID", "text", "_tags"]);
const BLOCKS = new Set("h1 h2 h3 h4 h5 h6 p div blockquote table tr td th li ul ol br hr".split(" "));

type FieldValue = string | number | boolean;
type FilterFields = Record<string, FieldValue | FieldValue[]>;
type AlgoliaEntry = FilterFields & {
  file: string;
  name: string;
  category: string;
  text: string;
  _tags: string[];
};
export type AlgoliaRecord = AlgoliaEntry & { objectID: string };

type TableRow = Record<string, unknown> & { file: string; name: string; category: string };
type UploadClient = Pick<ReturnType<typeof algoliasearch>, "setSettings" | "waitForTask" | "saveObjects" | "operationIndex">;

export function htmlToText(html: string): string {
  const parts: string[] = [];
  function visit(nodes: INode[]) {
    for (const node of nodes) {
      if (node.type === SyntaxKind.Text) {
        parts.push(decodeHTML(node.value));
        continue;
      }
      if (["script", "style", "template", "head", "!--", "!doctype"].includes(node.name)) continue;
      const block = BLOCKS.has(node.name);
      if (block) parts.push(" ");
      if (node.name === "img") {
        const src = node.attributes.find(attribute => attribute.name.value === "src")?.value?.value ?? "";
        parts.push(/(?:bullet|x)\.gif$/i.test(src) ? " • " : " ");
      }
      visit(node.body ?? []);
      if (block) parts.push(" ");
    }
  }
  visit(parse(html));
  return parts.join("").replace(/\s+/gu, " ").trim();
}

export function fieldsFor(row: TableRow, extraFields: string[] = []): FilterFields {
  const fields: FilterFields = {};
  function valuesFor(value: unknown): FieldValue[] {
    if (Array.isArray(value)) return [...new Set(value.flatMap(valuesFor))];
    if (typeof value === "string" && value.trim()) return [value.trim()];
    if (typeof value === "number" && Number.isFinite(value)) return [value];
    if (typeof value === "boolean") return [value];
    return [];
  }
  for (const field of extraFields) {
    if (!/^[a-z][a-z0-9_]*$/i.test(field) || RECORD_FIELDS.has(field) || field === "tags") {
      throw new Error(`Invalid filter field: ${field}`);
    }
  }
  // Index every scalar/array column. `attributes` is the extractor's duplicate
  // prose map; object-valued columns aren't scalar filter fields.
  for (const field of Object.keys(row)) {
    if (RECORD_FIELDS.has(field)) continue;
    const values = valuesFor(row[field]);
    if (values.length) fields[field] = Array.isArray(row[field]) ? values : values[0];
  }
  if (Array.isArray(row.variants)) {
    for (const field of VARIANT_FIELDS) {
      const values = valuesFor(row.variants.map(variant => variant?.[field]));
      if (values.length) fields[`variant_${field}`] = values;
    }
  }
  return fields;
}

export function tagsFor(row: TableRow, extraFields: string[] = []): string[] {
  const tags = new Set<string>();
  function add(value: unknown, prefix = "") {
    if (Array.isArray(value)) {
      for (const item of value) add(item, prefix);
    } else if (["string", "number", "boolean"].includes(typeof value) && String(value).trim()) {
      tags.add(prefix + String(value).trim());
    }
  }
  add(row.tags);
  add(row._tags);
  // Retain tag labels for existing SearchHit consumers and explicit custom tags.
  const fields = fieldsFor(row, extraFields);
  for (const field of [...TAG_LABEL_FIELDS, ...extraFields, ...VARIANT_FIELDS.map(field => `variant_${field}`)]) {
    add(fields[field], `${field}:`);
  }
  return [...tags].sort();
}

export function chunkRecord(base: AlgoliaEntry): AlgoliaRecord[] {
  const characters = Array.from(base.text);
  const records: AlgoliaRecord[] = [];
  let start = 0;
  do {
    const record = { ...base, objectID: `${base.file}#${records.length}`, text: "" };
    let low = 0;
    let high = Math.min(characters.length - start, MAX_RECORD_BYTES);
    // Measure serialized UTF-8, including escaped quotes and metadata, not JS string length.
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      record.text = characters.slice(start, start + middle).join("");
      if (Buffer.byteLength(JSON.stringify(record)) < MAX_RECORD_BYTES) low = middle;
      else high = middle - 1;
    }
    record.text = characters.slice(start, start + low).join("");
    if ((!low && characters.length) || Buffer.byteLength(JSON.stringify(record)) >= MAX_RECORD_BYTES) {
      throw new Error(`Metadata is too large for an Algolia record: ${base.file}`);
    }
    records.push(record);
    if (start + low >= characters.length) break;
    start += low - Math.min(OVERLAP, Math.floor(low / 2));
  } while (start < characters.length);
  return records;
}

async function filesIn(directory: string, extension: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(path, extension));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(extension)) files.push(path);
  }
  return files.sort();
}

export async function buildRecords(
  contentDirectory = join(ROOT, "public/content"),
  tablesDirectory = join(ROOT, "tables"),
  extraFields: string[] = [],
): Promise<AlgoliaRecord[]> {
  const metadata = new Map<string, TableRow>();
  for (const path of await filesIn(tablesDirectory, ".json")) {
    const rows: unknown = JSON.parse(await readFile(path, "utf8"));
    if (!Array.isArray(rows)) throw new Error(`Expected an array in ${path}`);
    for (const row of rows) {
      if (!row || typeof row.file !== "string" || typeof row.name !== "string" || typeof row.category !== "string") {
        throw new Error(`Invalid table row in ${path}: file, name, and category must be strings`);
      }
      if (metadata.has(row.file)) throw new Error(`Duplicate table entry: ${row.file}`);
      metadata.set(row.file, row);
    }
  }
  const records: AlgoliaRecord[] = [];
  for (const path of await filesIn(contentDirectory, ".html")) {
    // Match the table generator: directory navigation pages aren't resources.
    if (basename(path).toLowerCase() === "index.html") continue;
    const file = relative(contentDirectory, path).split(sep).join("/");
    const row = metadata.get(file);
    if (!row) throw new Error(`Missing table metadata for ${file}; run python3 build/indexgen.py`);
    records.push(...chunkRecord({
      ...fieldsFor(row, extraFields),
      file, name: row.name, category: row.category,
      text: htmlToText(await readFile(path, "utf8")),
      _tags: tagsFor(row, extraFields),
    }));
  }
  if (!records.length) throw new Error("No HTML files found; refusing to build an empty index");
  return records;
}

export async function uploadRecords(client: UploadClient, indexName: string, records: AlgoliaRecord[]) {
  if (!records.length) throw new Error("Refusing to upload an empty index");
  const filterFields = new Set<string>();
  for (const record of records) {
    for (const field of Object.keys(record)) {
      if (!RECORD_FIELDS.has(field)) filterFields.add(field);
    }
  }
  const temporaryIndex = `${indexName}_tmp_${randomUUID()}`;
  console.log(`Uploading ${records.length} records to ${temporaryIndex}`);
  try {
    const settings = await client.setSettings({
      indexName: temporaryIndex,
      indexSettings: {
        searchableAttributes: ["name", "text"],
        attributesForFaceting: [...filterFields].sort().map(field => `filterOnly(${field})`),
        attributeForDistinct: "file",
        distinct: 1,
        attributesToHighlight: [],
      },
    });
    await client.waitForTask({ indexName: temporaryIndex, taskID: settings.taskID });
    await client.saveObjects({ indexName: temporaryIndex, objects: records, batchSize: 500, waitForTasks: true });
    const move = await client.operationIndex({
      indexName: temporaryIndex,
      operationIndexParams: { operation: "move", destination: indexName },
    });
    await client.waitForTask({ indexName, taskID: move.taskID });
    console.log(`Uploaded ${records.length} records to ${indexName}`);
  } catch (error) {
    console.error(`Upload failed. Check ${indexName} and temporary index ${temporaryIndex} in the Algolia dashboard.`);
    throw error;
  }
}

async function main() {
  const { values } = parseArgs({ options: {
    upload: { type: "boolean", default: false },
    output: { type: "string" },
    index: { type: "string" },
    "tag-field": { type: "string", multiple: true, default: [] },
    help: { type: "boolean", default: false },
  } });
  if (values.help) {
    console.log("npm run index:algolia -- [--upload] [--index NAME] [--output FILE.jsonl] [--tag-field FIELD]");
    return;
  }
  try { loadEnvFile(join(ROOT, ".env")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const appId = process.env.ALGOLIA_APP_ID;
  const adminKey = process.env.ALGOLIA_ADMIN_KEY;
  const indexName = values.index ?? process.env.ALGOLIA_INDEX_NAME ?? "compendium";
  if (values.upload && (!appId || !adminKey || !indexName.trim())) {
    throw new Error("Set ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY, and ALGOLIA_INDEX_NAME in .env or the environment");
  }
  const records = await buildRecords(undefined, undefined, values["tag-field"]);
  console.log(`Validated ${records.length} records from ${new Set(records.map(record => record.file)).size} HTML files`);
  if (values.output) {
    const output = await open(values.output, "w");
    try { for (const record of records) await output.write(`${JSON.stringify(record)}\n`); }
    finally { await output.close(); }
    console.log(`Wrote ${values.output}`);
  }
  if (values.upload) await uploadRecords(algoliasearch(appId!, adminKey!), indexName, records);
  else console.log("Dry run complete. Add --upload to replace the Algolia index.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

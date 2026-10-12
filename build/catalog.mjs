import {existsSync, readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';

export const labels = {
  associate: 'Associates', background: 'Backgrounds', class: 'Classes', deity: 'Deities',
  disease: 'Diseases', epicdestiny: 'Epic destinies', feat: 'Feats', glossary: 'Rules & glossary',
  item: 'Items', monster: 'Monsters', paragonpath: 'Paragon paths', power: 'Powers',
  race: 'Races', ritual: 'Rituals', terrain: 'Terrain', theme: 'Themes', trap: 'Traps',
};
const excluded = new Set(['file', 'name', 'category', 'text', 'attributes', 'variants', 'level_text']);
const featured = 'level role rank rarity item_type slot class_or_path power_type usage action tier keywords size origin creature_type power_source category_label sources'.split(' ');
export function label(key) {
  return {hp: 'HP', xp: 'XP', ac: 'AC', category_label: 'Type / category',
    variant_level: 'Variant level', variant_price: 'Variant price', variant_enhancement: 'Variant enhancement'}[key]
    || key.replaceAll('_', ' ').replace(/^./, char => char.toUpperCase());
}
function values(value) {
  return value == null || value === '' ? [] : (Array.isArray(value) ? value : [value]).map(String);
}

export function loadTables(directory) {
  const files = existsSync(directory) ? readdirSync(directory).filter(file => file.endsWith('.json')).sort() : [];
  if (!files.length) throw new Error('No tables found. Run python3 build/indexgen.py to prepare content metadata first.');
  const rows = files.flatMap(file => JSON.parse(readFileSync(path.join(directory, file), 'utf8')));
  const seen = new Set();
  for (const row of rows) {
    if (typeof row.file !== 'string' || path.posix.isAbsolute(row.file) || row.file.includes('\\')
        || row.file.split('/').some(part => ['..', '.', ''].includes(part)) || !/\.html$/i.test(row.file)) {
      throw new Error(`Unsafe content path: ${row.file}`);
    }
    if (seen.has(row.file)) throw new Error(`Duplicate content path: ${row.file}`);
    seen.add(row.file);
  }
  return rows;
}

// Keep this contract aligned with build/searchdata.py, which defines the Typesense fields.
export function catalog(rows) {
  const categories = {};
  for (const row of rows) {
    const category = categories[row.category] ||= {label: labels[row.category] || label(row.category), count: 0, fields: {}};
    category.count++;
    const fields = Object.fromEntries(Object.entries(row).filter(([key]) => !excluded.has(key)).map(([key, value]) => [key, values(value)]));
    for (const key of ['level', 'price', 'enhancement']) {
      fields[`variant_${key}`] = (row.variants || []).flatMap(variant => values(variant[key]));
    }
    for (const [key, vals] of Object.entries(fields)) {
      if (!vals.length) continue;
      if (!/^[a-z][a-z0-9_]*$/.test(key)) throw new Error(`Invalid field name: ${key}`);
      const field = category.fields[key] ||= {label: label(key), numeric: true};
      field.numeric &&= vals.every(value => /^-?\d+(?:\.\d+)?$/.test(value));
    }
  }
  return {count: rows.length, categories, featured};
}


// Прогоняет Babel-парсер по всем .jsx (sourceType:module, plugin jsx) — ТЗ §5.
// Использует @babel/parser из зависимостей vite (транзитивно доступен).
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.jsx?$/.test(name)) out.push(p);
  }
  return out;
}

let ok = 0;
let failed = 0;
for (const file of walk(root)) {
  try {
    parse(readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
    ok++;
  } catch (e) {
    failed++;
    console.error(`FAIL ${file}\n  ${e.message}`);
  }
}
console.log(`\nBabel JSX parse: ${ok} ok, ${failed} failed`);
process.exit(failed ? 1 : 0);

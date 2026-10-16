import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allowedProjectPath, editableProjectPath } from '../src/features/admin/projectFiles.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const roots = ['src', 'public', 'assets', 'supabase', 'scripts', 'tests', 'docs', 'android'];
const files = [];
const visited = new Set();
async function walk(relative = '') {
  for (const item of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
    const name = relative ? `${relative}/${item.name}` : item.name;
    if (!allowedProjectPath(name) || item.isSymbolicLink()) continue;
    if (item.isDirectory()) { if (relative || roots.includes(item.name)) { visited.add(name); await walk(name); } }
    else if (item.isFile() && name !== 'src/features/admin/projectCatalog.generated.json' && (editableProjectPath(name) || /\.(png|jpe?g|webp|gif|ico|woff2?|webmanifest)$/.test(name) || name === 'package-lock.json') && !/^tests\/.*\.png$/.test(name)) files.push(name);
  }
}
await walk();
files.sort();
const known = new Set(files);
const entries = [];
for (const name of files) {
  const stat = await fs.stat(path.join(root, name));
  const imports = new Set();
  if (/\.(jsx?|mjs|tsx?)$/.test(name) && stat.size <= 1024 * 1024) {
    const source = await fs.readFile(path.join(root, name), 'utf8');
    for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"](\.[^'"\r\n]+)['"]/g)) {
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(name), match[1]));
      const resolved = [base, ...['.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx'].map(ext => base + ext)].find(candidate => known.has(candidate));
      if (resolved && resolved !== name) imports.add(resolved);
    }
  }
  entries.push({ path: name, editable: editableProjectPath(name), size: stat.size, imports: [...imports].sort() });
}
const folders = [...new Set([...visited, ...entries.flatMap(item => {
  const parts = item.path.split('/');
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'));
})])].sort();
const catalog = { schema: 1, folders, files: entries, excluded: ['Git — поставляемые инструменты Git, не код DAYRIS', 'node_modules — установленные библиотеки', 'dist и build — результаты сборки', 'artifacts — временные проверки и снимки', '.git — история Git', '.android-sdk*, .jdk17, .mt5-* — локальные инструменты', '.env*, ключи, credentials и secrets — закрытые настройки'] };
await fs.writeFile(path.join(root, 'src/features/admin/projectCatalog.generated.json'), JSON.stringify(catalog));
console.log(`Project catalog: ${folders.length} folders, ${entries.length} files (no source contents or secrets).`);

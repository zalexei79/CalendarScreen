// No network calls, code execution or arbitrary filesystem paths in this module.
const BLOCKED = /(^|\/)(\.[^/]+|node_modules|dist|Git|build|\.gradle|artifacts)(\/|$)|(^|\/)(.*\.(?:pem|key|keystore|jks|p12|pfx)|credentials[^/]*|secrets?[^/]*|local\.properties)$/i;
const TEXT = /\.(?:jsx?|mjs|tsx?|css|html|md|json|sql|toml|xml|java|kt|gradle|properties|py|ps1|sh|bat|txt|svg|webmanifest)$/i;
export const MAX_FILE_BYTES = 1024 * 1024;
export function allowedProjectPath(path) {
  return typeof path === 'string' && path.length <= 300 && !path.includes('\\') && !path.includes(':') && !/[\x00-\x1f]/.test(path) && !path.startsWith('/') && path.split('/').every(part => part && part !== '.' && part !== '..') && !BLOCKED.test(path);
}
export function editableProjectPath(path) {
  return allowedProjectPath(path) && TEXT.test(path) && !/(^|\/)(package-lock\.json|projectCatalog\.generated\.json|conversation\.mjs)$/.test(path);
}
export function fileRisk(path) {
  return /^(supabase|scripts|android)\/|(^|\/)(package\.json|vite\.config\.js|sw\.js)$|\/auth\/|\/admin\//.test(path) ? 'high' : 'normal';
}
async function fileHandle(root, path) {
  if (!allowedProjectPath(path)) throw new Error('Этот путь закрыт: секреты, служебные папки и выход за пределы проекта недоступны.');
  const parts = path.split('/');
  let directory = root;
  for (const name of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(name);
  return directory.getFileHandle(parts.at(-1));
}
export async function validateProjectRoot(root, expectedWorkspace) {
  const pkg = await (await root.getFileHandle('package.json')).getFile();
  if (pkg.size > MAX_FILE_BYTES || JSON.parse(await pkg.text()).name !== 'ai-trade-journal') throw new Error('Выберите корень DAYRIS: папку ai-trade-journal с package.json и src/main.jsx.');
  await fileHandle(root, 'src/main.jsx');
  if (expectedWorkspace) {
    try {
      const file = await (await root.getFileHandle('.dayris-project-desk.json')).getFile();
      if (file.size > 1024 || JSON.parse(await file.text()).workspace !== expectedWorkspace) throw new Error();
    } catch { throw new Error('Выбрана другая копия проекта. Выберите папку, в которой запущено npm run project:desk.'); }
  }
}
export async function readProjectFile(root, path) {
  const file = await (await fileHandle(root, path)).getFile();
  if (file.size > MAX_FILE_BYTES) throw new Error('Файл больше 1 МБ. Откройте его в обычном редакторе.');
  if (!TEXT.test(path)) throw new Error('Изображения и двоичные файлы здесь не открываются.');
  const text = await file.text();
  if (text.includes('\0')) throw new Error('Двоичный файл нельзя редактировать как текст.');
  return { text, modified: file.lastModified, size: file.size };
}
export async function saveProjectFile(root, path, original, text) {
  if (!editableProjectPath(path)) throw new Error('Этот файл доступен только для чтения.');
  if (new Blob([text]).size > MAX_FILE_BYTES) throw new Error('Текст больше 1 МБ.');
  if (path.endsWith('.json')) { try { JSON.parse(text); } catch { throw new Error('Ошибка JSON. Исправьте синтаксис перед сохранением.'); } }
  const handle = await fileHandle(root, path);
  const check = async () => {
    const file = await handle.getFile();
    if (file.size > MAX_FILE_BYTES || await file.text() !== original.text) throw new Error('Файл изменился в другом редакторе. Скачайте свой вариант, затем заново откройте файл. Перезапись отменена.');
  };
  await check();
  const stamp = `${new Date().toISOString().replace(/[:.]/g, '-')}-${Array.from(crypto.getRandomValues(new Uint8Array(4)), n => n.toString(16).padStart(2, '0')).join('')}`;
  let backup = await root.getDirectoryHandle('.dayris-project-backups', { create: true });
  backup = await backup.getDirectoryHandle(stamp, { create: true });
  const parts = path.split('/');
  for (const part of parts.slice(0, -1)) backup = await backup.getDirectoryHandle(part, { create: true });
  const backupFile = await backup.getFileHandle(parts.at(-1), { create: true });
  async function write(handle, value) {
    const writer = await handle.createWritable();
    try { await writer.write(value); await writer.close(); } catch (error) { try { await writer.abort(); } catch { /* Preserve the original failure. */ } throw error; }
  }
  // A failed backup must prevent writing the actual source.
  await write(backupFile, original.text);
  await check();
  await write(handle, text);
  return { snapshot: await readProjectFile(root, path), backup: `.dayris-project-backups/${stamp}/${path}` };
}

import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { allowedProjectPath, editableProjectPath } from '../src/features/admin/projectFiles.js';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PORT = 5173;
export function validDeskRequest(request, token, port = PORT) {
  const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  const origin = request.headers.origin;
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)
    && hosts.includes(request.headers.host)
    && (!origin || hosts.some(host => origin === `http://${host}`))
    && (!request.headers['sec-fetch-site'] || ['same-origin', 'none'].includes(request.headers['sec-fetch-site']))
    && request.headers['x-dayris-desk-token'] === token;
}
export async function runCommand(bin, args, { cwd = ROOT, log = () => {}, timeout = 300000, env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, shell: false, windowsHide: true, env: { ...process.env, ...env, GIT_TERMINAL_PROMPT: '0' } });
    let output = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
    const consume = bytes => { const text = bytes.toString(); output = (output + text).slice(-100000); log(text); };
    child.stdout.on('data', consume); child.stderr.on('data', consume);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); if (code === 0 && !timedOut) resolve(output); else reject(new Error(timedOut ? 'Превышено время ожидания команды. Проверьте процессы в терминале.' : `Команда завершилась с кодом ${code}.\n${output.slice(-3000)}`)); });
  });
}
export function makeDeskService({ root = ROOT, run = runCommand } = {}) {
  let current = null, counter = 0;
  const git = (args, log) => run('git', args, { cwd: root, log });
  const digest = async name => {
    if (!editableProjectPath(name)) throw new Error(`Недоступный исходник: ${name}`);
    const target = path.resolve(root, ...name.split('/'));
    let segment = root;
    for (const part of name.split('/')) { segment = path.join(segment, part); if ((await fs.lstat(segment)).isSymbolicLink()) throw new Error('Символические ссылки не публикуются из мастерской.'); }
    const real = await fs.realpath(target), realRoot = await fs.realpath(root);
    if (!real.startsWith(realRoot + path.sep)) throw new Error('Ссылка выходит за пределы проекта.');
    const stat = await fs.stat(real);
    if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error('Публикация файла этого типа/размера недоступна.');
    return createHash('sha256').update(await fs.readFile(real)).digest('hex');
  };
  async function status() {
    const [branch, head, remote, unstaged, untracked, staged] = await Promise.all([
      git(['branch', '--show-current']), git(['rev-parse', 'HEAD']), git(['remote', 'get-url', 'origin']),
      git(['diff', '--name-only', '-z', '--diff-filter=ACM']), git(['ls-files', '--others', '--exclude-standard', '-z']), git(['diff', '--cached', '--name-only', '-z']),
    ]);
    const names = [...new Set((unstaged + '\0' + untracked).split('\0').filter(name => name && allowedProjectPath(name) && editableProjectPath(name)))].sort();
    const files = [];
    for (const name of names) { try { files.push({ path: name, hash: await digest(name) }); } catch { /* Missing, too large or symlinked file: never stage it. */ } }
    return { branch: branch.trim(), head: head.trim(), remote: remote.trim(), files, hasStaged: Boolean(staged.replace(/\0/g, '').trim()) };
  }
  const snapshot = () => current && { ...current };
  function start(kind, input = {}) {
    if (current?.state === 'running') throw new Error('Другая операция ещё выполняется.');
    if (!['build', 'publish'].includes(kind)) throw new Error('Неизвестная операция.');
    const job = { id: ++counter, kind, state: 'running', phase: 'Подготовка', log: '', commit: null };
    current = job;
    const log = text => { job.log = (job.log + text).slice(-60000); };
    job.done = (async () => {
      try {
        let selected;
        if (kind === 'publish') {
          const state = await status();
          if (state.branch !== 'main' || !/^https:\/\/github\.com\/zalexei79\/CalendarScreen(?:\.git)?$/i.test(state.remote)) throw new Error('Публикация разрешена только из main в известный origin CalendarScreen.');
          if (state.hasStaged) throw new Error('В Git уже есть подготовленные изменения. Разберите staging в терминале — мастерская их не тронет.');
          if (state.head !== input.head) throw new Error('HEAD изменился. Обновите список изменений.');
          if (typeof input.message !== 'string' || !input.message.trim() || input.message.length > 200 || /[\x00-\x1f]/.test(input.message)) throw new Error('Нужен комментарий к commit длиной 1–200 символов.');
          if (!Array.isArray(input.files) || !input.files.length || input.files.length > 100) throw new Error('Выберите от 1 до 100 исходников.');
          selected = [...new Set(input.files)];
          for (const name of selected) {
            const file = state.files.find(file => file.path === name);
            if (!file || file.hash !== input.hashes?.[name]) throw new Error('Список или содержимое файлов изменились. Обновите список и проверьте выбор.');
          }
          await git(['var', 'GIT_AUTHOR_IDENT']);
        }
        job.phase = 'Сборка'; log('> npm run build\n');
        await run(process.platform === 'win32' ? 'cmd.exe' : 'npm', process.platform === 'win32' ? ['/d', '/s', '/c', 'npm run build'] : ['run', 'build'], { cwd: root, log, env: { NODE_ENV: 'production' } });
        job.phase = 'Базовые тесты'; log('> node --test (project / admin safety)\n');
        await run(process.execPath, ['--test', 'tests/site-config.test.mjs', 'tests/admin-service-worker.test.mjs', 'tests/project-files.test.mjs', 'tests/project-desk-server.test.mjs'], { cwd: root, log });
        if (kind === 'build') { job.phase = 'Сборка и базовые тесты прошли. Проверьте изменённый экран и профильные тесты.'; job.state = 'success'; return; }
        job.phase = 'Проверка перед commit';
        const after = await status();
        if (after.head !== input.head || after.hasStaged) throw new Error('Состояние Git изменилось во время сборки. Ничего не отправлено.');
        for (const name of selected) if (await digest(name) !== input.hashes[name]) throw new Error('Исходник изменился во время сборки. Ничего не отправлено.');
        await git(['diff', '--check', '--', ...selected], log);
        await git(['add', '--', ...selected], log);
        const staged = (await git(['diff', '--cached', '--name-only', '-z'])).split('\0').filter(Boolean).sort();
        if (JSON.stringify(staged) !== JSON.stringify([...selected].sort())) throw new Error('Staging отличается от выбранных файлов. Проверьте git status в терминале.');
        await git(['diff', '--cached', '--check'], log);
        job.phase = 'Commit'; await git(['commit', '-m', input.message.trim()], log);
        job.commit = (await git(['rev-parse', 'HEAD'])).trim();
        job.phase = 'Push в origin/main'; await git(['push', 'origin', 'main'], log);
        job.phase = 'Push выполнен. Дождитесь Render и проверьте HTTPS-сайт — push ещё не подтверждает успешный выпуск.'; job.state = 'success';
      } catch (error) {
        job.state = 'failed'; job.phase = error.message;
        if (job.commit) job.phase += `\nЛокальный commit ${job.commit} создан. Если push не удался, исправьте подключение и выполните git push origin main в терминале. Не создавайте повторный commit.`;
        log(`\nОстановлено: ${job.phase}\n`);
      }
    })();
    return job.id;
  }
  return { status, start, snapshot: () => { const value = snapshot(); if (value) delete value.done; return value; }, wait: () => current?.done };
}

export async function startDesk() {
  const token = randomBytes(32).toString('hex');
  const workspace = randomBytes(16).toString('hex');
  const service = makeDeskService();
  const server = await createServer({
    root: ROOT,
    optimizeDeps: { entries: ['index.html', 'admin.html', 'project-desk.html'] },
    server: { host: '127.0.0.1', port: PORT, strictPort: true, cors: false, allowedHosts: ['127.0.0.1', 'localhost'], watch: { ignored: ['**/Git/**', '**/.android*/**', '**/.jdk17/**', '**/.mt5*/**', '**/artifacts/**', '**/android/**', '**/.dayris-project-backups/**', '**/projectCatalog.generated.json', '**/.dayris-project-desk.json'] } },
    plugins: [react(), {
      name: 'dayris-local-project-desk',
      transformIndexHtml(html, context) {
        return context.path === '/project-desk.html' ? html.replace('</head>', `<script>window.__DAYRIS_DESK_TOKEN__=${JSON.stringify(token)};window.__DAYRIS_DESK_WORKSPACE__=${JSON.stringify(workspace)}</script></head>`) : html;
      },
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          if (!request.url?.startsWith('/__dayris_desk/')) return next();
          response.setHeader('Cache-Control', 'no-store'); response.setHeader('Content-Type', 'application/json');
          const reply = (code, value) => { response.statusCode = code; response.end(JSON.stringify(value)); };
          if (!validDeskRequest(request, token)) return reply(403, { error: 'Локальный доступ запрещён.' });
          try {
            const route = new URL(request.url, 'http://127.0.0.1').pathname;
            if (request.method === 'GET' && route === '/__dayris_desk/status') return reply(200, await service.status());
            if (request.method === 'GET' && route === '/__dayris_desk/job') return reply(200, service.snapshot());
            if (request.method !== 'POST' || !['/__dayris_desk/build', '/__dayris_desk/publish'].includes(route)) return reply(404, { error: 'Нет такой операции.' });
            let body = '';
            for await (const chunk of request) { body += chunk; if (Buffer.byteLength(body) > 65536) return reply(413, { error: 'Слишком большой запрос.' }); }
            const input = body ? JSON.parse(body) : {};
            return reply(202, { id: service.start(route.endsWith('/publish') ? 'publish' : 'build', input) });
          } catch (error) { return reply(400, { error: error.message }); }
        });
      },
    }],
  });
  await server.listen();
  const marker = path.join(ROOT, '.dayris-project-desk.json');
  await fs.writeFile(marker, JSON.stringify({ workspace }));
  const cleanup = async () => {
    try { if (JSON.parse(await fs.readFile(marker, 'utf8')).workspace === workspace) await fs.unlink(marker); } catch { /* Already removed. */ }
  };
  server.httpServer?.once('close', cleanup);
  process.once('SIGINT', async () => { await cleanup(); await server.close(); process.exit(0); });
  console.log(`\nDAYRIS: http://127.0.0.1:${PORT}/project-desk.html\nТолько этот ПК. Закрыть мастерскую: Ctrl+C.\n`);
  return server;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await runCommand(process.execPath, ['scripts/build-project-catalog.mjs']);
  await startDesk();
}

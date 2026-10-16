import React, { useEffect, useState } from 'react';

export default function LocalProjectTools({ local, savedPath, dirty }) {
  const [state, setState] = useState(null);
  const [selected, setSelected] = useState([]);
  const [message, setMessage] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [review, setReview] = useState(false);
  const [job, setJob] = useState(null);
  const [notice, setNotice] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [device, setDevice] = useState('mobile');
  const [previewKey, setPreviewKey] = useState(0);
  const running = job?.state === 'running' || waiting;
  async function api(name, body) {
    const response = await fetch(`/__dayris_desk/${name}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'X-Dayris-Desk-Token': window.__DAYRIS_DESK_TOKEN__, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Локальная мастерская недоступна.'); return value;
  }
  async function refresh() {
    setWaiting(true); setNotice('');
    try { const [value, currentJob] = await Promise.all([api('status'), api('job')]); setState(value); if (currentJob) setJob(currentJob); setSelected(previous => previous.filter(path => value.files.some(file => file.path === path))); setReview(false); }
    catch (error) { setNotice(error.message); }
    finally { setWaiting(false); }
  }
  useEffect(() => { if (local) refresh(); }, [local, savedPath]);
  useEffect(() => {
    if (!local || job?.state !== 'running') return;
    let active = true, pending = false;
    const tick = async () => {
      if (pending) return; pending = true;
      try { const value = await api('job'); if (active && value) setJob(value); }
      catch (error) { if (active) setNotice(`Связь потеряна: ${error.message}. Операция могла продолжиться; проверьте терминал, не запускайте повторную публикацию вслепую.`); }
      finally { pending = false; }
    };
    const timer = setInterval(tick, 1500); tick();
    return () => { active = false; clearInterval(timer); };
  }, [local, job?.state]);
  async function start(kind) {
    if (dirty || running) return;
    setWaiting(true); setNotice('');
    try {
      const input = kind === 'build' ? {} : { files: selected, message, head: state.head, hashes: Object.fromEntries(state.files.map(file => [file.path, file.hash])) };
      const value = await api(kind, input);
      setJob({ id: value.id, state: 'running', phase: 'Запуск…', log: '', kind }); setReview(false); setConfirmation('');
    } catch (error) { setNotice(error.message); }
    finally { setWaiting(false); }
  }
  if (!local) return <section className="project-local-launch"><h2>Сборка, предпросмотр и push с этого ПК</h2><p>Один раз откройте терминал в папке проекта и запустите <code>npm run project:desk</code>. Затем откройте локальную мастерскую: там доступны предпросмотр, сборка и публикация выбранных исходников. Подписка ИИ не нужна.</p><a href="http://127.0.0.1:5173/project-desk.html" target="_blank" rel="noreferrer">Открыть локальную мастерскую ↗</a><p><small>HTTPS-панель не запускает команды на компьютере. Если сервер ещё не запущен, локальный адрес не откроется.</small></p></section>;
  return <section className="project-local-launch" aria-label="Локальная сборка и публикация"><h2>Локальный результат и выпуск</h2><p>Сохраните исходник в выбранной папке этого проекта — Vite обновит предпросмотр. Он выполняет код приложения и может менять данные вошедшего аккаунта. Сборка и Git работают в папке, из которой запущена мастерская; выберите именно её в файловом редакторе.</p>
    {dirty && <p className="project-warning">Сначала сохраните исходник. Несохранённый текст ещё не попал в предпросмотр или сборку.</p>}
    <div className="admin-actions"><button disabled={running || dirty} onClick={() => start('build')}>Проверить сборку</button><button disabled={running} onClick={refresh}>Обновить изменения Git</button><a href="/" target="_blank" rel="noreferrer">Открыть результат отдельно ↗</a><a href="https://ai-trade-journal-ejm8.onrender.com/" target="_blank" rel="noreferrer">Проверить опубликованный сайт ↗</a></div>
    {state && <><p>Ветка: <code>{state.branch}</code> · HEAD: <code>{state.head.slice(0, 8)}</code></p>{state.hasStaged && <p className="project-warning">В staging уже есть файлы. Публикация из мастерской остановится, чтобы не затронуть чужие подготовленные изменения. Разберите staging в терминале.</p>}
      <details><summary>Выбрать файлы для commit и push ({state.files.length})</summary><p>Ничего не выбрано автоматически. Не добавляйте чужие изменения. Удаления, переименования, секреты и двоичные файлы отправляйте через обычный Git после отдельной проверки.</p>{state.files.map(file => <label className="admin-check project-git-file" key={file.path}><input type="checkbox" disabled={running} checked={selected.includes(file.path)} onChange={event => { setSelected(previous => event.target.checked ? [...previous, file.path] : previous.filter(path => path !== file.path)); setReview(false); }}/>{file.path}</label>)}{!state.files.length && <p>Нет подходящих локальных изменений.</p>}</details>
      <label className="admin-field"><span>Комментарий к commit</span><input disabled={running} maxLength={200} value={message} onChange={event => { setMessage(event.target.value); setReview(false); }} placeholder="Например: Update microphone button"/></label>
      <button disabled={running || dirty || !selected.length || !message.trim() || state.hasStaged} onClick={() => { setReview(true); setConfirmation(''); }}>Подготовить публикацию</button>
      {review && <div className="project-review"><h3>Подтверждение публикации</h3><p>Будут выполнены: сборка всей рабочей копии → базовые тесты → git diff --check → commit только выбранных файлов → push origin main. Render выпускает сайт отдельно. Профильные и браузерные тесты изменённого экрана проверяйте дополнительно.</p><ul>{selected.map(path => <li key={path}><code>{path}</code></li>)}</ul><p>Неотмеченные изменения останутся локально. Сборка проверяет всю рабочую копию, включая их: убедитесь, что выбранный commit самодостаточен.</p><label className="admin-field"><span>Введите ПУБЛИКОВАТЬ для отправки на сервер</span><input value={confirmation} onChange={event => setConfirmation(event.target.value)}/></label><button className="admin-primary" disabled={running || dirty || confirmation !== 'ПУБЛИКОВАТЬ'} onClick={() => start('publish')}>Собрать, сделать commit и push</button></div>}
    </>}
    {notice && <p role="alert" className="project-warning">{notice}</p>}
    {job && <section className="project-job" aria-label="Ход операции"><strong>{job.state === 'running' ? 'Выполняется' : job.state === 'success' ? 'Готово' : 'Остановлено'}: {job.phase}</strong>{job.commit && <p>Commit: <code>{job.commit}</code></p>}<pre>{job.log}</pre></section>}
    <details className="project-live-preview" open><summary>Локальный предпросмотр</summary><p><small>Для входа через Google откройте результат отдельно, войдите там и перезагрузите предпросмотр: Google может запрещать вход внутри iframe.</small></p><div className="admin-actions"><button aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}>Вид телефона</button><button aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}>Вид ПК</button><button onClick={() => setPreviewKey(previous => previous + 1)}>Перезагрузить предпросмотр</button></div><div className="project-live-scroll"><iframe key={previewKey} title="Локальный результат DAYRIS" src="/" allow="microphone" style={{ width: device === 'mobile' ? 390 : 1280 }}/></div></details>
  </section>;
}

import React, { useState } from 'react';
import { VOICE_ACTIONS, commandKey, matchVoiceCommand, normalizeVoiceCommands } from '../../shared/lib/customVoiceCommands.js';
import { parseCalendarVoiceCommand } from '../../shared/lib/calendarVoiceCommand.js';
import { voiceCapabilities } from '../../shared/lib/voiceCapabilities.js';

export default function VoiceCommandsEditor({ commands = [], onChange, disabled }) {
  const [phrase, setPhrase] = useState('');
  const [action, setAction] = useState('wallet');
  const [test, setTest] = useState('');
  const [error, setError] = useState('');
  const catalog = voiceCapabilities('ru', { walletAvailable: true, traderMode: true });
  const result = matchVoiceCommand(test, commands) || parseCalendarVoiceCommand(test);
  function add() {
    const rule = { id: `voice-${Array.from(crypto.getRandomValues(new Uint8Array(8)), n => n.toString(16).padStart(2, '0')).join('')}`, phrase, action, enabled: true };
    const normalized = normalizeVoiceCommands([...commands, rule]);
    if (commands.some(item => commandKey(item.phrase) === commandKey(phrase))) { setError('Такая фраза уже добавлена. Измените или удалите существующую.'); return; }
    if (!normalized.some(item => item.id === rule.id)) { setError('Нужна фраза 3–100 символов. Подтверждение, отмена и запросы помощи зарезервированы. Доступно до 30 фраз.'); return; }
    onChange(normalized); setPhrase(''); setError('');
  }
  return <section className="admin-voice-commands" aria-label="Конструктор голосовых команд"><h3>Голосовые команды</h3><p>Новая фраза → существующее действие. Совпадение точное, без учёта регистра и пунктуации. Новая операция с сервером требует реализации в коде.</p>
    <fieldset disabled={disabled}><legend>Добавить свою фразу</legend><label className="admin-field"><span>Новая голосовая фраза</span><input value={phrase} maxLength={100} placeholder="Например: Открой мои деньги" onChange={event => { setPhrase(event.target.value); setError(''); }}/></label><label className="admin-field"><span>Действие команды</span><select aria-label="Действие команды" value={action} onChange={event => setAction(event.target.value)}>{VOICE_ACTIONS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>{phrase && parseCalendarVoiceCommand(phrase) && <small>Эта фраза уже распознаётся встроенным обработчиком. Новая привязка изменит её поведение вне незавершённых записей.</small>}<button disabled={!phrase.trim() || commands.length >= 30} onClick={add}>Добавить голосовую команду</button>{error && <p role="alert">{error}</p>}</fieldset>
    <div className="admin-command-list">{commands.map(rule => <article key={rule.id}><strong>«{rule.phrase}»</strong><span>→ {VOICE_ACTIONS.find(action => action.id === rule.action)?.label}</span><label className="admin-check"><input disabled={disabled} type="checkbox" checked={rule.enabled} onChange={event => onChange(commands.map(item => item.id === rule.id ? { ...item, enabled: event.target.checked } : item))}/>Включена</label><button disabled={disabled} onClick={() => onChange(commands.filter(item => item.id !== rule.id))}>Удалить фразу</button></article>)}{!commands.length && <p>Своих фраз пока нет. Встроенные команды продолжают работать.</p>}</div>
    <label className="admin-field"><span>Проверить фразу без микрофона</span><input value={test} onChange={event => setTest(event.target.value)} placeholder="Введите фразу для проверки"/></label>{test && <output className="admin-command-result">{result ? `Распознано: ${JSON.stringify(result)}` : 'Не распознано этим проверочным обработчиком. Диалоговые уточнения и финансовые сценарии проверяйте в приложении.'}</output>}
    <p className="admin-hint">Проверка ничего не выполняет. В предпросмотре работают черновые фразы; пользователи получат их после публикации. Незавершённые записи и подтверждения имеют приоритет. Android-сервис виджета не получает эти фразы автоматически.</p>
    <details><summary>Встроенные возможности и примеры</summary>{catalog.groups.map(group => <article key={group.title}><h4>{group.title}</h4><p>{group.hint}</p>{group.phrases.map(value => <button key={value} onClick={() => setTest(value)}>«{value}»</button>)}</article>)}<p>Это справочник, не выключатель встроенных грамматик. Их исходники доступны во вкладке «Связи».</p></details>
  </section>;
}

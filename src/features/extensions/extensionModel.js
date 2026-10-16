export const EXTENSION_PATH = 'src/features/extensions/extensions.json';
export const MAX_EXTENSION_BYTES = 524288;
export const EXTENSION_ACTIONS = [
  { id:'settings', label:'Открыть настройки', selector:'[data-site-element="settings"]' },
  { id:'voice', label:'Открыть голосовой помощник', selector:'.calendar-voice-button' },
  { id:'next', label:'Следующий месяц', selector:'[data-site-element="next"]' },
  { id:'previous', label:'Предыдущий месяц', selector:'[data-site-element="previous"]' },
  { id:'today', label:'Перейти к сегодня', selector:'[data-site-element="today"]' },
];
const color = /^#[0-9a-f]{6}$/i;
const number = (value, min, max, fallback) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
export function extensionLink(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\\<>"'\x00-\x1f]/.test(value)) return '';
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
function text(value, max, name) {
  if (typeof value !== 'string' || value.length > max || value.includes('\0')) throw new Error(`Недопустимое поле «${name}» (лимит ${max} символов).`);
  return value;
}
export function validateExtensions(value) {
  if (!value || value.schema !== 1 || !Array.isArray(value.features) || value.features.length > 20) throw new Error('Нужен schema: 1 и не более 20 функций.');
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_EXTENSION_BYTES) throw new Error('Все функции вместе должны занимать не больше 512 КБ.');
  const ids = new Set();
  return { schema: 1, features: value.features.map(item => {
    if (!item || !/^ext-[a-z0-9-]{1,48}$/.test(item.id) || ids.has(item.id)) throw new Error('Неверный или повторяющийся ID функции.');
    ids.add(item.id);
    if (typeof item.enabled !== 'boolean') throw new Error('Укажите, включена ли функция.');
    const result = { id: item.id, enabled: item.enabled, label: text(item.label, 80, 'Название'), description: text(item.description, 1000, 'Описание'), placement: item.placement === 'header' ? 'header' : 'fixed' };
    for (const device of ['mobile', 'desktop']) {
      const style = item[device] || {};
      result[device] = { visible: style.visible !== false, x: number(style.x, 0, 100, 22), y: number(style.y, 0, 100, 78), width: number(style.width, 64, 400, 144), height: number(style.height, 32, 160, 44), radius: number(style.radius, 0, 80, 16), background: color.test(style.background) ? style.background : '#285c83', color: color.test(style.color) ? style.color : '#ffffff' };
    }
    if (!Array.isArray(item.steps) || !item.steps.length || item.steps.length > 8) throw new Error('Добавьте от 1 до 8 шагов действия.');
    result.steps = item.steps.map((step, index) => {
      if (!step || !['message', 'navigate', 'screen', 'builtin'].includes(step.type)) throw new Error('Неизвестный тип действия.');
      if (step.type !== 'message' && index !== item.steps.length - 1) throw new Error('Действие DAYRIS, открытие экрана или переход должны быть последним шагом.');
      if (step.type === 'screen') return { type: 'screen' };
      if (step.type === 'builtin') {
        if (!EXTENSION_ACTIONS.some(action => action.id === step.action)) throw new Error('Это действие DAYRIS не подключено.');
        return { type:'builtin', action:step.action };
      }
      const value = text(step.value, step.type === 'message' ? 1000 : 2048, 'Действие');
      if (step.type === 'navigate' && !extensionLink(value)) throw new Error('Переход: разрешены HTTPS или путь, начинающийся с /.');
      return { type: step.type, value: step.type === 'navigate' ? extensionLink(value) : value };
    });
    result.html = text(item.html, 65536, 'HTML'); result.css = text(item.css, 65536, 'CSS'); result.js = text(item.js, 65536, 'JavaScript');
    return result;
  }) };
}
export function newExtension() {
  return { id: `ext-${crypto.randomUUID()}`, enabled: true, label: 'Моя функция', description: 'Мини-экран со своей логикой. Измените описание для GPT.', placement: 'fixed', mobile: { visible: true, x: 22, y: 78, width: 144, height: 44, radius: 16, background: '#285c83', color: '#ffffff' }, desktop: { visible: true, x: 20, y: 78, width: 160, height: 44, radius: 16, background: '#285c83', color: '#ffffff' }, steps: [{ type: 'screen' }], html: '<h1>Моя функция</h1>\n<p>Это отдельный экран внутри DAYRIS.</p>\n<button id="count">Нажми: 0</button>', css: 'body { font: 16px system-ui; background: #101925; color: #edf4ff; padding: 24px; }\nbutton { background: #67c8fa; color: #092030; border: 0; padding: 14px 22px; border-radius: 14px; font: inherit; }', js: "let count = 0;\ndocument.querySelector('#count').addEventListener('click', () => {\n  count += 1;\n  document.querySelector('#count').textContent = 'Нажми: ' + count;\n  dayris.notify('Счётчик: ' + count);\n});" };
}
export function extensionPrompt(feature) {
  return `Создай мини-экран DAYRIS: ${feature.label}.\nЗадача: ${feature.description}\nВерни три отдельных блока HTML, CSS, JavaScript. Без React/JSX, import, CDN и внешних библиотек. Код работает в sandbox iframe с непрозрачным origin; сети, cookies, localStorage, камеры, микрофона, родительского DOM и аккаунта нет. Не пытайся обходить sandbox. DOM доступен только внутри мини-экрана. JS запускается после HTML. API: dayris.notify(text) — текстовое сообщение; dayris.navigate('/путь' или 'https://...') — запрос перехода (в тесте только журнал, внешний переход требует подтверждения); dayris.close() — закрыть экран. Данные в переменных теряются при закрытии. Не имитируй сохранение на сервер. Используй textContent для пользовательского ввода. Сделай адаптивно и доступно с клавиатуры.`;
}

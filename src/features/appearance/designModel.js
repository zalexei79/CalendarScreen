import { normalizeConfig } from '../admin/siteConfig.js';
export const DESIGN_PATH = 'src/features/appearance/siteDesign.json';
export const STYLE_PATH = 'src/features/appearance/calendar-custom.css';
// The Git design is the baseline. Explicit cloud fields override it; clearing a cloud field reveals the baseline again.
export function mergeDesign(base, override) {
  const a = normalizeConfig(base), b = normalizeConfig(override);
  const result = { ...a, ...b };
  for (const device of ['mobile','desktop']) {
    const elements = { ...a[device].elements };
    for (const [id, fields] of Object.entries(b[device].elements)) elements[id] = { ...elements[id], ...fields };
    result[device] = { global:{ ...a[device].global,...b[device].global },elements };
  }
  return normalizeConfig(result);
}
export function validLocalCSS(value) {
  if (typeof value !== 'string' || new TextEncoder().encode(value).length > 262144 || value.includes('\0')) throw new Error('CSS должен быть текстом до 256 КБ.');
  // Local source, NOT cloud config. CSS may load external assets; this is not a sandbox.
  return value;
}
export const WINTER_CSS = `/* Зимний пример. Удалите эти правила для возврата к исходному виду. */
body { background: radial-gradient(ellipse at top, #123746, #071923 75%) !important; }
.dayris-header { background: linear-gradient(120deg, #163d38, #122e47) !important; border: 1px solid #bcebd280 !important; border-radius: 20px; box-shadow: 0 8px 32px #86cbb51a; }
.calendar-section:not(.calendar-month-preview) { background: #0e2634e6 !important; border: 1px solid #bfebff60 !important; border-radius: 20px; }
.calendar-section:not(.calendar-month-preview) > .calendar-days-grid > button { border-color: #bcebd240 !important; }
.calendar-voice-button { background: #1c594d !important; color: #ecfff7 !important; box-shadow: 0 0 22px #84d5b64d !important; }
`;

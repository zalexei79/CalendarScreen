import React, { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { MousePointer2, Smartphone } from 'lucide-react';
import { getGlassTiltState, subscribeGlassTilt, supportsGlassTilt, enableGlassTilt, disableGlassTilt } from './glassTilt.js';
import { getGlassPointerEnabled, subscribeGlassPointer, setGlassPointerEnabled } from './glassPointer.js';

const COPY = {
  ru:{title:'Глубина при наклоне',off:'Золотой свет движется за стеклом при наклоне телефона. Включается с твоего разрешения.',resume:'Нажми, чтобы снова разрешить наклон в этом сеансе.',asking:'Запрашиваем доступ к датчикам…',waiting:'Держи телефон удобно и слегка наклони его.',active:'Золотой свет и стеклянный календарь реагируют на наклон.',denied:'Доступ не получен. Можно повторить или проверить разрешения браузера. Тема работает как обычно.',unavailable:'Наклон недоступен в этом браузере. На компьютере глубина реагирует на курсор.',noData:'Датчик пока не передаёт данные. Проверь разрешения или попробуй другой браузер.',reduced:'Эффект приостановлен настройкой «Уменьшение движения».'},
  uk:{title:'Глибина при нахилі',off:'Золоте світло рухається за склом, коли нахиляєш телефон. Лише з твого дозволу.',resume:'Натисни, щоб знову дозволити нахил у цьому сеансі.',asking:'Запитуємо доступ до датчиків…',waiting:'Тримай телефон зручно та злегка нахили його.',active:'Золоте світло та скляний календар реагують на нахил.',denied:'Доступ не отримано. Спробуй знову або перевір дозволи браузера. Тема працює як завжди.',unavailable:'Нахил недоступний у цьому браузері. На комп’ютері глибина реагує на курсор.',noData:'Датчик поки не передає дані. Перевір дозволи або спробуй інший браузер.',reduced:'Ефект призупинено налаштуванням зменшення руху.'},
  en:{title:'Tilt depth',off:'Gold light moves behind the glass as you tilt your phone. Only with your permission.',resume:'Tap to allow tilt again for this session.',asking:'Requesting sensor access…',waiting:'Hold your phone comfortably, then tilt it gently.',active:'Gold light and the glass calendar respond to tilt.',denied:'Access was not granted. Retry or check browser permissions. The theme still works normally.',unavailable:'Tilt is unavailable in this browser. On a computer, depth follows the pointer.',noData:'No sensor readings yet. Check permissions or try another browser.',reduced:'Paused by your Reduce Motion preference.'},
  ro:{title:'Profunzime la înclinare',off:'Lumina aurie se mișcă în spatele sticlei când înclini telefonul. Doar cu permisiunea ta.',resume:'Apasă pentru a permite din nou înclinarea în această sesiune.',asking:'Solicităm acces la senzori…',waiting:'Ține telefonul comod și înclină-l ușor.',active:'Lumina aurie și calendarul din sticlă răspund la înclinare.',denied:'Accesul nu a fost acordat. Reîncearcă sau verifică permisiunile browserului. Tema funcționează normal.',unavailable:'Înclinarea nu este disponibilă în acest browser. Pe computer, profunzimea urmează cursorul.',noData:'Senzorul nu transmite încă date. Verifică permisiunile sau încearcă alt browser.',reduced:'Efect suspendat de preferința de reducere a mișcării.'},
  zh:{title:'倾斜景深',off:'倾斜手机时，金色光线在玻璃后方移动。仅在你授权后启用。',resume:'点按以再次允许本次会话使用倾斜效果。',asking:'正在请求传感器权限…',waiting:'舒适地握住手机，然后轻轻倾斜。',active:'金色光线与玻璃日历随倾斜呈现景深。',denied:'未获得权限。可以重试或检查浏览器权限，主题仍可正常使用。',unavailable:'此浏览器不支持倾斜效果。在电脑上，景深随指针移动。',noData:'尚未收到传感器数据。请检查权限或尝试其他浏览器。',reduced:'已根据减少动态效果设置暂停。'},
};

const POINTER_COPY = {
  ru:{title:'Параллакс за курсором',hint:'Двигай мышью — свет и стекло будут следовать за курсором. Выбор сохраняется на этом компьютере.',off:'Параллакс выключен. Свет и стекло остаются неподвижными.'},
  uk:{title:'Паралакс за курсором',hint:'Рухай мишею — світло та скло слідуватимуть за курсором. Вибір зберігається на цьому комп’ютері.',off:'Паралакс вимкнено. Світло та скло залишаються нерухомими.'},
  en:{title:'Pointer parallax',hint:'Move your mouse to shift the light and glass with your cursor. Your choice is saved on this computer.',off:'Parallax is off. The light and glass stay still.'},
  ro:{title:'Paralaxă după cursor',hint:'Mișcă mouse-ul: lumina și sticla urmează cursorul. Alegerea se păstrează pe acest computer.',off:'Paralaxa este oprită. Lumina și sticla rămân nemișcate.'},
  zh:{title:'光标视差',hint:'移动鼠标，光线与玻璃将随光标变化。选择会保存在此电脑上。',off:'视差已关闭。光线与玻璃保持静止。'},
};
const INPUT_QUERY = '(pointer: coarse)';
const POINTER_THEMES_HINT = {
  ru:'Эффект работает в темах «Золото» и «Изумрудное». Можно включить или выключить его заранее — выбор сохранится.',
  uk:'Ефект працює в темах «Золото» та «Смарагд». Можна ввімкнути або вимкнути його заздалегідь — вибір збережеться.',
  en:'The effect works with Gold and Emerald. Set your preference now; it will be saved for those themes.',
  ro:'Efectul funcționează în temele Aur și Smarald. Îl poți activa sau opri din timp — alegerea se păstrează.',
  zh:'此效果适用于黄金和翡翠主题。你可以提前开启或关闭，选择会被保存。',
};
function subscribeInput(listener) {
  const media = matchMedia(INPUT_QUERY);
  media.addEventListener('change',listener);
  return () => media.removeEventListener('change',listener);
}
const touchInput = () => matchMedia(INPUT_QUERY).matches;

export default function GlassParallaxControl({language,theme}) {
  const locale = language === 'uk' ? 'uk' : language?.startsWith('zh') ? 'zh' : ['md','ro'].includes(language) ? 'ro' : language === 'en' ? 'en' : 'ru';
  const copy = {...COPY[locale]}, id = useId();
  if (theme==='emerald') {
    copy.off = {ru:'Изумрудный свет движется за стеклом при наклоне телефона. Включается с твоего разрешения.',uk:'Смарагдове світло рухається за склом при нахилі телефона. Лише з твого дозволу.',en:'Emerald light moves behind the glass as you tilt your phone. Only with your permission.',ro:'Lumina de smarald se mișcă în spatele sticlei când înclini telefonul. Doar cu permisiunea ta.',zh:'倾斜手机时，翡翠色光线在玻璃后方移动。仅在你授权后启用。'}[locale];
    copy.active = {ru:'Изумрудный свет и стеклянный календарь реагируют на наклон.',uk:'Смарагдове світло та скляний календар реагують на нахил.',en:'Emerald light and the glass calendar respond to tilt.',ro:'Lumina de smarald și calendarul din sticlă răspund la înclinare.',zh:'翡翠色光线与玻璃日历随倾斜呈现景深。'}[locale];
  }
  const state = useSyncExternalStore(subscribeGlassTilt,getGlassTiltState);
  const phone = useSyncExternalStore(subscribeInput,touchInput,() => false);
  const pointerEnabled = useSyncExternalStore(subscribeGlassPointer,getGlassPointerEnabled,() => true);
  const [reduced,setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change',change); return () => media.removeEventListener('change',change);
  },[]);
  const unavailable = !supportsGlassTilt();
  const status = reduced ? 'reduced' : unavailable ? 'unavailable' : state.status;
  const glassTheme = ['gold','emerald'].includes(theme);
  // A saved preference must remain reachable before/after choosing a theme.
  // Only the phone's sensor control depends on the currently applied material.
  if (phone && !glassTheme) return null;
  if (!phone) return <div className="glass-parallax-control glass-parallax-desktop">
    <button type="button" role="switch" aria-checked={pointerEnabled} aria-labelledby={`${id}-label`} aria-describedby={`${id}-hint`} disabled={!pointerEnabled&&reduced} onClick={() => setGlassPointerEnabled(!pointerEnabled)}>
      <MousePointer2 size={19} aria-hidden="true"/><span id={`${id}-label`}>{POINTER_COPY[locale].title}</span><span className="glass-parallax-switch" aria-hidden="true"><i/></span>
    </button>
    <p id={`${id}-hint`} role="status">{!pointerEnabled ? POINTER_COPY[locale].off : reduced ? copy.reduced : !glassTheme ? POINTER_THEMES_HINT[locale] : POINTER_COPY[locale].hint}</p>
  </div>;
  return <div className="glass-parallax-control">
    <button type="button" role="switch" aria-checked={state.enabled} aria-labelledby={`${id}-label`} aria-describedby={`${id}-hint`} disabled={state.status==='asking'||(!state.enabled&&(reduced||unavailable))} onClick={() => state.enabled ? disableGlassTilt() : enableGlassTilt()}>
      <Smartphone size={19} aria-hidden="true"/><span id={`${id}-label`}>{copy.title}</span><span className="glass-parallax-switch" aria-hidden="true"><i/></span>
    </button>
    <p id={`${id}-hint`} role="status">{copy[status] || copy.off}</p>
  </div>;
}

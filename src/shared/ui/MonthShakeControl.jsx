import React,{useId,useSyncExternalStore} from 'react';
import {Smartphone} from 'lucide-react';
import {localeKey} from '../i18n/locale.js';
import {getMonthShakeState,subscribeMonthShake,supportsMonthShake,enableMonthShake,disableMonthShake} from './monthShake.js';
import './MonthShakeControl.css';

const COPY = {
  ru:{title:'Месяцы движением телефона',off:'Влево — предыдущий месяц, вправо — следующий. Включи и разреши доступ к движению.',resume:'Нажми, чтобы снова разрешить жесты в этом сеансе.',asking:'Запрашиваем доступ к движению…',waiting:'Закрой настройки, подержи телефон спокойно и сделай уверенный короткий жест в сторону.',active:'Короткий жест влево — назад, вправо — вперёд. Работает только в открытом календаре.',denied:'Доступ не получен. Можно повторить или проверить разрешения браузера.',unavailable:'Доступно на телефоне с датчиком движения.',noData:'Датчик пока не передаёт данные. Проверь разрешения браузера.'},
  uk:{title:'Місяці рухом телефона',off:'Ліворуч — попередній місяць, праворуч — наступний. Увімкни та дозволь доступ до руху.',resume:'Натисни, щоб знову дозволити жести в цьому сеансі.',asking:'Запитуємо доступ до руху…',waiting:'Закрий налаштування, потримай телефон спокійно та зроби короткий упевнений рух убік.',active:'Короткий рух ліворуч — назад, праворуч — уперед. Лише у відкритому календарі.',denied:'Доступ не отримано. Спробуй знову або перевір дозволи браузера.',unavailable:'Доступно на телефоні з датчиком руху.',noData:'Датчик поки не передає дані. Перевір дозволи браузера.'},
  en:{title:'Move phone to change months',off:'Left opens the previous month; right opens the next. Enable and allow motion access.',resume:'Tap to allow motion gestures again for this session.',asking:'Requesting motion access…',waiting:'Close settings, hold your phone still, then make a short, firm sideways gesture.',active:'Short gesture left goes back; right goes forward. Only while the calendar is open.',denied:'Access was not granted. Retry or check browser permissions.',unavailable:'Available on phones with a motion sensor.',noData:'No motion readings yet. Check browser permissions.'},
  ro:{title:'Schimbă luna mișcând telefonul',off:'La stânga — luna anterioară, la dreapta — următoarea. Activează și permite accesul la mișcare.',resume:'Apasă pentru a permite din nou gesturile în această sesiune.',asking:'Solicităm acces la mișcare…',waiting:'Închide setările, ține telefonul nemișcat, apoi fă o mișcare scurtă și fermă în lateral.',active:'Mișcare scurtă la stânga — înapoi, la dreapta — înainte. Doar în calendarul deschis.',denied:'Accesul nu a fost acordat. Reîncearcă sau verifică permisiunile browserului.',unavailable:'Disponibil pe telefoane cu senzor de mișcare.',noData:'Senzorul nu transmite date. Verifică permisiunile browserului.'},
  zh:{title:'移动手机切换月份',off:'向左轻甩打开上个月，向右轻甩打开下个月。启用并允许访问运动传感器。',resume:'点按以再次允许本次会话使用运动手势。',asking:'正在请求运动权限…',waiting:'关闭设置，保持手机静止片刻，再向侧面短促地移动手机。',active:'向左短促移动返回上个月，向右前进。仅在日历打开时生效。',denied:'未获得权限。请重试或检查浏览器权限。',unavailable:'适用于配备运动传感器的手机。',noData:'尚未收到运动数据。请检查浏览器权限。'},
};
export default function MonthShakeControl({language}) {
  const copy = COPY[localeKey(language)], id = useId();
  const state = useSyncExternalStore(subscribeMonthShake,getMonthShakeState);
  const available = supportsMonthShake();
  return <div className="month-shake-control">
    <button className="settings-row" type="button" role="switch" aria-checked={state.enabled} aria-labelledby={`${id}-label`} aria-describedby={`${id}-hint`} disabled={state.status==='asking'||!available} onClick={() => state.enabled?disableMonthShake():enableMonthShake()}>
      <Smartphone size={18} aria-hidden="true"/><span id={`${id}-label`}>{copy.title}</span><i className="month-shake-switch" aria-hidden="true"><i/></i>
    </button>
    <p id={`${id}-hint`} role="status">{copy[available?state.status:'unavailable']||copy.off}</p>
  </div>;
}

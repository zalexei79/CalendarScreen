import React,{useId,useSyncExternalStore} from 'react';
import {Smartphone} from 'lucide-react';
import {localeKey} from '../i18n/locale.js';
import {getMonthShakeState,subscribeMonthShake,supportsMonthShake,enableMonthShake,disableMonthShake,setMonthShakeSensitivity} from './monthShake.js';
import useMonthShakeTest from './useMonthShakeTest.js';
import './MonthShakeControl.css';

const COPY = {
  ru:{title:'Месяцы движением телефона',off:'Влево — предыдущий месяц, вправо — следующий. Включи и разреши доступ к движению.',resume:'Нажми, чтобы снова разрешить жесты в этом сеансе.',asking:'Запрашиваем доступ к движению…',waiting:'Закрой настройки, подержи телефон спокойно и сделай уверенный короткий жест в сторону.',active:'Короткий жест влево — назад, вправо — вперёд. Работает только в открытом календаре.',denied:'Доступ не получен. Можно повторить или проверить разрешения браузера.',unavailable:'Доступно на телефоне с датчиком движения.',noData:'Датчик пока не передаёт данные. Проверь разрешения браузера.'},
  uk:{title:'Місяці рухом телефона',off:'Ліворуч — попередній місяць, праворуч — наступний. Увімкни та дозволь доступ до руху.',resume:'Натисни, щоб знову дозволити жести в цьому сеансі.',asking:'Запитуємо доступ до руху…',waiting:'Закрий налаштування, потримай телефон спокійно та зроби короткий упевнений рух убік.',active:'Короткий рух ліворуч — назад, праворуч — уперед. Лише у відкритому календарі.',denied:'Доступ не отримано. Спробуй знову або перевір дозволи браузера.',unavailable:'Доступно на телефоні з датчиком руху.',noData:'Датчик поки не передає дані. Перевір дозволи браузера.'},
  en:{title:'Move phone to change months',off:'Left opens the previous month; right opens the next. Enable and allow motion access.',resume:'Tap to allow motion gestures again for this session.',asking:'Requesting motion access…',waiting:'Close settings, hold your phone still, then make a short, firm sideways gesture.',active:'Short gesture left goes back; right goes forward. Only while the calendar is open.',denied:'Access was not granted. Retry or check browser permissions.',unavailable:'Available on phones with a motion sensor.',noData:'No motion readings yet. Check browser permissions.'},
  ro:{title:'Schimbă luna mișcând telefonul',off:'La stânga — luna anterioară, la dreapta — următoarea. Activează și permite accesul la mișcare.',resume:'Apasă pentru a permite din nou gesturile în această sesiune.',asking:'Solicităm acces la mișcare…',waiting:'Închide setările, ține telefonul nemișcat, apoi fă o mișcare scurtă și fermă în lateral.',active:'Mișcare scurtă la stânga — înapoi, la dreapta — înainte. Doar în calendarul deschis.',denied:'Accesul nu a fost acordat. Reîncearcă sau verifică permisiunile browserului.',unavailable:'Disponibil pe telefoane cu senzor de mișcare.',noData:'Senzorul nu transmite date. Verifică permisiunile browserului.'},
  zh:{title:'移动手机切换月份',off:'向左轻甩打开上个月，向右轻甩打开下个月。启用并允许访问运动传感器。',resume:'点按以再次允许本次会话使用运动手势。',asking:'正在请求运动权限…',waiting:'关闭设置，保持手机静止片刻，再向侧面短促地移动手机。',active:'向左短促移动返回上个月，向右前进。仅在日历打开时生效。',denied:'未获得权限。请重试或检查浏览器权限。',unavailable:'适用于配备运动传感器的手机。',noData:'尚未收到运动数据。请检查浏览器权限。'},
};
const TEST_COPY = {
  ru:{sensitivity:'Чувствительность',normal:'Обычная',high:'Повышенная',test:'Проверить жест',stop:'Остановить проверку',waiting:'Проверяем датчик…',sensing:'Датчик работает. Сделай короткий жест влево или вправо.',prev:'Распознан жест влево.',next:'Распознан жест вправо.',weak:'Данные есть, но жест не распознан. Попробуй повышенную чувствительность и короткий боковой жест.',noData:'Показаний нет. Выключи и включи функцию и снова разреши движение.'},
  uk:{sensitivity:'Чутливість',normal:'Звичайна',high:'Підвищена',test:'Перевірити жест',stop:'Зупинити перевірку',waiting:'Перевіряємо датчик…',sensing:'Датчик працює. Зроби короткий рух ліворуч або праворуч.',prev:'Розпізнано рух ліворуч.',next:'Розпізнано рух праворуч.',weak:'Дані є, але жест не розпізнано. Спробуй підвищену чутливість і короткий бічний рух.',noData:'Показань немає. Вимкни й увімкни функцію та знову дозволь рух.'},
  en:{sensitivity:'Sensitivity',normal:'Normal',high:'High',test:'Test gesture',stop:'Stop test',waiting:'Checking sensor…',sensing:'Sensor is responding. Make a short gesture left or right.',prev:'Left gesture recognized.',next:'Right gesture recognized.',weak:'Readings received, but no gesture recognized. Try high sensitivity and a short sideways gesture.',noData:'No readings. Turn the feature off and on, then allow motion again.'},
  ro:{sensitivity:'Sensibilitate',normal:'Normală',high:'Ridicată',test:'Testează gestul',stop:'Oprește testul',waiting:'Verificăm senzorul…',sensing:'Senzorul răspunde. Fă un gest scurt la stânga sau la dreapta.',prev:'Gest la stânga recunoscut.',next:'Gest la dreapta recunoscut.',weak:'Sunt date, dar gestul nu a fost recunoscut. Încearcă sensibilitatea ridicată și un gest lateral scurt.',noData:'Nu sunt date. Dezactivează și reactivează funcția, apoi permite din nou mișcarea.'},
  zh:{sensitivity:'灵敏度',normal:'标准',high:'高',test:'测试手势',stop:'停止测试',waiting:'正在检查传感器…',sensing:'传感器已响应。请向左或向右短促移动。',prev:'已识别向左手势。',next:'已识别向右手势。',weak:'已收到数据，但未识别手势。请尝试高灵敏度和短促的横向移动。',noData:'未收到数据。请关闭再开启此功能，并重新允许运动访问。'},
};
export default function MonthShakeControl({language}) {
  const copy = COPY[localeKey(language)], testCopy = TEST_COPY[localeKey(language)], id = useId();
  const state = useSyncExternalStore(subscribeMonthShake,getMonthShakeState);
  const available = supportsMonthShake();
  const test = useMonthShakeTest({enabled:state.enabled,sensitivity:state.sensitivity});
  return <div className="month-shake-control">
    <button className="settings-row" type="button" role="switch" aria-checked={state.enabled} aria-labelledby={`${id}-label`} aria-describedby={`${id}-hint`} disabled={state.status==='asking'||!available} onClick={() => state.enabled?disableMonthShake():enableMonthShake()}>
      <Smartphone size={18} aria-hidden="true"/><span id={`${id}-label`}>{copy.title}</span><i className="month-shake-switch" aria-hidden="true"><i/></i>
    </button>
    <p id={`${id}-hint`} role="status">{copy[available?state.status:'unavailable']||copy.off}</p>
    {state.enabled && available && <div className="month-shake-tools">
      <span id={`${id}-sensitivity`}>{testCopy.sensitivity}</span>
      <div className="month-shake-sensitivity" role="group" aria-labelledby={`${id}-sensitivity`}>
        {['normal','high'].map(level=><button key={level} type="button" aria-pressed={state.sensitivity===level} onClick={()=>setMonthShakeSensitivity(level)}>{testCopy[level]}</button>)}
      </div>
      <button className="month-shake-test-button" type="button" onClick={test.running?test.stop:test.start}>{test.running?testCopy.stop:testCopy.test}</button>
      {test.phase!=='idle' && <p className="month-shake-test-result" role="status">{testCopy[test.phase]}</p>}
    </div>}
  </div>;
}

import React from 'react';
import { Link2, Monitor, RefreshCw } from 'lucide-react';

export function platformText(language, ru, en, ro, zh) {
  const locale = String(language || 'ru').toLowerCase().split('-')[0];
  return locale === 'zh' ? zh : locale === 'en' ? en : ['ro', 'md'].includes(locale) ? ro : ru;
}

export function SyncSummary({ language, platform, count = 0, lastSync }) {
  const t = (r, e, m, z) => platformText(language, r, e, m, z);
  return <div className="mt-4 rounded-xl border border-zinc-500/20 p-3 text-xs leading-5" aria-label={`${platform} ${t('результат синхронизации', 'sync result', 'rezultat sincronizare', "同步结果")}`}>
    <p>{t('В журнале с этого счёта', 'In journal from this account', 'În jurnal din acest cont', "日志中来自此账户的记录")}: <strong>{count}</strong></p>
    {lastSync ? <><p className="mt-1 text-zinc-500">{t('Последняя проверка', 'Last check', 'Ultima verificare', "最近检查")}: {new Date(lastSync.at).toLocaleString(language === 'md' ? 'ro' : language)}</p><p className="mt-1">{lastSync.added > 0 ? `${t('Добавлено', 'Added', 'Adăugate', "新增")}: ${lastSync.added}` : t('Новых сделок нет — проверка завершена.', 'No new trades — check completed.', 'Nu sunt tranzacții noi — verificare finalizată.', "没有新交易，检查已完成。")}</p>{lastSync.refreshed === false && <p className="text-amber-500">{t('Ответ площадки получен. Обновление журнала из облака пока не подтверждено.', 'Platform response received. Cloud journal refresh is not confirmed yet.', 'Răspuns primit. Actualizarea jurnalului din cloud nu este încă confirmată.', "已收到平台响应，云端日志刷新尚未确认。")}</p>}</> : <p className="mt-1 text-zinc-500">{t('В этом сеансе синхронизация ещё не запускалась.', 'No sync check in this session yet.', 'Sincronizarea nu a fost verificată în această sesiune.', "本次会话尚未检查同步。")}</p>}
  </div>;
}

export default function PlatformConnections({ language, isLight, ctrader, metatrader, onOpen }) {
  const t = (r, e, m, z) => platformText(language, r, e, m, z);
  const items = [
    { id: 'ctrader', name: 'cTrader', Icon: Link2, ...ctrader, description: t('Прямое подключение к площадке. Выбор счёта и загрузка сделок.', 'Direct platform connection. Choose an account and load trades.', 'Conectare directă. Alege contul și încarcă tranzacțiile.', "直接连接平台，选择账户并导入交易。") },
    { id: 'mt5', name: 'MetaTrader 5', Icon: Monitor, ...metatrader, description: t('Подключение на этом устройстве. Для обновления откройте MT5, помощник и DAYRIS на ПК. На телефоне доступна сохранённая история.', 'Connection on this device. To update, keep MT5, the companion and DAYRIS open on your PC. Your phone shows saved history.', 'Conexiune pe acest dispozitiv. Pentru actualizare, menține MT5, asistentul și DAYRIS deschise pe PC. Telefonul afișează istoricul salvat.', "此连接在当前设备上运行。更新时需在电脑上保持 MT5、助手和 DAYRIS 打开。手机显示已保存的历史。") },
  ];
  return <section aria-label={t('Торговые площадки', 'Trading platforms', 'Platforme de trading', "交易平台")}>
    <p className="text-[10px] tracking-widest text-amber-500">DAYRIS PRO</p>
    <h2 className="mt-1 pr-8 text-xl font-semibold">{t('Торговые площадки', 'Trading platforms', 'Platforme de trading', "交易平台")}</h2>
    <p className="mt-2 text-xs leading-5 text-zinc-500">{t('У каждой площадки свой счёт, статус и синхронизация. Выберите, какую открыть.', 'Each platform has its own account, status and sync. Choose one to open.', 'Fiecare platformă are cont, stare și sincronizare separate.', "各平台分别管理账户、状态和同步，请选择一个平台。")}</p>
    <div className="mt-5 space-y-3">{items.map(({ id, name, Icon, connected, reconnect, busy, count = 0, auto, lastSync, description }) => <article key={id} className={`rounded-2xl border p-4 ${isLight ? 'border-zinc-200 bg-zinc-50/70' : 'border-zinc-800 bg-black/20'}`}>
      <div className="flex items-center gap-3"><Icon className="h-5 w-5 shrink-0 text-amber-500" /><div className="min-w-0"><h3 className="text-sm font-semibold">{name}</h3><p className="mt-1 text-xs text-zinc-500">{busy ? t('Синхронизация…', 'Syncing…', 'Sincronizare…', "正在同步…") : reconnect ? t('Нужен повторный вход', 'Reconnect required', 'Reconectare necesară', "需要重新连接") : connected ? t('Подключён', 'Connected', 'Conectat', "已连接") : t('Не подключён', 'Not connected', 'Neconectat', "未连接")}{id === 'mt5' && connected && ` · ${auto ? t('автообновление включено', 'auto-refresh on', 'actualizare automată activă', "自动更新已开启") : t('автообновление выключено', 'auto-refresh off', 'actualizare automată oprită', "自动更新已关闭")}`}</p></div></div>
      <p className="mt-3 text-xs leading-5 text-zinc-500">{description}</p>
      <p className="mt-2 text-xs">{t('Записей площадки в журнале', 'Platform entries in journal', 'Înregistrări în jurnal', "日志中的平台记录")}: <strong>{count}</strong></p>
      <p className="mt-1 text-[11px] text-zinc-500">{lastSync ? `${t('Последняя проверка', 'Last check', 'Ultima verificare', "最近检查")}: ${new Date(lastSync.at).toLocaleString(language === 'md' ? 'ro' : language)}` : t('В этом сеансе ещё не проверяли сделки.', 'No trade check in this session yet.', 'Tranzacțiile nu au fost verificate în această sesiune.', "本次会话尚未检查交易。")}</p>
      <button type="button" onClick={() => onOpen(id)} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-400/25 px-3 text-xs font-semibold text-amber-500"><RefreshCw className="h-4 w-4" />{name} · {t('Подключение и синхронизация', 'Connection and sync', 'Conectare și sincronizare', "连接和同步")}</button>
    </article>)}</div>
  </section>;
}

export function PlatformHistoryActions({ language, isLight, onOpen }) {
  return <div className="ml-auto flex flex-wrap gap-2" aria-label={platformText(language, 'Синхронизация площадок', 'Platform synchronization', 'Sincronizare platforme', "平台同步")}>
    {['ctrader', 'mt5'].map(id => <button key={id} type="button" onClick={() => onOpen(id)} className={`flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${isLight ? 'border-zinc-200 text-zinc-700 hover:bg-zinc-50' : 'border-zinc-700 text-zinc-300 hover:bg-white/5'}`}><RefreshCw className="h-3 w-3" />{id === 'ctrader' ? 'cTrader' : 'MT5'} · {platformText(language, 'Синхронизация', 'Sync', 'Sincronizare', "同步")}</button>)}
  </div>;
}

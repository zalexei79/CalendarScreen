import React from 'react';
import { Monitor, Download, FolderOpen, Smartphone } from 'lucide-react';

export const MT5_FOLDER = '%APPDATA%\\MetaQuotes\\Terminal\\Common\\Files\\DAYRIS';

export default function MetaTraderSetup({ t, canChooseFolder, mobile, busy, snapshot, chooseFolder, onFile, isLight }) {
  const muted = isLight ? 'text-zinc-600' : 'text-zinc-400';
  const button = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold disabled:opacity-40 ${isLight ? 'border-zinc-300 hover:bg-zinc-100' : 'border-zinc-700 hover:bg-white/5'}`;
  const step = (number, title, children) => <div className="mt5-setup-step">
    <span className="mt5-step-number" aria-hidden="true">{number}</span>
    <div className="min-w-0"><h4 className="text-sm font-semibold">{title}</h4><div className={`mt-2 space-y-3 text-xs leading-5 ${muted}`}>{children}</div></div>
  </div>;
  return <details className="mt-5" open={!snapshot}>
    <summary className="min-h-11 cursor-pointer text-sm font-semibold">{t(snapshot ? 'Другой счёт / настройка' : 'Как подключить MT5', snapshot ? 'Another account / setup' : 'How to connect MT5', snapshot ? 'Alt cont / configurare' : 'Cum conectezi MT5', snapshot ? "其他账户 / 设置" : "如何连接 MT5")}</summary>
    <div className="mt5-setup">
      <div className={`mt5-setup-intro ${muted}`}>
        {mobile ? <Smartphone size={20} /> : <Monitor size={20} />}
        <div><p className={isLight ? 'font-medium text-zinc-900' : 'font-medium text-zinc-100'}>{t(mobile ? 'Первое подключение — на компьютере' : 'Терминал → DAYRIS → ваш телефон', mobile ? 'Start on your Windows computer' : 'Terminal → DAYRIS → your phone', mobile ? 'Prima conectare — pe calculator' : 'Terminal → DAYRIS → telefonul tău', mobile ? "先在 Windows 电脑上设置" : "终端 → DAYRIS → 手机")}</p>
          <p className="mt-1">{t('Это связь с открытым терминалом Windows, а не вход в брокера. Пароль от торгового счёта и торговые разрешения не нужны.', 'This links to your open Windows terminal, not directly to the broker. No trading password or trading permissions are needed.', 'Conectare la terminalul Windows deschis, nu direct la broker. Nu sunt necesare parola de tranzacționare sau permisiuni de tranzacționare.', "连接到已打开的 Windows 终端，不直接连接经纪商。无需交易密码或交易权限。")}</p>
        </div>
      </div>
      {mobile ? <div className={`space-y-4 text-xs leading-5 ${muted}`}>
        {step(1, t('Откройте DAYRIS на Windows', 'Open DAYRIS on Windows', 'Deschide DAYRIS pe Windows', "在 Windows 上打开 DAYRIS"), <p>{t('В Chrome или Edge войдите в тот же аккаунт DAYRIS, что и на телефоне. Откройте «Трейдер → MT5».', 'Sign into the same DAYRIS account in Chrome or Edge. Open Trader → MT5.', 'Intră în același cont DAYRIS în Chrome sau Edge. Deschide Trader → MT5.', "在 Chrome 或 Edge 中登录相同 DAYRIS 账户，打开“交易模式 → MT5”。")}</p>)}
        {step(2, t('Подключите терминал по шагам', 'Follow the terminal setup', 'Conectează terminalul pas cu pas', "按步骤设置终端"), <p>{t('На компьютере скачайте экспортёр, добавьте его на график MT5 и выберите папку DAYRIS. Затем выберите счёт и нажмите «Подключить и синхронизировать».', 'On your computer, download the exporter, attach it to an MT5 chart and select the DAYRIS folder. Choose your account, then Connect and synchronize.', 'Pe calculator descarcă exportatorul, atașează-l la un grafic MT5 și alege folderul DAYRIS. Selectează contul, apoi Conectează și sincronizează.', "在电脑上下载导出器，添加到 MT5 图表并选择 DAYRIS 文件夹。选择账户，然后点击“连接并同步”。")}</p>)}
        {step(3, t('Вернитесь к календарю на телефоне', 'Return to your phone calendar', 'Revino la calendar pe telefon', "返回手机日历"), <p>{t('Закрытые сделки появятся через облако DAYRIS при доступном интернете. Сам телефон не читает папку MT5 и не поддерживает фоновое подключение к терминалу.', 'Closed trades reach your phone through DAYRIS cloud while online. Your phone cannot read the MT5 folder or keep the terminal connection running.', 'Tranzacțiile închise ajung prin cloud DAYRIS când ești online. Telefonul nu poate citi folderul MT5 sau menține conexiunea cu terminalul.', "联网时，平仓交易通过 DAYRIS 云同步到手机。手机无法读取 MT5 文件夹或维持终端连接。")}</p>)}
      </div> : <>
        {!canChooseFolder && <p className="mb-4 rounded-xl border border-amber-500/25 p-3 text-xs leading-5">{t('Для автосинхронизации откройте DAYRIS в Chrome или Edge на Windows. В этом браузере доступен только разовый импорт файла.', 'For auto-sync, open DAYRIS in Chrome or Edge on Windows. This browser supports one-time file import only.', 'Pentru sincronizare automată, deschide DAYRIS în Chrome sau Edge pe Windows. Aici este disponibil doar importul unui fișier.', "自动同步需在 Windows 上使用 Chrome 或 Edge 打开 DAYRIS。当前浏览器仅支持单次文件导入。")}</p>}
        {step(1, t('Установите экспортёр в MT5', 'Install the MT5 exporter', 'Instalează exportatorul MT5', "安装 MT5 导出器"), <>
          <a className={button} href="/metatrader/DAYRIS_MT5.ex5" download><Download size={15} />{t('Скачать экспортёр MT5', 'Download MT5 exporter', 'Descarcă exportatorul MT5', "下载 MT5 导出器")}</a>
          <p>{t('MT5 → Файл → Открыть каталог данных → MQL5 → Experts. Поместите туда скачанный файл DAYRIS_MT5.ex5.', 'MT5 → File → Open Data Folder → MQL5 → Experts. Place the downloaded DAYRIS_MT5.ex5 there.', 'MT5 → Fișier → Deschide folderul de date → MQL5 → Experts. Copiază aici fișierul DAYRIS_MT5.ex5.', "MT5 → 文件 → 打开数据文件夹 → MQL5 → Experts，将下载的 DAYRIS_MT5.ex5 放入该目录。")}</p>
          <p>{t('В MT5: Навигатор → Советники → Обновить. Перетащите DAYRIS_MT5 на один график и нажмите OK. Подождите до 30 секунд.', 'In MT5: Navigator → Expert Advisors → Refresh. Drag DAYRIS_MT5 onto one chart and press OK. Allow up to 30 seconds.', 'În MT5: Navigator → Experți → Actualizare. Trage DAYRIS_MT5 pe un grafic și apasă OK. Așteaptă până la 30 de secunde.', "在 MT5 中：导航器 → EA 交易 → 刷新。将 DAYRIS_MT5 拖到一个图表，点击确定，等待最多 30 秒。")}</p>
        </>)}
        {step(2, t('Выберите папку со сделками', 'Select the trades folder', 'Alege folderul cu tranzacții', "选择交易文件夹"), <>
          <p>{t('Это другая папка — общий экспорт терминалов. Вставьте путь ниже в адресную строку окна выбора папки.', 'This is a different folder: the shared terminal export. Paste this path into the folder picker’s address bar.', 'Acesta este alt folder: exportul comun al terminalelor. Introdu calea în bara de adrese a selectorului de foldere.', "这是另一个文件夹，用于终端共享导出。将路径粘贴到文件夹选择窗口的地址栏。")}</p>
          <code className="block select-all break-all rounded-lg bg-zinc-500/10 p-3 text-[11px]">{MT5_FOLDER}</code>
          {canChooseFolder && <button disabled={busy} onClick={chooseFolder} className={button}><FolderOpen size={15} />{t('Выбрать папку DAYRIS', 'Choose DAYRIS folder', 'Alege folderul DAYRIS', "选择 DAYRIS 文件夹")}</button>}
          <p>{t('После выбора покажем счёт, тип Demo/Live и число закрытых позиций. До вашего подтверждения ничего не импортируется.', 'Next, review the account, Demo/Live type and closed-position count. Nothing is imported before your confirmation.', 'Apoi verifică contul, tipul Demo/Live și numărul pozițiilor închise. Nimic nu este importat fără confirmare.', "接着核对账户、模拟/真实类型和已平仓头寸数量，确认前不会导入。")}</p>
        </>)}
      </>}
      <details className={`mt-5 border-t border-zinc-500/20 pt-3 text-xs leading-5 ${muted}`}>
        <summary className="min-h-11 cursor-pointer font-medium">{t('Разовый импорт CSV', 'One-time CSV import', 'Import CSV unic', "单次 CSV 导入")}</summary>
        <p className="mb-3">{t('Если файл DAYRIS уже у вас, загрузите его вручную. Это снимок: новые сделки сами не добавятся. Обычный отчёт MT5 не подходит.', 'Upload an existing DAYRIS export. This is a snapshot: new trades will not arrive automatically. Standard MT5 reports are not supported.', 'Încarcă un export DAYRIS existent. Este un instantaneu: tranzacțiile noi nu se adaugă automat. Rapoartele MT5 standard nu sunt acceptate.', "上传现有 DAYRIS 导出文件。这是快照，不会自动添加新交易。不支持标准 MT5 报告。")}</p>
        <label className="block">{t('Файл экспорта DAYRIS (.csv)', 'DAYRIS export file (.csv)', 'Fișier export DAYRIS (.csv)', "DAYRIS 导出文件（.csv）")}<input type="file" accept=".csv" disabled={busy} className="mt-2 block max-w-full text-xs" onChange={onFile} /></label>
      </details>
      <details className={`mt-2 text-xs leading-5 ${muted}`}>
        <summary className="min-h-11 cursor-pointer font-medium">{t('Счёт или сделки не появились?', 'Account or trades missing?', 'Lipsesc contul sau tranzacțiile?', "账户或交易未显示？")}</summary>
        <ul className="list-disc space-y-2 pl-4">
          <li>{t('Проверьте, что MT5 подключён к серверу, а DAYRIS_MT5 установлен на графике.', 'Check that MT5 is connected to its server and DAYRIS_MT5 is attached to a chart.', 'Verifică conexiunea MT5 la server și exportatorul pe grafic.', "请确认 MT5 已连接服务器，DAYRIS_MT5 已添加到图表。")}</li>
          <li>{t('Нет счёта без сделок? Скачайте текущий экспортёр, замените старый файл и повторно добавьте его на график. Открывать сделку ради подключения не нужно.', 'No account when history is empty? Download the current exporter, replace the old file and reattach it. You do not need to open a trade to connect.', 'Nu apare contul fără tranzacții? Înlocuiește exportatorul vechi cu versiunea curentă și atașează-l din nou. Nu trebuie să deschizi o tranzacție.', "历史为空时未显示账户？请下载当前导出器，替换旧文件并重新添加到图表。无需开仓即可连接。")}</li>
          <li>{t('Импортируются только полностью закрытые позиции, на дату закрытия по времени брокера. Частично закрытая позиция появится после полного закрытия.', 'Only fully closed positions are imported, on their closing date in broker time. Partial closes appear after the whole position is closed.', 'Se importă doar pozițiile complet închise, la data închiderii după ora brokerului. Închiderile parțiale apar după închiderea completă.', "仅导入完全平仓头寸，按经纪商时间的平仓日期记录。部分平仓将在整个头寸完全平仓后显示。")}</li>
          <li>{t('Для другого счёта войдите в него в MT5 и добавьте экспортёр. Затем снова выберите папку. Выбор в DAYRIS не меняет счёт терминала.', 'For another account, sign into it in MT5 and attach the exporter, then select the folder again. DAYRIS selection does not switch the terminal account.', 'Pentru alt cont, conectează-l în MT5 și atașează exportatorul, apoi alege din nou folderul. DAYRIS nu schimbă contul terminalului.', "若要使用其他账户，请在 MT5 登录该账户并添加导出器，然后重新选择文件夹。DAYRIS 的账户选择不会切换终端账户。")}</li>
        </ul>
      </details>
    </div>
  </details>;
}

import React from 'react';
export default function CompanionSetup({ t, mobile, busy, snapshot, connect }) {
  if (snapshot) return null;
  return <div className="mt-5 space-y-4">
    <p className="text-sm leading-6">{t('Бесплатно. Без пароля, экспортёров и выбора папок.', 'Free. No password, exporters or folder selection.', 'Gratuit. Fără parole, exportatoare sau foldere.')}</p>
    {mobile ? <p className="text-sm leading-6">{t('Откройте DAYRIS на Windows с установленным MT5 и подключите счёт. Сделки появятся и в календаре на телефоне.', 'Open DAYRIS on Windows with MT5 installed and connect your account. Trades will also appear on your phone.', 'Deschide DAYRIS pe Windows cu MT5 instalat. Tranzacțiile vor apărea și pe telefon.')}</p> : <>
      <p className="text-xs leading-5 text-zinc-500">{t('Скачайте помощник один раз. Запускайте его, когда хотите обновить историю. Откройте MT5 с нужным счётом, затем нажмите кнопку ниже и подтвердите доступ в окне помощника.', 'Download the companion once. Run it whenever you want to update history. Open MT5 on the desired account, then press the button below and approve access in the companion.', 'Descarcă asistentul o singură dată. Pornește-l când dorești să actualizezi istoricul. Deschide contul dorit în MT5, apoi apasă butonul și aprobă accesul în asistent.')}</p>
      <a href="/metatrader/DAYRIS-MT5.exe" download className="inline-flex min-h-11 items-center rounded-xl border border-zinc-500/30 px-4 text-sm">{t('Скачать помощник для Windows', 'Download Windows companion', 'Descarcă asistentul Windows')}</a>
      <button disabled={busy} onClick={connect} className="min-h-12 w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-40">{t(busy ? 'Подключение…' : 'Подключить MT5', busy ? 'Connecting…' : 'Connect MT5', busy ? 'Conectare…' : 'Conectează MT5')}</button>
    </>}
    <p className="text-[11px] leading-5 text-zinc-500">{t('Помощник читает историю и сведения о счёте. Синхронизация работает, пока MT5, помощник и DAYRIS открыты на компьютере.', 'The companion reads history and account details. Keep MT5, the companion and DAYRIS open on your computer for synchronization.', 'Asistentul citește istoricul și detaliile contului. Menține MT5, asistentul și DAYRIS deschise pentru sincronizare.')}</p>
  </div>;
}

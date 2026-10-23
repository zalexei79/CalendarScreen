// Explicit allowlist from the owner-provided cbotset, 23 October 2026.
// Never publish arbitrary uploaded file contents or infer strategy code/units.
export const BOT_PARAMETERS = {
  symbol: 'XAUUSD', period: 'm1', providedOn: '2026-10-23',
  groups: [
    { title: 'Стратегия', rows: [
      ['Label', 'Метка бота', 'XAU_IMPULSE_SCALPER'],
      ['FastPeriod', 'Быстрый период', '9'],
      ['SlowPeriod', 'Медленный период', '21'],
      ['AtrPeriod', 'Период ATR', '14'],
    ] },
    { title: 'Риск и выход из сделки', rows: [
      ['RiskPercent', 'Риск, %', '0.25'],
      ['StopAtrMultiplier', 'Множитель ATR для стопа', '1.20'],
      ['TakeAtrMultiplier', 'Множитель ATR для тейка', '1.80'],
      ['BreakEvenAtR', 'Безубыток, R', '1.00'],
    ] },
    { title: 'Ограничения', rows: [
      ['MaxSpreadPips', 'Максимальный спред, pips', '35.00'],
      ['MaxTradesPerDay', 'Максимум сделок в день', '6'],
      ['DailyProfitStop', 'Дневной лимит прибыли', '20.00'],
      ['DailyLossStop', 'Дневной лимит убытка', '40.00'],
    ] },
    { title: 'Торговое время · UTC', rows: [
      ['StartHourUtc', 'Начало торговли', '07:00 UTC'],
      ['EndHourUtc', 'Окончание торговли', '20:00 UTC'],
    ] },
  ],
};

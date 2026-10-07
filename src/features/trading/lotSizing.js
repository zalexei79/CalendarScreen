// Tick/pip value must be for one lot, expressed in the account currency.
export function parseLotNumber(value) {
  const text = String(value ?? '').trim().replace(',', '.');
  return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) ? Number(text) : NaN;
}

export function calculateLotSize(input) {
  const fields = ['balance', 'risk', 'stop', 'tickValue', 'minimum', 'step', 'maximum', 'commission'];
  const values = Object.fromEntries(fields.map(key => [key, parseLotNumber(input[key])]));
  if (fields.some(key => !Number.isFinite(values[key]))) return { error: 'incomplete' };
  const { balance, risk, stop, tickValue, minimum, step, maximum, commission } = values;
  if (balance <= 0 || risk <= 0 || risk > 100 || stop <= 0 || tickValue <= 0 || minimum <= 0 || step < 1e-8 || maximum < minimum || commission < 0) return { error: 'invalid' };
  const budget = balance * risk / 100;
  const lossPerLot = stop * tickValue + commission;
  const raw = budget / lossPerLot;
  if (![budget, lossPerLot, raw].every(Number.isFinite) || lossPerLot <= 0) return { error: 'invalid' };
  // Quantize down, never raise a small position to the broker's minimum.
  const precision = Math.min(12, Math.max(0, Math.ceil(-Math.log10(step)) + 4));
  let lots = Number((Math.floor(Math.min(raw, maximum) / step + 1e-10) * step).toFixed(precision));
  if (lots * lossPerLot > budget + Math.max(1e-9, budget * 1e-12)) lots = Number((lots - step).toFixed(precision));
  if (lots <= 0 || lots < minimum - 1e-12) return { error: 'belowMinimum', budget, minimumLoss: Math.ceil(minimum / step - 1e-10) * step * lossPerLot };
  return { lots, budget, loss: lots * lossPerLot, actualRisk: lots * lossPerLot / balance * 100, capped: raw > maximum, lossPerLot };
}

export const QUANTITY_SCALE = 12;
export const MONEY_SCALE = 10;
const pow10 = (n) => 10n ** BigInt(n);

export function parseScaled(value, scale, { allowNegative = false } = {}) {
  const source = String(value ?? '').trim();
  const match = source.match(/^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
  if (!match || (!allowNegative && match[1] === '-')) throw new Error('Enter a valid decimal amount.');
  const integer = match[2], originalFraction = match[3] || '', exponent = Number(match[4] || 0);
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 100) throw new Error('Enter a valid decimal amount.');
  const digitsInput = integer + originalFraction;
  const point = integer.length + exponent;
  const expandedInteger = point <= 0 ? '0' : (digitsInput.slice(0,point) || '') + '0'.repeat(Math.max(0,point-digitsInput.length));
  const expandedFraction = point <= 0 ? '0'.repeat(-point) + digitsInput : digitsInput.slice(Math.max(0,point));
  const normalizedInteger = expandedInteger || '0';
  const fraction = expandedFraction.replace(/0+$/, '');
  const integerDigits = normalizedInteger.replace(/^0+/, '').length;
  const maxIntegerDigits = scale === QUANTITY_SCALE ? 16 : scale === MONEY_SCALE ? 14 : 38;
  if (integerDigits > maxIntegerDigits) throw new Error('Amount exceeds the supported range.');
  if (fraction.length > scale) throw new Error(`Use no more than ${scale} decimal places.`);
  const digits = `${normalizedInteger}${fraction.padEnd(scale, '0')}`.replace(/^0+(?=\d)/, '');
  const result = BigInt(digits || '0');
  return match[1] === '-' ? -result : result;
}

export function scaledToString(value, scale) {
  const amount = BigInt(value);
  const negative = amount < 0n;
  const digits = (negative ? -amount : amount).toString().padStart(scale + 1, '0');
  const whole = digits.slice(0, -scale) || '0';
  const fraction = digits.slice(-scale).replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

function divideRounded(numerator, denominator) {
  if (denominator === 0n) throw new Error('Cannot divide by zero.');
  const negative = (numerator < 0n) !== (denominator < 0n);
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const quotient = n / d;
  const rounded = (n % d) * 2n >= d ? 1n : 0n;
  return (negative ? -1n : 1n) * (quotient + rounded);
}

export function multiplyScaled(left, leftScale, right, rightScale, resultScale = MONEY_SCALE) {
  const numerator = BigInt(left) * BigInt(right);
  const scaleDifference = leftScale + rightScale - resultScale;
  return scaleDifference >= 0
    ? divideRounded(numerator, pow10(scaleDifference))
    : numerator * pow10(-scaleDifference);
}

export function divideScaled(numerator, numeratorScale, denominator, denominatorScale, resultScale) {
  const exponent = denominatorScale + resultScale - numeratorScale;
  const n = exponent >= 0 ? BigInt(numerator) * pow10(exponent) : BigInt(numerator);
  const d = exponent >= 0 ? BigInt(denominator) : BigInt(denominator) * pow10(-exponent);
  return divideRounded(n, d);
}

export function calculateReturnPercent(profit, costBasis) {
  if (BigInt(costBasis) === 0n) return null;
  return divideScaled(BigInt(profit) * 100n, MONEY_SCALE, BigInt(costBasis), MONEY_SCALE, 2);
}

export function calculateDailyChange(currentByCurrency, snapshots, currentDay) {
  const previous = new Date(`${currentDay}T00:00:00.000Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  const previousDay = previous.toISOString().slice(0, 10);
  return Object.entries(currentByCurrency).reduce((changes, [currency, totals]) => {
    const baseline = snapshots.find(row => row.currency === currency && row.sampled_on === previousDay);
    if (baseline) changes[currency] = {
      value: BigInt(totals.value) - parseScaled(baseline.portfolio_value, MONEY_SCALE),
      baseline: parseScaled(baseline.portfolio_value, MONEY_SCALE),
    };
    return changes;
  }, {});
}

export function formatMoney(value, currency, locale) {
  const unit = currency === 'USDT' ? 'USD' : currency;
  const places = new Intl.NumberFormat(locale, { style: 'currency', currency: unit }).resolvedOptions().maximumFractionDigits;
  const scaled = typeof value === 'bigint' ? value : parseScaled(value, MONEY_SCALE, { allowNegative: true });
  const rounded = divideRounded(scaled, pow10(MONEY_SCALE - places));
  const negative = rounded < 0n;
  const digits = (negative ? -rounded : rounded).toString().padStart(places + 1, '0');
  const whole = (places ? digits.slice(0, -places) : digits) || '0';
  const fraction = places ? digits.slice(-places) : '';
  const grouped = new Intl.NumberFormat(locale, { useGrouping: true, maximumFractionDigits: 0 }).format(BigInt(whole));
  const parts = new Intl.NumberFormat(locale, { style: 'currency', currency: unit, minimumFractionDigits: places, maximumFractionDigits: places }).formatToParts(negative ? -1 : 1);
  return parts.map(part => part.type === 'integer' ? grouped : part.type === 'fraction' ? fraction : part.type === 'decimal' && places === 0 ? '' : part.type === 'currency' && currency === 'USDT' ? 'USDT' : part.value).join('');
}

export function calculatePositions(assets, operations) {
  return assets.map(asset => {
    const rows = operations.filter(row => row.asset_id === asset.id).slice()
      .sort((a, b) => String(a.occurred_on).localeCompare(String(b.occurred_on)) || String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)));
    let quantity = 0n, invested = 0n, realized = 0n;
    for (const row of rows) {
      const q = parseScaled(row.quantity, QUANTITY_SCALE);
      const price = parseScaled(row.unit_price, MONEY_SCALE);
      const fee = parseScaled(row.fee || '0', MONEY_SCALE);
      if (row.operation === 'buy') {
        quantity += q;
        invested += multiplyScaled(q, QUANTITY_SCALE, price, MONEY_SCALE) + fee;
      } else if (row.operation === 'sell') {
        if (q > quantity) throw new Error(`Sale exceeds position for asset ${asset.id}.`);
        const proceeds = multiplyScaled(q, QUANTITY_SCALE, price, MONEY_SCALE) - fee;
        const cost = quantity ? divideRounded(invested * q, quantity) : 0n;
        quantity -= q;
        invested -= cost;
        realized += proceeds - cost;
      } else if (row.operation === 'dividend') {
        realized += multiplyScaled(q, QUANTITY_SCALE, price, MONEY_SCALE) - fee;
      }
    }
    const averageCost = quantity ? divideScaled(invested, MONEY_SCALE, quantity, QUANTITY_SCALE, MONEY_SCALE) : 0n;
    return { ...asset, rows: rows.reverse(), quantity, invested, realized, averageCost };
  });
}

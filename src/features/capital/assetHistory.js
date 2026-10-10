import { MONEY_SCALE, multiplyScaled, parseScaled, QUANTITY_SCALE } from './decimal.js';

function roundedDivide(numerator, denominator) {
  if (denominator === 0n) return 0n;
  const quotient = numerator / denominator;
  return quotient + ((numerator % denominator) * 2n >= denominator ? 1n : 0n);
}

// Rebuild only the historical position and cost basis recorded by transactions.
// This intentionally does not pretend that today's market quote was the past price.
export function buildAssetOperationHistory(rows = []) {
  let quantity = 0n;
  let costBasis = 0n;
  return rows.slice().sort((a, b) => String(a.occurred_on).localeCompare(String(b.occurred_on))
    || String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)))
    .filter(row => row.operation === 'buy' || row.operation === 'sell')
    .map(row => {
      const units = parseScaled(row.quantity, QUANTITY_SCALE);
      const price = parseScaled(row.unit_price, MONEY_SCALE);
      const fee = parseScaled(row.fee || '0', MONEY_SCALE);
      if (row.operation === 'buy') {
        quantity += units;
        costBasis += multiplyScaled(units, QUANTITY_SCALE, price, MONEY_SCALE) + fee;
      } else {
        const removedCost = quantity ? roundedDivide(costBasis * units, quantity) : 0n;
        quantity -= units;
        costBasis -= removedCost;
      }
      return { date: row.occurred_on, quantity, costBasis, operation: row.operation };
    });
}

export function buildAssetHistoryPath(points, mode) {
  const values = points.map(point => mode === 'quantity' ? point.quantity : point.costBasis);
  if (!values.length) return { path: '', area: '', points: [] };
  const min = values.reduce((a, b) => a < b ? a : b);
  const max = values.reduce((a, b) => a > b ? a : b);
  const span = max - min || 1n;
  const coords = values.map((value, index) => ({
    x: values.length === 1 ? 160 : 12 + index * (296 / (values.length - 1)),
    y: 100 - Number((value - min) * 7600n / span) / 100,
  }));
  const path = coords.map(({ x, y }, index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = coords.at(-1);
  const area = `${path} L${last.x.toFixed(1)} 112 L${coords[0].x.toFixed(1)} 112 Z`;
  return { path, area, points: coords };
}

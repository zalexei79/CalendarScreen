import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../supabase/migrations/202610090001_dayris_capital.sql', import.meta.url), 'utf8');

test('Capital tables have owner and PRO scoped reads with direct writes revoked', () => {
  for (const table of ['capital_assets', 'capital_operations', 'capital_valuation_snapshots']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    assert.match(sql, new RegExp(`create policy ${table === 'capital_valuation_snapshots' ? 'capital_snapshots_own' : `${table}_own`}[\\s\\S]*?auth\\.uid\\(\\)[\\s\\S]*?= user_id[\\s\\S]*?dayris_capital_has_pro`, 'i'));
  }
  assert.match(sql, /revoke all on public\.capital_assets, public\.capital_operations, public\.capital_valuation_snapshots from public, anon, authenticated/i);
  assert.match(sql, /grant select on public\.capital_assets, public\.capital_operations, public\.capital_valuation_snapshots to authenticated/i);
  assert.doesNotMatch(sql, /grant\s+(?:all|insert|update|delete)\s+on\s+public\.capital_/i);
});

test('all write RPCs verify auth and PRO, and operations lock an owned asset', () => {
  for (const fn of ['capital_create_asset', 'capital_record_operation', 'capital_delete_latest_operation', 'capital_record_daily_snapshot']) {
    const start = sql.indexOf(`create or replace function public.${fn}`);
    assert.notEqual(start, -1, `${fn} exists`);
    const end = sql.indexOf('$$;', start) + 3;
    const body = sql.slice(start, end);
    assert.match(body, /security definer/i);
    assert.match(body, /set search_path\s*=\s*''/i);
    assert.match(body, /auth\.uid\(\)/i);
    assert.match(body, /dayris_capital_has_pro\(\)/i);
  }
  assert.match(sql, /where id=p_asset_id and user_id=v_user for update/i);
  assert.match(sql, /p_quote_source='binance'[\s\S]*?p_currency <> 'USDT'/i);
  assert.match(sql, /p_occurred_on > current_date/i);
  assert.match(sql, /running_quantity < 0/i);
  assert.match(sql, /only the latest operation can be cancelled/i);
});

test('daily portfolio history can only append one current-day snapshot per user and currency', () => {
  assert.match(sql, /unique \(user_id,currency,sampled_on\)/i);
  assert.match(sql, /p_sampled_on <> current_date/i);
  assert.match(sql, /on conflict \(user_id,currency,sampled_on\) do nothing/i);
  assert.match(sql, /currency is not present in this portfolio/i);
});

test('currency columns accept ISO-style codes plus Binance USDT without arbitrary four-letter units', () => {
  assert.equal((sql.match(/currency ~ '\^\[A-Z\]\{3\}\$' or currency = 'USDT'/g) || []).length, 3);
});

test('migration does not drop Capital or existing financial tables', () => {
  assert.doesNotMatch(sql, /drop\s+table/i);
  assert.doesNotMatch(sql, /truncate\s/i);
});

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { calculatePositions, MONEY_SCALE, parseScaled, QUANTITY_SCALE, scaledToString } from './decimal';

async function loadAll(query) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) return { data: null, error };
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return { data: rows, error: null };
  }
}

export function useCapitalPortfolio({ user }) {
  const [assets, setAssets] = useState([]);
  const [operations, setOperations] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(Boolean(user?.id));
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!user?.id) { setAssets([]); setOperations([]); setSnapshots([]); setLoading(false); return; }
    setLoading(true); setError('');
    const [a, o, s] = await Promise.all([
      loadAll(supabase.from('capital_assets').select('*').eq('user_id', user.id).order('created_at')),
      loadAll(supabase.from('capital_operations').select('*').eq('user_id', user.id).order('occurred_on', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false })),
      loadAll(supabase.from('capital_valuation_snapshots').select('currency,portfolio_value,sampled_on').eq('user_id', user.id).order('sampled_on')),
    ]);
    if (a.error || o.error || s.error) setError(a.error?.message || o.error?.message || s.error?.message || 'Could not load portfolio');
    else { setAssets(a.data || []); setOperations(o.data || []); setSnapshots(s.data || []); }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    refresh();
    if (!user?.id) return undefined;
    const sync = () => { if (document.visibilityState === 'visible') refresh(); };
    const timer = window.setInterval(sync, 60000);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', sync); document.removeEventListener('visibilitychange', sync); };
  }, [refresh, user?.id]);

  const addAsset = useCallback(async form => {
    if (!user?.id) throw new Error('Sign in to save your portfolio.');
    const quantity = scaledToString(parseScaled(form.quantity, QUANTITY_SCALE), QUANTITY_SCALE);
    const purchasePrice = scaledToString(parseScaled(form.purchasePrice, MONEY_SCALE), MONEY_SCALE);
    const manualPrice = scaledToString(parseScaled(form.price || form.purchasePrice, MONEY_SCALE), MONEY_SCALE);
    const fee = scaledToString(parseScaled(form.fee || '0', MONEY_SCALE), MONEY_SCALE);
    const { error: saveError } = await supabase.rpc('capital_create_asset', {
      p_name: form.name.trim(), p_symbol: form.symbol.trim().toUpperCase(), p_category: form.category,
      p_currency: form.currency, p_quote_source: form.quoteSource, p_manual_price: manualPrice,
      p_quantity: quantity, p_unit_price: purchasePrice, p_fee: fee, p_occurred_on: form.date,
    });
    if (saveError) throw saveError;
    await refresh();
  }, [user?.id, refresh]);

  const addOperation = useCallback(async (asset, form) => {
    if (!user?.id) throw new Error('Sign in to save your portfolio.');
    const operation = form.operation;
    const quantity = operation === 'revalue' ? '0' : scaledToString(parseScaled(form.quantity, QUANTITY_SCALE), QUANTITY_SCALE);
    const unitPrice = scaledToString(parseScaled(form.price, MONEY_SCALE), MONEY_SCALE);
    const fee = scaledToString(parseScaled(form.fee || '0', MONEY_SCALE), MONEY_SCALE);
    const { error: opError } = await supabase.rpc('capital_record_operation', {
      p_asset_id: asset.id, p_operation: operation, p_quantity: quantity,
      p_unit_price: unitPrice, p_fee: fee, p_occurred_on: form.date,
    });
    if (opError) throw opError;
    await refresh();
  }, [user?.id, refresh]);

  const deleteLatestOperation = useCallback(async operationId => {
    const { error: deleteError } = await supabase.rpc('capital_delete_latest_operation', { p_operation_id: operationId });
    if (deleteError) throw deleteError;
    await refresh();
  }, [refresh]);

  const recordSnapshot = useCallback(async (currency, value, sampledOn) => {
    const { error: snapshotError } = await supabase.rpc('capital_record_daily_snapshot', {
      p_currency: currency, p_value: scaledToString(value, MONEY_SCALE), p_sampled_on: sampledOn,
    });
    if (snapshotError) throw snapshotError;
    await refresh();
  }, [refresh]);

  const enriched = useMemo(() => calculatePositions(assets, operations), [assets, operations]);
  return { assets: enriched, operations, snapshots, loading, error, refresh, addAsset, addOperation, deleteLatestOperation, recordSnapshot };
}

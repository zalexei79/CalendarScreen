import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toNativeOrder } from './investorTools.js';
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
  const [refreshing,setRefreshing] = useState(false);
  const [lastSynced,setLastSynced] = useState(null);
  const loadedOwner = useRef(null);
  const owner = useRef(user?.id); owner.current=user?.id;
  const revision = useRef(0);

  const refresh = useCallback(async () => {
    if (!user?.id) { setAssets([]); setOperations([]); setSnapshots([]); setLoading(false); return; }
    const version=++revision.current;
    setLoading(loadedOwner.current!==user.id); setRefreshing(true);
    try {
    const [a, o, s] = await Promise.all([
      loadAll(supabase.from('capital_assets').select('*').eq('user_id', user.id).order('created_at')),
      loadAll(supabase.from('capital_operations').select('*').eq('user_id', user.id).order('occurred_on', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false })),
      loadAll(supabase.from('capital_valuation_snapshots').select('currency,portfolio_value,sampled_on').eq('user_id', user.id).order('sampled_on')),
    ]);
    if(version!==revision.current||owner.current!==user.id)return;
    if (a.error || o.error || s.error) {
      const failure = a.error || o.error || s.error;
      setError(failure);
      console.error('[capital] portfolio load failed', { code: failure.code, message: failure.message, details: failure.details });
    }
    else { setAssets(a.data || []); setOperations(o.data || []); setSnapshots(s.data || []); loadedOwner.current=user.id; setLastSynced(Date.now()); setError(''); }
    } catch(failure) {
      if(version===revision.current&&owner.current===user.id)setError(failure);
    } finally {
      if(version===revision.current&&owner.current===user.id){setLoading(false);setRefreshing(false);}
    }
  }, [user?.id]);

  useEffect(() => {
    loadedOwner.current=null;
    setAssets([]);setOperations([]);setSnapshots([]);setError('');setLastSynced(null);
    refresh();
    if (!user?.id) return undefined;
    const sync = () => { if (document.visibilityState === 'visible') refresh(); };
    const timer = window.setInterval(sync, 60000);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => { revision.current++; window.clearInterval(timer); window.removeEventListener('focus', sync); document.removeEventListener('visibilitychange', sync); };
  }, [refresh, user?.id]);

  const addAsset = useCallback(async input => {
    const form=toNativeOrder(input);
    if (!user?.id) throw new Error('Sign in to save your portfolio.');
    const quantity = scaledToString(parseScaled(form.quantity, QUANTITY_SCALE), QUANTITY_SCALE);
    const purchasePrice = scaledToString(parseScaled(form.purchasePrice, MONEY_SCALE), MONEY_SCALE);
    const manualPrice = scaledToString(parseScaled(form.price || form.purchasePrice, MONEY_SCALE), MONEY_SCALE);
    const fee = scaledToString(parseScaled(form.fee || '0', MONEY_SCALE), MONEY_SCALE);
    const { error: saveError } = await supabase.rpc(input.unit==='gram'?'capital_create_asset_with_unit':'capital_create_asset', {
      ...(input.unit==='gram'?{p_display_unit:'gram'}:{}),
      p_name: form.name.trim(), p_symbol: form.symbol.trim().toUpperCase(), p_category: form.category,
      p_currency: form.currency, p_quote_source: form.quoteSource, p_manual_price: manualPrice,
      p_quantity: quantity, p_unit_price: purchasePrice, p_fee: fee, p_occurred_on: form.date,
    });
    if (saveError) throw saveError;
    await refresh();
  }, [user?.id, refresh]);

  const addOperation = useCallback(async (asset, input) => {
    const form=toNativeOrder(input);
    if (!user?.id) throw new Error('Sign in to save your portfolio.');
    const operation = form.operation;
    const quantity = operation === 'revalue' ? '0' : scaledToString(parseScaled(form.quantity, QUANTITY_SCALE), QUANTITY_SCALE);
    const unitPrice = scaledToString(parseScaled(form.price, MONEY_SCALE), MONEY_SCALE);
    const fee = scaledToString(parseScaled(form.fee || '0', MONEY_SCALE), MONEY_SCALE);
    const settle=operation==='sell'&&form.destination&&form.destination!=='none';
    const { data, error: opError } = await supabase.rpc(settle?'capital_sell_and_settle':'capital_record_operation', {
      p_asset_id: asset.id, p_quantity: quantity, p_unit_price: unitPrice, p_fee: fee, p_occurred_on: form.date,
      ...(settle?{p_destination:form.destination,p_request_id:form.requestId}:{p_operation:operation}),
    });
    if (opError) throw opError;
    await refresh();
    return data;
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
  return { assets: enriched, operations, snapshots, loading, refreshing, lastSynced, error, refresh, addAsset, addOperation, deleteLatestOperation, recordSnapshot };
}

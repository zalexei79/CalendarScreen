import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { translate } from '../../shared/i18n';
import { loadFinancePlans, planDateKey } from './financePlanModel.js';
export { planDateKey, planTime } from './financePlanModel.js';

export function useFinancePlans({ user, language = 'ru' }) {
  const t = (key) => translate(language, key);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const owner = user?.id || null;
  const currentOwner = useRef(owner);
  const version = useRef(0);
  if (currentOwner.current !== owner) {
    currentOwner.current = owner;
    version.current++;
  }
  const [loadedOwner, setLoadedOwner] = useState(owner);

  const refreshPlans = useCallback(async () => {
    const requestVersion = ++version.current;
    if (!owner) {
      setPlans([]);
      setLoadedOwner(null);
      setError('');
      setLoading(false);
      return [];
    }
    setLoading(true);
    try {
      const next = await loadFinancePlans(supabase, owner);
      if (currentOwner.current !== owner || version.current !== requestVersion) return [];
      setError('');
      setPlans(next);
      setLoadedOwner(owner);
      return next;
    } catch (queryError) {
      if (currentOwner.current === owner && version.current === requestVersion) setError({ owner, key: 'planLoadFailed' });
      throw queryError;
    } finally {
      if (currentOwner.current === owner && version.current === requestVersion) setLoading(false);
    }
  }, [owner]);

  useEffect(() => {
    refreshPlans().catch(() => {});
    if (!owner) return;
    const refresh = () => { refreshPlans().catch(() => {}); };
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    const channel = supabase.channel(`finance-plans-${owner}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders', filter: `user_id=eq.${owner}` }, refresh)
      .subscribe();
    return () => {
      version.current++;
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
      supabase.removeChannel(channel);
    };
  }, [owner, refreshPlans]);

  const visiblePlans = loadedOwner === owner ? plans : [];

  const plansByDate = useMemo(() => {
    return visiblePlans.reduce((result, plan) => {
      const key = planDateKey(plan);
      if (key) (result[key] ||= []).push(plan);
      return result;
    }, {});
  }, [plans, loadedOwner, owner]);

  const createPlan = useCallback(async ({ id, title, amount, currency, kind, dateKey, time, timezone, repeatRule = 'none', remindOffset = 'at_time', repeatUntil = null, repeatTotal = null }) => {
    const localAt = `${dateKey} ${time}:00`;
    const scheduledAt = new Date(`${dateKey}T${time}:00`);
    const offsetMinutes = { at_time: 0, '1_day': 1440, '3_days': 4320, '1_week': 10080 }[remindOffset] || 0;
    scheduledAt.setMinutes(scheduledAt.getMinutes() - offsetMinutes);
    if (!Number.isFinite(scheduledAt.getTime())) throw new Error(t('planDateTimeInvalid'));
    const { data, error: createError } = await supabase.rpc('dayris_create_finance_plan', {
      p_id: id,
      p_title: title.trim(),
      p_amount: amount === '' || amount == null ? null : Number(amount),
      p_currency: currency,
      p_kind: kind,
      p_local_at: localAt,
      p_timezone: timezone,
      p_scheduled_at: scheduledAt.toISOString(),
      p_repeat_rule: repeatRule,
      p_remind_offset: remindOffset,
      p_repeat_until: repeatUntil || null,
      p_repeat_total: repeatTotal || null,
    });
    if (createError) throw createError;
    await refreshPlans().catch(() => {});
    return data;
  }, [refreshPlans, language]);

  const updatePlan = useCallback(async ({ id, title, amount, currency, kind, dateKey, time, timezone, repeatRule = 'none', remindOffset = 'at_time', repeatUntil = null, repeatTotal = null }) => {
    const localAt = `${dateKey} ${time}:00`;
    const scheduledAt = new Date(`${dateKey}T${time}:00`);
    const offsetMinutes = { at_time: 0, '1_day': 1440, '3_days': 4320, '1_week': 10080 }[remindOffset] || 0;
    scheduledAt.setMinutes(scheduledAt.getMinutes() - offsetMinutes);
    if (!Number.isFinite(scheduledAt.getTime())) throw new Error(t('planDateTimeInvalid'));
    const { data, error: updateError } = await supabase.rpc('dayris_update_finance_plan', {
      p_id: id,
      p_title: title.trim(),
      p_amount: amount === '' || amount == null ? null : Number(amount),
      p_currency: currency,
      p_kind: kind,
      p_local_at: localAt,
      p_timezone: timezone,
      p_scheduled_at: scheduledAt.toISOString(),
      p_repeat_rule: repeatRule,
      p_remind_offset: remindOffset,
      p_repeat_until: repeatUntil || null,
      p_repeat_total: repeatTotal || null,
    });
    if (updateError) throw updateError;
    await refreshPlans().catch(() => {});
    return data;
  }, [refreshPlans, language]);

  const resolvePlan = useCallback(async (id, outcome) => {
    const { error: resolveError } = await supabase.rpc('dayris_resolve_reminder', { p_id: id, p_outcome: outcome });
    if (resolveError) throw resolveError;
    await refreshPlans().catch(() => {});
  }, [refreshPlans]);

  const deletePlan = useCallback(async (id) => {
    // The server verifies ownership and also cancels pending push deliveries.
    const { data, error: deleteError } = await supabase.rpc('dayris_delete_finance_plan', { p_id: id });
    if (deleteError) throw deleteError;
    if (data !== true) throw new Error('PLAN_NOT_FOUND');
    await refreshPlans().catch(() => {});
  }, [refreshPlans]);

  return { plans: visiblePlans, plansByDate, loading, error: error?.owner === owner ? t(error.key) : '', refreshPlans, createPlan, updatePlan, resolvePlan, deletePlan };
}

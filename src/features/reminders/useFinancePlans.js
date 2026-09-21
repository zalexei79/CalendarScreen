import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';

export function planDateKey(plan) {
  return String(plan?.local_at || '').slice(0, 10);
}

export function planTime(plan) {
  const value = String(plan?.local_at || '');
  const match = value.match(/(?:T|\s)(\d{2}:\d{2})/);
  return match?.[1] || '09:00';
}

export function useFinancePlans({ user }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refreshPlans = useCallback(async () => {
    if (!user?.id) {
      setPlans([]);
      return [];
    }
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from('reminders')
      .select('id,title,amount,currency,kind,local_at,scheduled_at,status,outcome,resolved_at,repeat_rule,remind_offset,repeat_until,created_at')
      .eq('user_id', user.id)
      .order('local_at', { ascending: true })
      .limit(100);
    setLoading(false);
    if (queryError) {
      setError('Не удалось загрузить планы.');
      throw queryError;
    }
    setError('');
    const next = data || [];
    setPlans(next);
    return next;
  }, [user?.id]);

  useEffect(() => {
    refreshPlans().catch(() => {});
  }, [refreshPlans]);

  const plansByDate = useMemo(() => {
    return plans.reduce((result, plan) => {
      const key = planDateKey(plan);
      if (key) (result[key] ||= []).push(plan);
      return result;
    }, {});
  }, [plans]);

  const createPlan = useCallback(async ({ id, title, amount, currency, kind, dateKey, time, timezone, repeatRule = 'none', remindOffset = 'at_time', repeatUntil = null }) => {
    const localAt = `${dateKey} ${time}:00`;
    const scheduledAt = new Date(`${dateKey}T${time}:00`);
    const offsetMinutes = { at_time: 0, '1_day': 1440, '3_days': 4320, '1_week': 10080 }[remindOffset] || 0;
    scheduledAt.setMinutes(scheduledAt.getMinutes() - offsetMinutes);
    if (!Number.isFinite(scheduledAt.getTime())) throw new Error('Выберите корректную дату и время.');
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
    });
    if (createError) throw createError;
    await refreshPlans();
    return data;
  }, [refreshPlans]);

  const updatePlan = useCallback(async ({ id, title, amount, currency, kind, dateKey, time, timezone, repeatRule = 'none', remindOffset = 'at_time', repeatUntil = null }) => {
    const localAt = `${dateKey} ${time}:00`;
    const scheduledAt = new Date(`${dateKey}T${time}:00`);
    const offsetMinutes = { at_time: 0, '1_day': 1440, '3_days': 4320, '1_week': 10080 }[remindOffset] || 0;
    scheduledAt.setMinutes(scheduledAt.getMinutes() - offsetMinutes);
    if (!Number.isFinite(scheduledAt.getTime())) throw new Error('Выберите корректную дату и время.');
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
    });
    if (updateError) throw updateError;
    await refreshPlans();
    return data;
  }, [refreshPlans]);

  const resolvePlan = useCallback(async (id, outcome) => {
    const { error: resolveError } = await supabase.rpc('dayris_resolve_reminder', { p_id: id, p_outcome: outcome });
    if (resolveError) throw resolveError;
    await refreshPlans();
  }, [refreshPlans]);

  return { plans, plansByDate, loading, error, refreshPlans, createPlan, updatePlan, resolvePlan };
}

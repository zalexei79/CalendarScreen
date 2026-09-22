// Isolated, development-only interaction preview. No Supabase, push or real writes.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import FinancePlanComposer from '../src/features/reminders/FinancePlanComposer';
import { localDateKey } from '../src/features/reminders/plannerModel';

function Preview() {
  const params = new URLSearchParams(location.search);
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState(null);
  const [calls, setCalls] = useState(0);
  const future = new Date();
  future.setDate(future.getDate() + 30);
  const dateKey = localDateKey(future);
  const plan = params.has('edit') ? {
    id: 'preview-existing-plan', title: 'Example payment', amount: 1450.25, currency: 'EUR', kind: 'expense',
    local_at: dateKey + ' 10:30:00', repeat_rule: 'monthly', remind_offset: '3_days', repeat_total: 240, repeat_until: '2030-12-31',
  } : null;
  return <><main><h1>DAYRIS / Planner preview</h1><p>Local preview only. Nothing is sent.</p>
    <button onClick={() => setOpen(true)}>Open planner</button><p>Save calls: {calls}</p><pre aria-label="Saved payload">{saved && JSON.stringify(saved, null, 2)}</pre>
  </main><FinancePlanComposer open={open} dateKey={dateKey} initialPlan={plan} defaultCurrency="MDL" language={params.get('lang') || 'ru'} isLight={params.get('theme') === 'light'} onClose={() => setOpen(false)} onCreate={async (payload) => {
    setCalls((count) => count + 1);
    if (params.has('fail')) throw new Error('Preview failure');
    setSaved(payload); setOpen(false);
  }} /></>;
}

if (import.meta.env.DEV) createRoot(document.getElementById('root')).render(<Preview />);

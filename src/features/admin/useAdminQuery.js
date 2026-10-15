import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { adminError } from './adminUsersModel.js';

// A changed owner/parameters hide stale data synchronously, before the effect.
export default function useAdminQuery(name, params, enabled = true, revision = 0) {
  const key = JSON.stringify([name, params, enabled, revision]);
  const [result, setResult] = useState({ key: '', data: null, loading: false, error: '' });
  useEffect(() => {
    let active = true;
    const [rpc, args, allowed] = JSON.parse(key);
    if (!allowed) { setResult({ key, data: null, loading: false, error: '' }); return; }
    setResult({ key, data: null, loading: true, error: '' });
    (async () => {
      try {
        const { data, error } = await supabase.rpc(rpc, args);
        if (error) throw error;
        if (active) setResult({ key, data, loading: false, error: '' });
      } catch (error) { if (active) setResult({ key, data: null, loading: false, error: adminError(error) }); }
    })();
    return () => { active = false; };
  }, [key]);
  return result.key === key ? result : { data: null, loading: enabled, error: '' };
}

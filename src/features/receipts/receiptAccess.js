import { supabase } from '../../supabaseClient';

export async function checkReceiptAccess(ownerId) {
  if (!ownerId) return false;
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error('RECEIPT_ACCESS_UNAVAILABLE');
  if (sessionData?.session?.user?.id !== ownerId) return false;
  const { data, error } = await supabase.rpc('get_my_pro_status');
  if (error) throw new Error('RECEIPT_ACCESS_UNAVAILABLE');
  return data?.active === true && (!data.until || Date.parse(data.until) > Date.now());
}

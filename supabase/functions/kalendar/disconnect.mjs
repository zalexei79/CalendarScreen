// Keep account identities because imported trades reference them by FK.
export async function disconnect(db, userId) {
  const inactive = await db.from('ctrader_accounts').update({ is_active: false }).eq('user_id', userId);
  if (inactive.error) throw new Error('DATABASE_ERROR');
  const removed = await db.from('ctrader_tokens').delete().eq('user_id', userId);
  if (removed.error) throw new Error('DATABASE_ERROR');
  return { success: true };
}

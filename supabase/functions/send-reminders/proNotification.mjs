export function proNotificationPayload(job, now = Date.now()) {
  const days = Math.ceil((new Date(job.ends_at).getTime() - now) / 86400000);
  if (!Number.isFinite(days) || days <= 0) return null;
  return {
    type: 'pro_granted',
    title: 'Поздравляем! У вас PRO',
    body: `Режим PRO активен. Осталось дней: ${days}. Откройте DAYRIS!`,
    proNotificationId: job.notification_id,
    deliveryId: job.delivery_id,
  };
}

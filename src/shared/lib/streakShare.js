// Never substitute a bare home-page link for a missing personal referral.
export function streakReferralUrl(code, origin) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4,32}$/.test(normalized)) throw new Error('STREAK_REFERRAL_UNAVAILABLE');
  const url = new URL('/?install=1', origin);
  url.searchParams.set('ref', normalized);
  return url.toString();
}

export function streakShareCaption(template, dayLabel, referralUrl) {
  if (!new URL(referralUrl).searchParams.get('ref')) throw new Error('STREAK_REFERRAL_UNAVAILABLE');
  return `${template.replace('{0}', dayLabel)} ${referralUrl}`;
}

export function friendlyCapitalError(error, locale = 'ru', copy = {}) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || error || '');
  const details = String(error?.details || '');
  const full = `${code} ${message} ${details}`.toLowerCase();

  // PostgREST emits these codes when a new Capital migration is not in the
  // deployed database schema (or its function cache has not refreshed yet).
  if (/pgrst202|pgrst205|42p01|42883|schema cache|could not find the function|function public\.capital_|account not found/.test(full)) {
    return copy.accountSetup || 'Capital database functions are not up to date. Try again later.';
  }
  if (/pro access required|active dayris pro plan is required/.test(full)) {
    return copy.proRequired || 'An active DAYRIS PRO plan is required to use Capital.';
  }
  if (locale === 'en') return 'Could not save this change. Check your connection and try again.';
  if (locale === 'ro') return 'Modificarea nu a putut fi salvată. Verifică conexiunea și încearcă din nou.';
  if (locale === 'zh') return '无法保存更改。请检查网络连接后重试。';
  return 'Не удалось сохранить изменение. Проверьте соединение и попробуйте снова.';
}

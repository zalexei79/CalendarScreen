export function calculateWalletBalance(transactions, currency) {
  return (transactions || []).reduce((total, item) => {
    if ((item.currency || 'USD') !== currency) return total;
    const amount = Number(item.amount) || 0;
    return total + (item.kind === 'expense' ? -amount : amount);
  }, 0);
}

export function filterWalletTransactions(transactions, currency) {
  return (transactions || []).filter((item) => (item.currency || 'USD') === currency);
}

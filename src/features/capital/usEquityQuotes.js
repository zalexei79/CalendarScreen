import { supabase } from '../../supabaseClient.js';

export function isUsEquityAsset(asset) {
  return asset?.quote_source === 'alphavantage' && /^[A-Z][A-Z0-9.-]{0,9}$/.test(String(asset.symbol || '').toUpperCase());
}

export function isUsEquityQuoteFresh(quote, now = Date.now()) {
  if (quote?.transport !== 'alphavantage-daily' || !quote.asOf) return false;
  const age = now - Date.parse(`${quote.asOf}T23:59:59.000Z`);
  return Number.isFinite(age) && age >= -86_400_000 && age < 5 * 86_400_000;
}

export async function fetchUsEquityQuotes(symbols, signal) {
  const clean = [...new Set((symbols || []).map(symbol => String(symbol).trim().toUpperCase()).filter(symbol => /^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)))].slice(0, 10);
  if (!clean.length) return { quotes: {}, errors: {} };
  const { data, error } = await supabase.functions.invoke('capital-quotes', { body: { symbols: clean }, signal });
  if (error) {
    try {
      const payload = await error.context?.json();
      if (payload?.error) throw new Error(String(payload.error));
    } catch (details) {
      if (details instanceof Error && details.message !== error.message) throw details;
    }
    throw error;
  }
  if (!data || typeof data !== 'object') throw new Error('Quote provider returned an invalid response.');
  if (data.error) throw new Error(String(data.error));
  return { quotes: data.quotes || {}, errors: data.errors || {} };
}

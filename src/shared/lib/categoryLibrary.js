import {normalizeVoiceCategory} from './voiceCategory.js';

export const FAVORITE_LIMIT = 6;
export function forgetCategory(profile,value){
 const id=normalizeVoiceCategory(value);
 return {...profile,favorites:profile.favorites.filter(item=>normalizeVoiceCategory(item)!==id),recent:profile.recent.filter(item=>normalizeVoiceCategory(item)!==id)};
}
export function cleanCategoryProfile(value) {
 const unique = (items, limit) => [...new Map((Array.isArray(items) ? items : [])
  .filter(item => typeof item === 'string' && item.trim() && item.length <= 60)
  .map(item => [normalizeVoiceCategory(item), item.trim()])).values()].slice(0, limit);
 return {favorites: unique(value?.favorites, FAVORITE_LIMIT), recent: unique(value?.recent, 30)};
}
export function rememberCategory(profile, value) {
 if (typeof value !== 'string' || !value.trim() || value.length > 60) return profile;
 return cleanCategoryProfile({...profile, recent: [value, ...profile.recent.filter(item => normalizeVoiceCategory(item) !== normalizeVoiceCategory(value))]});
}
export function toggleFavorite(profile, value) {
 const id = normalizeVoiceCategory(value), exists = profile.favorites.some(item => normalizeVoiceCategory(item) === id);
 if (!exists && profile.favorites.length >= FAVORITE_LIMIT) return profile;
 return cleanCategoryProfile({...profile, favorites: exists ? profile.favorites.filter(item => normalizeVoiceCategory(item) !== id) : [...profile.favorites, value]});
}
export function categoryLibrary(options, profile, query = '', language = 'ru') {
 const items = [...new Map(options.map(item => [normalizeVoiceCategory(item.value), item])).values()];
 const byId = new Map(items.map(item => [normalizeVoiceCategory(item.value), item]));
 const favorites = profile.favorites.map(value => byId.get(normalizeVoiceCategory(value))).filter(Boolean);
 const pinned = new Set(favorites.map(item => normalizeVoiceCategory(item.value)));
 const recent = profile.recent.map(value => byId.get(normalizeVoiceCategory(value))).filter(item => item && !pinned.has(normalizeVoiceCategory(item.value))).slice(0, 6);
 const terms = normalizeVoiceCategory(query).split(' ').filter(Boolean);
 const all = items.filter(item => terms.every(term => normalizeVoiceCategory(`${item.label} ${item.value}`).includes(term)))
  .sort((a, b) => a.label.localeCompare(b.label, language === 'zh' ? 'zh-CN' : language === 'md' ? 'ro' : language));
 return {favorites, recent, all};
}

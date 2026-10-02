import {useEffect, useRef, useState} from 'react';
import {cleanCategoryProfile, rememberCategory, toggleFavorite, forgetCategory} from '../lib/categoryLibrary.js';
const eventName = 'dayris-category-library';

export default function useCategoryPreferences(userId) {
 const key = `dayris_category_library:${userId || 'guest'}`;
 const cache = useRef(new Map());
 function read(fromStorage = false) {
  if (!fromStorage && cache.current.has(key)) return cache.current.get(key);
  try {return cleanCategoryProfile(JSON.parse(localStorage.getItem(key) || 'null'));}
  catch {/* Use the session preference if storage is unavailable. */}
  return cache.current.get(key) || cleanCategoryProfile(null);
 }
 const [state, setState] = useState(() => ({key, profile: read()}));
 useEffect(() => {
  const refresh = event => {
   if (event?.type === eventName && event.detail.key !== key) return;
   if (event?.type === 'storage' && event.key && event.key !== key) return;
   const profile = event?.type === eventName ? event.detail.profile : read(event?.type === 'storage');
   cache.current.set(key, profile); setState({key, profile});
  };
  refresh(); window.addEventListener(eventName, refresh); window.addEventListener('storage', refresh);
  return () => {window.removeEventListener(eventName, refresh); window.removeEventListener('storage', refresh);};
 }, [key]);
 const profile = state.key === key ? state.profile : read();
 function update(transform) {
  const next = transform(read()); cache.current.set(key, next); setState({key, profile: next});
  try {localStorage.setItem(key, JSON.stringify(next));} catch {/* Keep the current session usable. */}
  window.dispatchEvent(new CustomEvent(eventName, {detail: {key, profile: next}}));
 }
 return {profile, remember: value => update(current => rememberCategory(current, value)), toggle: value => update(current => toggleFavorite(current, value)), forget:value=>update(current=>forgetCategory(current,value))};
}

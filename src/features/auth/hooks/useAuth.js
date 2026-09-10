import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { getValidUserId } from '../../../shared/lib/formatters';

/**
 * useAuth: manages Supabase authentication, session detection, and user profile state.
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const nicknamePrompted = useRef(false);

  // Nickname modal state
  const [nicknameModalOpen, setNicknameModalOpen] = useState(false);
  const [nicknameModalVisible, setNicknameModalVisible] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [setupStep, setSetupStep] = useState(null);

  useEffect(() => {
    async function init() {
      // Google returns tokens in URL hash (#access_token=...).
      if (window.location.hash.includes('access_token')) {
        const params = new URLSearchParams(window.location.hash.substring(1));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          console.log('[auth] setSession вручную →', error ? 'ошибка' : 'успех', error || '');
          try { window.history.replaceState(null, '', window.location.pathname); } catch {}
        }
      }

      const { data, error } = await supabase.auth.getSession();
      console.log('[auth] getSession →', data.session ? 'сессия найдена' : 'сессии нет', error || '');
      const currentUser = data.session?.user ?? null;
      const normalizedUser = getValidUserId(currentUser) ? currentUser : null;
      setUser(normalizedUser);
    }
    init();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[auth] событие:', event, session ? session.user.email : '(нет пользователя)');
      const activeUser = session?.user ?? null;
      const normalizedUser = getValidUserId(activeUser) ? activeUser : null;
      setUser(normalizedUser);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Prompt nickname modal once after fresh login if not set yet
  useEffect(() => {
    if (!user || user.user_metadata?.nickname || nicknamePrompted.current) return;
    nicknamePrompted.current = true;
    setNicknameInput(user.user_metadata?.full_name || '');
    setNicknameModalOpen(true);
    requestAnimationFrame(() => setNicknameModalVisible(true));
  }, [user]);

  const closeNicknameModal = useCallback(() => {
    setNicknameModalVisible(false);
    setTimeout(() => setNicknameModalOpen(false), 180);
  }, []);

  const handleSaveNickname = useCallback(() => {
    const googleName = user?.user_metadata?.full_name || user?.email || '';
    const nickname = (nicknameInput == null ? '' : String(nicknameInput)).trim() || googleName;
    supabase.auth.updateUser({ data: { nickname } });
    closeNicknameModal();
    setSetupStep('language');
  }, [user, nicknameInput, closeNicknameModal]);

  const handleGoogleLogin = useCallback(async () => {
    console.log('[auth] кнопка "Войти через Google" нажата');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: { prompt: 'select_account' },
        redirectTo: window.location.origin,
      },
    });
    if (error) console.error('[auth] ошибка от Supabase:', error);
    else console.log('[auth] signInWithOAuth вызван, редирект-URL:', data?.url);
  }, []);

  const handleGoogleLogout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('[auth] ошибка при выходе:', error);
  }, []);

  const validUserId = getValidUserId(user);

  return {
    user,
    validUserId,
    isGuest: !validUserId,
    handleGoogleLogin,
    handleGoogleLogout,
    // Nickname onboarding modal state & handlers
    nicknameModalOpen,
    nicknameModalVisible,
    nicknameInput,
    setNicknameInput,
    handleSaveNickname,
    setupStep,
    setSetupStep,
  };
}

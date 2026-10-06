import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { getValidUserId } from '../../../shared/lib/formatters';
import { LANGUAGE_STORAGE_KEY, ONBOARDING_V2_COMPLETED_STORAGE_KEY } from '../../../shared/config/constants';
import { translate } from '../../../shared/i18n';
import { disablePush } from '../../reminders/pushClient';
import { restoreUser } from '../sessionRecovery';
import { isOnboardingPreviewUser } from '../../onboarding/lifeStoryModel';
import { startOAuthLogin, TELEGRAM_PROVIDER } from '../oauthLogin';

/**
 * useAuth: manages Supabase authentication, session detection, and user profile state.
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loginPending, setLoginPending] = useState(null);
  const [loginError, setLoginError] = useState('');
  const loginInProgress = useRef(false);
  const nicknamePrompted = useRef(false);
  const previewShownFor = useRef(null);

  // Nickname modal state
  const [nicknameModalOpen, setNicknameModalOpen] = useState(false);
  const [nicknameModalVisible, setNicknameModalVisible] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [setupStep, setSetupStep] = useState(() => {
    try { return window.localStorage.getItem(ONBOARDING_V2_COMPLETED_STORAGE_KEY) === '1' ? null : 'language'; }
    catch { return 'language'; }
  });

  const authCopy = useCallback((key) => {
    try { return translate(window.localStorage.getItem(LANGUAGE_STORAGE_KEY) || navigator.language, key); }
    catch { return translate('ru', key); }
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (query.has('error') || hash.has('error')) setLoginError(authCopy('authLoginFailed'));
  }, [authCopy]);

  useEffect(() => {
    let mounted = true;
    let revision = 0;
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'INITIAL_SESSION') revision += 1;
      if (!mounted) return;
      const activeUser = session?.user ?? null;
      const normalizedUser = getValidUserId(activeUser) ? activeUser : null;
      setUser(normalizedUser);
      setAuthReady(true);
    });

    const initialRevision = revision;
    restoreUser(supabase.auth).then((activeUser) => {
      if (mounted && revision === initialRevision) {
        setUser(getValidUserId(activeUser) ? activeUser : null);
      }
    }).catch(() => { /* Keep the SDK's current state during a temporary failure. */ })
      .finally(() => { if (mounted) setAuthReady(true); });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Replay once per app opening/account switch, never on token refresh or completion.
  useEffect(() => {
    if (!user) { previewShownFor.current = null; return; }
    if (previewShownFor.current === user.id) return;
    previewShownFor.current = user.id;
    if (isOnboardingPreviewUser(user)) {
      setSetupStep('language');
    }
  }, [user]);

  // Prompt nickname modal once after fresh login if not set yet
  useEffect(() => {
    if (!user || user.user_metadata?.nickname || nicknamePrompted.current) return;
    nicknamePrompted.current = true;
    setNicknameInput(user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.preferred_username || '');
    setNicknameModalOpen(true);
    requestAnimationFrame(() => setNicknameModalVisible(true));
  }, [user]);

  const closeNicknameModal = useCallback(() => {
    setNicknameModalVisible(false);
    setTimeout(() => setNicknameModalOpen(false), 180);
  }, []);

  const handleSaveNickname = useCallback(() => {
    const accountName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.user_metadata?.preferred_username || user?.email || '';
    const nickname = (nicknameInput == null ? '' : String(nicknameInput)).trim() || accountName;
    supabase.auth.updateUser({ data: { nickname } });
    closeNicknameModal();
    // Completing the welcome/name step starts setup even when this browser
    // already completed it as a guest or with another account.
    try {
      window.localStorage.removeItem(ONBOARDING_V2_COMPLETED_STORAGE_KEY);
    } catch { /* Setup also works when browser storage is unavailable. */ }
    setSetupStep('language');
  }, [user, nicknameInput, closeNicknameModal]);

  const handleOAuthLogin = useCallback(async (provider) => {
    if (loginInProgress.current) return;
    loginInProgress.current = true;
    setLoginPending(provider);
    setLoginError('');
    try {
      await startOAuthLogin({
        auth: supabase.auth,
        disablePush: async () => {
          try { await disablePush(); }
          catch { throw new Error(authCopy('pushDisableBeforeLogin')); }
        },
        provider,
        origin: window.location.origin,
      });
    } catch (error) {
      setLoginError(error?.message === authCopy('pushDisableBeforeLogin')
        ? authCopy('pushDisableBeforeLogin') : authCopy('authLoginFailed'));
    } finally {
      loginInProgress.current = false;
      setLoginPending(null);
    }
  }, [authCopy]);

  const handleGoogleLogin = useCallback(() => handleOAuthLogin('google'), [handleOAuthLogin]);
  const handleTelegramLogin = useCallback(() => handleOAuthLogin(TELEGRAM_PROVIDER), [handleOAuthLogin]);

  const handleGoogleLogout = useCallback(async () => {
    try { await disablePush(); }
    catch { window.alert(authCopy('pushDisableBeforeLogout')); return; }
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) console.error('[auth] ошибка при выходе:', error);
  }, [authCopy]);

  const validUserId = getValidUserId(user);

  return {
    user,
    authReady,
    validUserId,
    isGuest: !validUserId,
    handleGoogleLogin,
    handleTelegramLogin,
    loginPending,
    loginError,
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

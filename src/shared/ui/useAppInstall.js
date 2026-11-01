import { useEffect, useRef, useState } from 'react';

export default function useAppInstall() {
  const [prompt, setPrompt] = useState(() => window.__atjInstallPrompt || null);
  const [installed, setInstalled] = useState(() => Boolean(window.navigator.standalone || window.matchMedia?.('(display-mode: standalone)').matches));
  const [showSteps, setShowSteps] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    const media = window.matchMedia?.('(display-mode: standalone)');
    const ready = () => setPrompt(window.__atjInstallPrompt || null);
    const done = () => { setInstalled(true); setPrompt(null); setShowSteps(false); };
    const mode = () => { if (media?.matches) done(); };
    window.addEventListener('atj-install-ready', ready);
    window.addEventListener('appinstalled', done);
    media?.addEventListener?.('change', mode);
    return () => {
      window.removeEventListener('atj-install-ready', ready);
      window.removeEventListener('appinstalled', done);
      media?.removeEventListener?.('change', mode);
    };
  }, []);
  async function install() {
    if (pending.current) return;
    const event = window.__atjInstallPrompt || prompt;
    if (!event) { setShowSteps(true); return; }
    pending.current = true;
    setBusy(true);
    // Each browser event can be used only once, including after dismissal.
    window.__atjInstallPrompt = null;
    setPrompt(null);
    try {
      await event.prompt();
      const choice = await event.userChoice;
      setShowSteps(choice?.outcome !== 'accepted');
    } catch { setShowSteps(true); }
    finally { pending.current = false; setBusy(false); }
  }
  return { installed, canPrompt: Boolean(prompt), showSteps, setShowSteps, busy, install };
}

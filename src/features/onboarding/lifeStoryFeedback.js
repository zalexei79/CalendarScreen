// Local, soft brushed-noise swells. No audio download or timer runs independently of the counter.
export function createLifeStoryFeedback(env = globalThis) {
  const win = env.window || env, doc = env.document, nav = env.navigator;
  let context, buffer, armed = false, muted = false, listening = false;
  let lastValue = null, lastClick = -Infinity, lastPulse = -Infinity;
  const notes = new Set();
  const reduced = () => Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const clearNotes = () => {
    for (const note of notes) { try { note.source.stop(); } catch {} note.source.disconnect(); note.gain.disconnect(); note.filter.disconnect(); }
    notes.clear();
  };
  const stop = () => {
    clearNotes();
    // Only cancel our own still-active 4ms pulse, not unrelated button haptics.
    if ((env.performance || performance).now() - lastPulse < 5) { try { nav?.vibrate?.(0); } catch {} }
    lastValue = null; lastClick = lastPulse = -Infinity;
  };
  const visibility = () => { if (doc.hidden) stop(); };
  const prepare = () => {
    armed = true;
    if (!listening && doc) { doc.addEventListener('visibilitychange', visibility); listening = true; }
    if (muted || reduced()) return;
    try {
      const Audio = win.AudioContext || win.webkitAudioContext;
      if (!Audio) return;
      if (!context || context.state === 'closed') {
        context = new Audio();
        buffer = context.createBuffer(1, Math.ceil(context.sampleRate * .2), context.sampleRate);
        const samples = buffer.getChannelData(0); let seed = 72319, air = 0;
        for (let i = 0; i < samples.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          const phase = i / (samples.length - 1), noise = seed / 2147483648 - 1;
          // A smooth window removes the impact; there is no pitched bass component.
          air += .2 * (noise - air);
          samples[i] = 2.5 * air * Math.sin(Math.PI * phase) ** 2;
        }
        // Unlock inside the original click on Safari, without an audible startup beep.
        const unlock = context.createBufferSource(); unlock.buffer = context.createBuffer(1, 1, context.sampleRate);
        unlock.connect(context.destination); unlock.onended = () => unlock.disconnect(); unlock.start();
      }
      context.resume()?.catch(() => {});
    } catch { /* Counter, video and navigation remain available without audio. */ }
  };
  return {
    prepare,
    setMuted(value) { muted = Boolean(value); if (muted) clearNotes(); },
    tick(value, elapsed) {
      if (!armed || doc?.hidden || reduced() || elapsed < 0 || elapsed >= 8000 || value === lastValue) return;
      lastValue = value;
      const now = (env.performance || performance).now();
      const progress = Math.min(1, elapsed / 8000);
      // Follow the counter's slow-fast-slow arc, without queuing missed sounds.
      const activity = Math.sin(Math.PI * progress) ** 2;
      const interval = 1000 - 760 * activity;
      if (!muted && context?.state === 'running' && now - lastClick >= interval) {
        lastClick = now;
        try {
          const source = context.createBufferSource(), gain = context.createGain(), filter = context.createBiquadFilter();
          const time = context.currentTime;
          source.buffer = buffer; source.playbackRate.value = .98 + .04 * progress;
          filter.type = 'bandpass'; filter.frequency.value = 1400 + 100 * progress; filter.Q.value = .9;
          gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(.014, time + .055);
          gain.gain.setValueAtTime(.014, time + .095); gain.gain.linearRampToValueAtTime(0, time + .205);
          source.connect(filter); filter.connect(gain); gain.connect(context.destination);
          const note = { source, gain, filter }; notes.add(note);
          source.onended = () => { source.disconnect(); gain.disconnect(); filter.disconnect(); notes.delete(note); };
          source.start(time); source.stop(time + .215);
        } catch { /* Audio restrictions must not interrupt the animation. */ }
      }
      const touch = nav?.maxTouchPoints > 0 || win.matchMedia?.('(pointer: coarse)').matches;
      if (touch && typeof nav?.vibrate === 'function' && now - lastPulse >= 450) {
        lastPulse = now;
        try { nav.vibrate(4); } catch { /* Unsupported or disabled hardware quietly skips the pulse. */ }
      }
    },
    stop,
    dispose() {
      stop(); armed = false;
      if (listening) doc.removeEventListener('visibilitychange', visibility);
      listening = false;
      if (context && context.state !== 'closed') { try { context.close()?.catch(() => {}); } catch {} }
      context = buffer = null;
    },
  };
}

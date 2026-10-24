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
        buffer = context.createBuffer(1, Math.ceil(context.sampleRate * .16), context.sampleRate);
        const samples = buffer.getChannelData(0); let seed = 72319;
        for (let i = 0; i < samples.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          const phase = i / (samples.length - 1), noise = seed / 2147483648 - 1;
          // A smooth window removes the impact; there is no pitched bass component.
          samples[i] = noise * Math.sin(Math.PI * phase) ** 2;
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
      if (!muted && context?.state === 'running' && now - lastClick >= 240) {
        lastClick = now;
        try {
          const source = context.createBufferSource(), gain = context.createGain(), filter = context.createBiquadFilter();
          const time = context.currentTime, progress = Math.min(1, elapsed / 8000);
          source.buffer = buffer; source.playbackRate.value = .98 + .04 * progress;
          filter.type = 'bandpass'; filter.frequency.value = 1850 + 150 * progress; filter.Q.value = .65;
          gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(.018, time + .035);
          gain.gain.setValueAtTime(.018, time + .075); gain.gain.linearRampToValueAtTime(0, time + .165);
          source.connect(filter); filter.connect(gain); gain.connect(context.destination);
          const note = { source, gain, filter }; notes.add(note);
          source.onended = () => { source.disconnect(); gain.disconnect(); filter.disconnect(); notes.delete(note); };
          source.start(time); source.stop(time + .17);
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

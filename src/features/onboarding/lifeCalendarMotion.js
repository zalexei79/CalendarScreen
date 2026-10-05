const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => value ** 3 * (10 - 15 * value + 6 * value ** 2);
const progress = (time, start, duration) => smooth(clamp((time - start) / duration));

// Focus the contiguous crop first. Expand it as one lattice, then reveal its UI.
// The dense life grid and the app never occupy the same visible frame.
export const LIFE_MOTION_END = 13000;
export function lifeCalendarMotion(time) {
  return {
    zoom: progress(time, 5850, 2250),
    reframe: progress(time, 6850, 1250),
    month: progress(time, 8100, 3400),
    lifeOpacity: 1 - progress(time, 6350, 1200),
    skin: progress(time, 8100, 3300),
    paperOpacity: 1 - progress(time, 8100, 3400),
    handoff: progress(time, 11600, 600),
    ready: time >= 11500,
    settled: time >= 12200,
  };
}

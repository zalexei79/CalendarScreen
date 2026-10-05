const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => value ** 3 * (10 - 15 * value + 6 * value ** 2);
const progress = (time, start, duration) => smooth(clamp((time - start) / duration));

// Focus the contiguous crop first. Expand it as one lattice, then reveal its UI.
// The dense life grid and the app never occupy the same visible frame.
export const LIFE_COUNT_END = 8000;
export const LIFE_MOTION_END = 18450;
export function lifeCalendarMotion(time) {
  return {
    zoom: progress(time, 9600, 3050),
    reframe: progress(time, 10000, 2300),
    month: progress(time, 11750, 4700),
    lifeOpacity: 1 - progress(time, 10000, 1400),
    skin: progress(time, 11750, 4700),
    paperOpacity: 1 - progress(time, 11750, 4700),
    handoff: progress(time, 16650, 1000),
    ready: time >= 16450,
    settled: time >= 17650,
  };
}

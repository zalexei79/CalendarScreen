const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => value ** 3 * (10 - 15 * value + 6 * value ** 2);
const progress = (time, start, duration) => smooth(clamp((time - start) / duration));

// Focus the contiguous crop first. Expand it as one lattice, then reveal its UI.
// The dense life grid and the app never occupy the same visible frame.
export const LIFE_MOTION_END = 12200;
export function lifeCalendarMotion(time) {
  return {
    zoom: progress(time, 5850, 1950),
    month: progress(time, 7800, 3100),
    lifeOpacity: 1 - progress(time, 6350, 1200),
    skin: progress(time, 9000, 1700),
    paperOpacity: 1 - progress(time, 9200, 1800),
    handoff: progress(time, 11000, 400),
    ready: time >= 10900,
    settled: time >= 11400,
  };
}

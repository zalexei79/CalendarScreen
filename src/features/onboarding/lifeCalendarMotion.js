const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => value ** 3 * (10 - 15 * value + 6 * value ** 2);
const progress = (time, start, duration) => smooth(clamp((time - start) / duration));

// Focus the contiguous crop first. Expand it as one lattice, then reveal its UI.
// The dense life grid and the app never occupy the same visible frame.
export const LIFE_MOTION_END = 14500;
export function lifeCalendarMotion(time) {
  return {
    zoom: progress(time, 5850, 3050),
    reframe: progress(time, 6250, 2300),
    month: progress(time, 8000, 4600),
    lifeOpacity: 1 - progress(time, 6350, 1300),
    skin: progress(time, 8150, 4450),
    paperOpacity: 1 - progress(time, 8000, 4600),
    handoff: progress(time, 12800, 900),
    ready: time >= 12600,
    settled: time >= 13700,
  };
}

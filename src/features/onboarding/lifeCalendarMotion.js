const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => value ** 3 * (10 - 15 * value + 6 * value ** 2);
const progress = (time, start, duration) => smooth(clamp((time - start) / duration));
const mix = (from, to, value) => from + (to - from) * value;

// Center and expand a contiguous crop in one movement, then reveal its UI.
// The dense life grid and the app never occupy the same visible frame.
export const LIFE_COUNT_END = 8000;
export const LIFE_MOTION_END = 13250;
export function lifeCalendarMotion(time) {
  return {
    zoom: progress(time, 8650, 1800),
    reframe: progress(time, 8650, 1400),
    copyOpacity: 1 - progress(time, 8650, 800),
    copyRetreat: progress(time, 8350, 1100),
    amountsOpacity: 1 - progress(time, 5500, 300),
    questionOpacity: progress(time, 5850, 350),
    moneyOpacity: 1 - progress(time, 8200, 450),
    headerOpacity: 1 - progress(time, 8850, 650),
    topAperture: progress(time, 9450, 550),
    bottomAperture: progress(time, 9000, 550),
    month: progress(time, 9500, 3050),
    lifeOpacity: (1 - progress(time, 9400, 850)) * (1 - .22 * progress(time, 8650, 900)),
    skin: progress(time, 10250, 2300),
    // The month title and controls emerge before the days finish taking paint.
    paperOpacity: 1 - progress(time, 10250, 1800),
    handoff: progress(time, 12550, 500),
    ready: time >= 12550,
    settled: time >= 13050,
  };
}

// Move the crop's screen position, rather than scaling its distance from the
// camera. Its center stays on this path even when it starts at a grid edge.
export function lifeCameraFrame({ gridLeft, gridTop, unit, cropCol, cropRow, monthRows, focusX, focusY, compactPitch, compactAspect = 1 }, motion) {
  const cropX = (cropCol + 3.5) * unit;
  const cropY = (cropRow + monthRows / 2) * unit;
  const scale = mix(1, compactPitch / unit, motion.zoom);
  const scaleY = scale * mix(1, compactAspect, motion.zoom);
  const centerX = mix(gridLeft + cropX, focusX, motion.reframe);
  const centerY = mix(gridTop + cropY, focusY, motion.reframe);
  return { originX: centerX - cropX * scale, originY: centerY - cropY * scaleY, scale, scaleY };
}

const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => value ** 3 * (10 - 15 * value + 6 * value ** 2);
const progress = (time, start, duration) => smooth(clamp((time - start) / duration));
const mix = (from, to, value) => from + (to - from) * value;

// Center and expand a contiguous crop in one movement, then reveal its UI.
// One uninterrupted camera move; calendar paint replaces the surrounding history.
export const LIFE_COUNT_END = 8000;
export const LIFE_MOTION_END = 13250;
export function lifeCalendarMotion(time) {
  return {
    // Lead with the camera position, then build magnification on the same path.
    // This keeps the grid advancing while the surrounding copy retires.
    zoom: progress(time, 8350, 2100),
    reframe: progress(time, 8200, 1300),
    copyOpacity: 1 - progress(time, 8650, 800),
    copyRetreat: progress(time, 8350, 1100),
    amountsOpacity: 1 - progress(time, 5500, 300),
    questionOpacity: progress(time, 5850, 350),
    moneyOpacity: 1 - progress(time, 8200, 450),
    headerOpacity: 1 - progress(time, 8850, 650),
    topAperture: progress(time, 9450, 550),
    bottomAperture: progress(time, 8650, 900),
    month: progress(time, 9500, 3050),
    contextExit: progress(time, 10000, 2300),
    skin: progress(time, 9500, 3050),
    // Labels lead; chrome emerges during the same continuous camera move.
    paperOpacity: 1 - progress(time, 10500, 2050),
    handoff: progress(time, 12550, 500),
    ready: time >= 12550,
    settled: time >= 13050,
  };
}


// One projection for every week, including the cells becoming calendar days.
// The two renderers share pitch, fill and origin throughout the entire move.
export function lifeLatticeFrame({ camera, unit, cropCol, cropRow, targets, initialFill }, motion) {
  const first = targets[0];
  const finalPitchX = targets[1].x - first.x;
  const finalPitchY = targets[7].y - first.y;
  const size = unit * mix(initialFill, .91, motion.zoom);
  return {
    x: mix(camera.originX + (cropCol * unit + (unit - size) / 2) * camera.scale, first.x, motion.month),
    y: mix(camera.originY + (cropRow * unit + (unit - size) / 2) * camera.scaleY, first.y, motion.month),
    pitchX: mix(unit * camera.scale, finalPitchX, motion.month),
    pitchY: mix(unit * camera.scaleY, finalPitchY, motion.month),
    width: mix(size * camera.scale, first.width, motion.month),
    height: mix(size * camera.scaleY, first.height, motion.month),
    finalPitchX, finalPitchY,
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

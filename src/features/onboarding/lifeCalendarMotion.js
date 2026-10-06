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
    zoom: .78 * progress(time, 8350, 1900) + .22 * progress(time, 9700, 2850),
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
    // A single optical plane tilts into view, then lands flat before handoff.
    // All historical weeks and live days inherit this same projection.
    planeTilt: 7 * progress(time, 8400, 1400) * (1 - progress(time, 10100, 2100)),
    focus: progress(time, 8500, 650) * (1 - progress(time, 11050, 800)),
    signal: progress(time, 10000, 1400),
    signalOpacity: progress(time, 9900, 400) * (1 - progress(time, 11400, 450)),
    headerArrival: progress(time, 10500, 1600),
    dockArrival: progress(time, 10900, 1400),
    chromeClear: progress(time, 10100, 1000),
    // Labels lead; chrome emerges during the same continuous camera move.
    paperOpacity: 1 - progress(time, 10500, 2050),
    handoff: progress(time, 12550, 500),
    ready: time >= 12550,
    settled: time >= 13050,
  };
}

// Only content follows the light front; cell geometry never staggers or splits.
export function lifeCellMaterialization(time, index, todayIndex) {
  const distance = Math.hypot(index % 7 - todayIndex % 7, Math.floor(index / 7) - Math.floor(todayIndex / 7));
  return progress(time, 10400 + Math.min(180, distance * 26), 950);
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
  const scaleY = scale * mix(1, compactAspect, motion.month);
  const centerX = mix(gridLeft + cropX, focusX, motion.reframe);
  const centerY = mix(gridTop + cropY, focusY, motion.reframe) - 16 * Math.sin(Math.PI * motion.month);
  return { originX: centerX - cropX * scale, originY: centerY - cropY * scaleY, scale, scaleY };
}

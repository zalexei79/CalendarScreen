const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => value ** 3 * (10 - 15 * value + 6 * value ** 2);
const progress = (time, start, duration) => smooth(clamp((time - start) / duration));
const mix = (from, to, value) => from + (to - from) * value;
// Zero velocity at both ends: establish presence early, then land gently.
const expand = value => 1 - (1 - value) ** 3 * (1 + 3 * value);

export const LIFE_COUNT_END = 8000;
export const LIFE_MOTION_END = 10800;
export function lifeCalendarMotion(time) {
  const month = expand(clamp((time - LIFE_COUNT_END) / 2200));
  return {
    zoom: month,
    reframe: month,
    division: progress(time, 8150, 1000),
    copyOpacity: 1 - progress(time, 8000, 400),
    copyRetreat: progress(time, 8000, 650),
    amountsOpacity: 1 - progress(time, 5500, 300),
    questionOpacity: progress(time, 5850, 350),
    moneyOpacity: 1 - progress(time, 8000, 300),
    headerOpacity: 1 - progress(time, 8150, 500),
    topAperture: progress(time, 8400, 350),
    bottomAperture: progress(time, 8300, 400),
    month,
    // The unscaled history stays behind the growing month until it is large.
    contextExit: progress(time, 8400, 800),
    skin: progress(time, 8500, 1350),
    planeTilt: 0,
    focus: progress(time, 8050, 500) * (1 - progress(time, 9500, 700)),
    signal: progress(time, 8850, 1100),
    signalOpacity: progress(time, 8800, 350) * (1 - progress(time, 9650, 500)),
    headerArrival: progress(time, 8650, 1000),
    dockArrival: progress(time, 9000, 1000),
    chromeClear: progress(time, 8650, 800),
    paperOpacity: 1 - progress(time, 8650, 1550),
    handoff: progress(time, 10200, 400),
    ready: time >= 10200,
    settled: time >= 10600,
  };
}

export function lifeCellMaterialization(time, index, todayIndex) {
  const distance = Math.hypot(index % 7 - todayIndex % 7, Math.floor(index / 7) - Math.floor(todayIndex / 7));
  return progress(time, 8850 + Math.min(180, distance * 26), 700);
}

// The history stays in place. Only its selected weekly parents become the
// mounted calendar, following one uninterrupted source-to-destination path.
export function lifeLatticeFrame({ camera, unit, cropCol, cropRow, targets, initialFill }, motion) {
  const first = targets[0];
  const finalPitchX = targets[1].x - first.x;
  const finalPitchY = targets[7].y - first.y;
  const finalWidth = targets[6].x + targets[6].width - first.x;
  const finalGap = finalPitchX - first.width;
  const size = unit * initialFill;
  const weekWidth = mix(size, finalWidth, motion.month);
  const gap = Math.min(Math.max(0, finalGap), weekWidth / 28) * motion.division;
  const dayWidth = (weekWidth - gap * 6) / 7;
  return {
    x: mix(camera.originX + cropCol * unit + (unit - size) / 2, first.x, motion.month),
    y: mix(camera.originY + cropRow * unit + (unit - size) / 2, first.y, motion.month),
    pitchX: weekWidth + mix(unit - size, finalGap, motion.month),
    pitchY: mix(unit, finalPitchY, motion.month),
    width: weekWidth,
    height: mix(size, first.height, motion.month),
    dayWidth, dayPitch: dayWidth + gap, gap, finalPitchX, finalPitchY,
  };
}

export function lifeCameraFrame({ gridLeft, gridTop }) {
  return { originX: gridLeft, originY: gridTop };
}

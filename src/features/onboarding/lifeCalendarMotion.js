const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => value ** 3 * (10 - 15 * value + 6 * value ** 2);
const progress = (time, start, duration) => smooth(clamp((time - start) / duration));
const mix = (from, to, value) => from + (to - from) * value;
// Zero velocity at both ends: establish presence early, then land gently.
const expand = value => 1 - (1 - value) ** 3 * (1 + 3 * value);

export const LIFE_COUNT_END = 8000;
export const LIFE_MOTION_END = 11600;
export function lifeCalendarMotion(time) {
  const zoom = expand(clamp((time - LIFE_COUNT_END) / 2000));
  const month = progress(time, 9350, 1600);
  return {
    zoom,
    reframe: zoom,
    division: progress(time, 9150, 1500),
    copyOpacity: 1 - progress(time, 8000, 400),
    copyRetreat: progress(time, 8000, 650),
    amountsOpacity: 1 - progress(time, 5500, 300),
    questionOpacity: progress(time, 5850, 350),
    moneyOpacity: 1 - progress(time, 8000, 300),
    headerOpacity: 1 - progress(time, 8150, 500),
    topAperture: progress(time, 8400, 350),
    bottomAperture: progress(time, 8300, 400),
    month,
    // All weeks share the same camera and subdivide before context recedes.
    contextExit: progress(time, 9800, 1050),
    skin: progress(time, 9750, 1250),
    planeTilt: 0,
    focus: progress(time, 8050, 500) * (1 - progress(time, 10300, 700)),
    signal: progress(time, 9850, 1100),
    signalOpacity: progress(time, 9800, 350) * (1 - progress(time, 10500, 500)),
    headerArrival: progress(time, 9700, 1000),
    dockArrival: progress(time, 9900, 1000),
    chromeClear: progress(time, 8650, 800),
    paperOpacity: 1 - progress(time, 9700, 1300),
    handoff: progress(time, 11000, 400),
    ready: time >= 11000,
    settled: time >= 11400,
  };
}

export function lifeCellMaterialization(time, index, todayIndex) {
  const distance = Math.hypot(index % 7 - todayIndex % 7, Math.floor(index / 7) - Math.floor(todayIndex / 7));
  return progress(time, 9850 + Math.min(180, distance * 26), 700);
}

// One continuous lattice: first enlarge square weeks, then open seven days
// inside each parent. Background and calendar use exactly the same geometry.
export function lifeLatticeFrame({ camera, unit, cropCol, cropRow, targets, initialFill }, motion) {
  const first = targets[0];
  const finalPitchX = targets[1].x - first.x;
  const finalPitchY = targets[7].y - first.y;
  const finalWidth = targets[6].x + targets[6].width - first.x;
  const finalGap = finalPitchX - first.width;
  const size = unit * initialFill;
  const height = mix(size, first.height, motion.zoom);
  const weekWidth = mix(height, finalWidth, motion.division);
  const gap = Math.min(Math.max(0, finalGap), weekWidth / 28) * motion.division;
  const dayWidth = (weekWidth - gap * 6) / 7;
  const sourceCenterX = camera.originX + (cropCol + .5) * unit;
  const centerX = mix(sourceCenterX, first.x + finalWidth / 2, motion.zoom);
  return {
    x: centerX - weekWidth / 2,
    y: mix(camera.originY + cropRow * unit + (unit - size) / 2, first.y, motion.zoom),
    pitchX: weekWidth + mix(unit - size, finalGap, motion.zoom),
    pitchY: mix(unit, finalPitchY, motion.zoom),
    width: weekWidth, height,
    dayWidth, dayPitch: dayWidth + gap, gap, finalPitchX, finalPitchY,
  };
}

export function lifeCameraFrame({ gridLeft, gridTop }) {
  return { originX: gridLeft, originY: gridTop };
}

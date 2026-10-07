const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => value ** 3 * (10 - 15 * value + 6 * value ** 2);
const progress = (time, start, duration) => smooth(clamp((time - start) / duration));
const mix = (from, to, value) => from + (to - from) * value;
export const LIFE_COUNT_END = 8000;
export const LIFE_MOTION_END = 14200;
export function lifeCalendarMotion(time) {
  const zoom = progress(time, 8000, 1500);
  const division = progress(time, 9700, 1300);
  return {
    zoom, reframe:zoom, division, month:division,
    neighbors:progress(time,11600,1300),
    copyOpacity:1-progress(time,8000,400), copyRetreat:progress(time,8000,650),
    amountsOpacity:1-progress(time,5500,300), questionOpacity:progress(time,5850,350),
    moneyOpacity:1-progress(time,8000,300), headerOpacity:1-progress(time,8150,500),
    topAperture:progress(time,8400,350), bottomAperture:progress(time,8300,400),
    contextExit:progress(time,8050,900), skin:progress(time,10400,650),
    planeTilt:0, focus:progress(time,8000,350)*(1-progress(time,13000,450)),
    signal:0, signalOpacity:0,
    headerArrival:progress(time,12100,1100), dockArrival:progress(time,12300,900),
    chromeClear:progress(time,8650,800), paperOpacity:1-progress(time,12500,1000),
    handoff:progress(time,13600,400), ready:time>=13600, settled:time>=14000,
  };
}
export function lifeRowArrival(time,index,todayIndex) {
  const distance=Math.abs(Math.floor(index/7)-Math.floor(todayIndex/7));
  return distance===0 ? 1 : progress(time,11600+(distance-1)*100,750);
}
export function lifeCellMaterialization(time,index,todayIndex) {
  const distance=Math.abs(Math.floor(index/7)-Math.floor(todayIndex/7));
  return distance===0 ? progress(time,10900,400) : lifeRowArrival(time,index,todayIndex);
}
// A single parent week travels to today's anchor. It opens into seven days;
// neighboring rows later arrive at native size, never through another zoom.
export function lifeLatticeFrame({camera,unit,cropCol,cropRow,targets,initialFill,todayIndex=0},motion) {
  const first=targets[0], col=todayIndex%7, row=Math.floor(todayIndex/7);
  const finalPitchX=targets[1].x-first.x, finalPitchY=targets[7].y-first.y;
  const finalWidth=targets[6].x+targets[6].width-first.x, finalGap=finalPitchX-first.width;
  const size=unit*initialFill;
  const height=mix(mix(size,Math.min(first.height,first.width,76),motion.zoom),first.height,motion.division ** 3);
  const gap=Math.max(0,finalGap)*motion.division;
  const leftWeight=(1-motion.division)/2+motion.division*(col+.5)/7;
  const gapOffset=gap*motion.division*(col-3)/7;
  const nativeAnchor=col*finalPitchX+first.width/2;
  const limitLeft=(nativeAnchor-gapOffset)/leftWeight;
  const limitRight=(finalWidth-nativeAnchor+gapOffset)/(1-leftWeight);
  const weekWidth=Math.min(mix(height,finalWidth,motion.division),limitLeft,limitRight);
  const dayWidth=(weekWidth-gap*6)/7, dayPitch=dayWidth+gap;
  const anchorX=mix(camera.originX+(cropCol+.5)*unit,first.x+col*finalPitchX+first.width/2,motion.zoom);
  const anchorY=mix(camera.originY+(cropRow+.5)*unit,first.y+row*finalPitchY+first.height/2,motion.zoom);
  const focusWidth=mix(weekWidth,dayWidth,motion.division);
  return {x:anchorX-col*dayPitch*motion.division-focusWidth/2,y:anchorY-height/2-row*finalPitchY,
    pitchX:weekWidth+Math.max(finalGap,unit-size),pitchY:finalPitchY,
    width:weekWidth,height,dayWidth,dayPitch,gap,finalPitchX,finalPitchY,anchorX,anchorY};
}
export function lifeCameraFrame({gridLeft,gridTop}) {return {originX:gridLeft,originY:gridTop};}

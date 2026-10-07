const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => value ** 3 * (10 - 15 * value + 6 * value ** 2);
const progress = (time, start, duration) => smooth(clamp((time - start) / duration));
const mix = (from, to, value) => from + (to - from) * value;
export const LIFE_COUNT_END = 8000;
export const LIFE_MOTION_END = 14200;
export function lifeCalendarMotion(time) {
  const zoom = progress(time, 8300, 1400);
  const division = progress(time, 9850, 1500);
  return {
    zoom, reframe:zoom, division, month:division,
    neighbors:division,
    copyOpacity:1-progress(time,8000,400), copyRetreat:progress(time,8000,650),
    amountsOpacity:1-progress(time,5500,300), questionOpacity:progress(time,5850,350),
    moneyOpacity:1-progress(time,8000,300), headerOpacity:1-progress(time,8150,500),
    topAperture:progress(time,8400,350), bottomAperture:progress(time,8300,400),
    contextExit:progress(time,8100,1000), skin:progress(time,10400,650),
    planeTilt:0, focus:progress(time,7600,400)*(1-division),
    signal:0, signalOpacity:0,
    headerArrival:progress(time,12100,1100), dockArrival:progress(time,12300,900),
    chromeClear:progress(time,8650,800), paperOpacity:1-progress(time,12500,1000),
    handoff:progress(time,13600,400), ready:time>=13600, settled:time>=14000,
  };
}
export function lifeRowArrival() { return 1; }
export function lifeCellMaterialization(time,index) {
  return progress(time,10950+Math.floor(index/7)*35,500);
}
// All weeks of the month travel as one bounded group. Each parent opens
// horizontally into its own seven-day row while the group keeps its center.
export function lifeLatticeFrame({camera,unit,cropCol,cropRow,targets,initialFill,todayIndex=0},motion) {
 const first=targets[0],rows=targets.length/7;
 const finalPitchX=targets[1].x-first.x,finalPitchY=targets[7].y-first.y;
 const finalWidth=targets[6].x+targets[6].width-first.x,finalGap=finalPitchX-first.width;
 const size=unit*initialFill, square=Math.min(76,first.height,finalWidth*.22);
 const height=mix(mix(size,square,motion.zoom),first.height,motion.division);
 const pitchY=mix(mix(unit,square+8,motion.zoom),finalPitchY,motion.division);
 const width=mix(mix(size,square,motion.zoom),finalWidth,motion.division);
 const gap=Math.max(0,finalGap)*motion.division;
 const dayWidth=(width-gap*6)/7,dayPitch=dayWidth+gap;
 const anchorX=mix(camera.originX+(cropCol+.5)*unit,first.x+finalWidth/2,motion.zoom);
 const anchorY=mix(camera.originY+(cropRow+rows/2)*unit,first.y+((rows-1)*finalPitchY+first.height)/2,motion.zoom);
 return {x:anchorX-width/2,y:anchorY-((rows-1)*pitchY+height)/2,
  pitchX:width+Math.max(finalGap,unit-size),pitchY,width,height,dayWidth,dayPitch,gap,finalPitchX,finalPitchY,anchorX,anchorY};
}
export function lifeCameraFrame({gridLeft,gridTop}) {return {originX:gridLeft,originY:gridTop};}

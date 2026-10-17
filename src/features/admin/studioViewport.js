export const initialViewport = {x:0,y:0,scale:1};
export function zoomViewport(viewport, point, factor) {
  const scale=Math.max(.25,Math.min(2,viewport.scale*factor));
  return {scale,x:point.x-(point.x-viewport.x)*scale/viewport.scale,y:point.y-(point.y-viewport.y)*scale/viewport.scale};
}
export function homeViewport(calendar) {return {x:24-calendar.x,y:24-calendar.y,scale:1};}

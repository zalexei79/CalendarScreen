// Keep the approved camera choreography at its original speed. Shorten the
// overview and the settled chrome rather than rushing the cell refinement.
export const LIFE_OVERVIEW_DURATION = 4000;
export const LIFE_PLAYBACK_END = 8750;
const checkpoints = [[0, 0], [4000, 8000], [7350, 11350], [8350, 13500], [8750, 14200]];
function interpolate(value, input, output) {
  for (let index = 1; index < checkpoints.length; index++) {
    const start = checkpoints[index - 1], end = checkpoints[index];
    if (value <= end[input]) return start[output] + Math.max(0, value - start[input]) / (end[input] - start[input]) * (end[output] - start[output]);
  }
  return checkpoints.at(-1)[output];
}
export const lifeStoryTime = elapsed => interpolate(elapsed, 0, 1);
export const lifeStoryElapsed = time => interpolate(time, 1, 0);

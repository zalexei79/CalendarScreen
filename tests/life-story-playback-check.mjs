import assert from 'node:assert/strict';
import { lifeStoryTime, lifeStoryElapsed, LIFE_OVERVIEW_DURATION, LIFE_PLAYBACK_END } from '../src/features/onboarding/lifeStoryPlayback.js';
assert.equal(LIFE_OVERVIEW_DURATION, 4000);
assert.equal(lifeStoryTime(0), 0);
assert.equal(lifeStoryTime(LIFE_PLAYBACK_END), 14200);
assert.equal(lifeStoryTime(LIFE_PLAYBACK_END + 1000), 14200);
assert.equal(lifeStoryTime(-100), 0);
assert.ok(LIFE_PLAYBACK_END < 9000);
for (let elapsed = 0; elapsed < LIFE_PLAYBACK_END; elapsed += 16) {
  assert.ok(lifeStoryTime(elapsed + 16) >= lifeStoryTime(elapsed));
  assert.ok(Math.abs(lifeStoryElapsed(lifeStoryTime(elapsed)) - elapsed) < .001);
}
for (let time = 8300; time + 16 <= 11350; time += 16) {
  assert.ok(Math.abs(lifeStoryElapsed(time + 16) - lifeStoryElapsed(time) - 16) < .001, 'The approved camera and weekly refinement retain their real duration');
}
console.log('PASS: 8.75-second story, four-second overview, continuous playback and unchanged camera speed.');

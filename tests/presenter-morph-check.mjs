import assert from 'node:assert/strict';
import { createPresenterMesh, blendPresenterPositions, smoothMorph } from '../src/features/onboarding/presenterMorphMesh.js';

const mesh = createPresenterMesh();
assert.equal(mesh.mask.length, 471);
assert.ok(mesh.triangles.every(i => i >= 0 && i < mesh.mask.length));
for (let i = 0; i <= 40; i++) {
  const t = i / 40;
  assert.ok(smoothMorph(t) >= 0 && smoothMorph(t) <= 1);
  if (i) assert.ok(smoothMorph(t) >= smoothMorph(t - 1 / 40));
  for (const pair of [[1 - t, t, 0], [0, 1 - t, t], [t, 0, 1 - t]]) {
    const result = blendPresenterPositions(mesh, pair);
    assert.ok([...result].every(Number.isFinite));
    for (const index of mesh.oval) {
      assert.ok(Math.abs(result[index * 2] - mesh.positions[0][index][0]) < .000001, 'Head contour stays anchored');
      assert.ok(Math.abs(result[index * 2 + 1] - mesh.positions[0][index][1]) < .000001);
    }
  }
}
assert.equal(smoothMorph(0), 0); assert.equal(smoothMorph(1), 1); assert.equal(smoothMorph(.5), .5);
assert.ok(smoothMorph(.01) < .00002 && 1 - smoothMorph(.99) < .00002, 'Morph starts and settles gently');
const smile = blendPresenterPositions(mesh, [1, 0, 0]);
const sad = blendPresenterPositions(mesh, [0, 1, 0]);
assert.ok(Math.hypot(smile[13 * 2] - sad[13 * 2], smile[13 * 2 + 1] - sad[13 * 2 + 1]) > .001, 'Lips change geometry, not just opacity');
console.log('Presenter morph: anchored contour, changing lips, finite intermediate geometry and smooth easing passed.');

import detected from '../../assets/onboarding/presenter-mesh.json' with { type: 'json' };

export const PRESENTER_MORPH_MS = 3200;
export const PRESENTER_EMOTIONS = ['smile', 'sad', 'angry'];
export const smoothMorph = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * t * (10 + t * (-15 + 6 * t));
};
const W = 972, H = 809;
const pixel = ([x, y]) => [x * W, y * H];
const base = detected.frames.smile.map(pixel);
const distanceToEdge = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const center = detected.oval.reduce((sum, i) => [sum[0] + base[i][0] / detected.oval.length, sum[1] + base[i][1] / detected.oval.length], [0, 0]);
const oval = [...detected.oval].sort((a, b) => Math.atan2(base[a][1] - center[1], base[a][0] - center[0]) - Math.atan2(base[b][1] - center[1], base[b][0] - center[0]));
const distances = base.map(p => Math.min(...oval.map((index, i) => distanceToEdge(p, base[index], base[oval[(i + 1) % oval.length]]))));
const faceWidth = Math.max(...oval.map(i => base[i][0])) - Math.min(...oval.map(i => base[i][0]));

export function createPresenterMesh() {
  const positions = [], uv = [];
  for (const name of PRESENTER_EMOTIONS) {
    const points = detected.frames[name].map(pixel);
    // Eye corners align head scale/rotation. Outer contours stay anchored to the
    // smiling head: only facial features move, never the hair, jacket or hand.
    const [a, b] = [points[33], points[263]], [targetA, targetB] = [base[33], base[263]];
    const sx = b[0] - a[0], sy = b[1] - a[1], tx = targetB[0] - targetA[0], ty = targetB[1] - targetA[1];
    const scale = (tx * sx + ty * sy) / (sx * sx + sy * sy);
    const rotation = (ty * sx - tx * sy) / (sx * sx + sy * sy);
    const moveX = targetA[0] - scale * a[0] + rotation * a[1];
    const moveY = targetA[1] - rotation * a[0] - scale * a[1];
    positions.push(points.map((p, i) => {
      const weight = smoothMorph(distances[i] / (faceWidth * .12));
      return [(base[i][0] + (scale * p[0] - rotation * p[1] + moveX - base[i][0]) * weight) / W,
        (base[i][1] + (rotation * p[0] + scale * p[1] + moveY - base[i][1]) * weight) / H];
    }));
    uv.push(detected.frames[name].map(([x, y]) => [name === 'angry' ? x : (x + (name === 'sad' ? 1 : 0)) / 2, y]));
  }
  const triangles = [...detected.triangles];
  const mask = distances.map(distance => smoothMorph(distance / (faceWidth * .055)));
  // Fill the eye and mouth openings in the canonical mesh. Otherwise the old
  // smile/teeth would remain visible underneath an expression with closed lips.
  for (const ring of [
    [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246],
    [263,249,390,373,374,380,381,382,362,398,384,385,386,387,388,466],
    [78,191,80,81,82,13,312,311,310,415,308,324,318,402,317,14,87,178,88,95],
  ]) {
    const index = mask.length;
    for (const frames of [positions, uv]) for (const frame of frames) frame.push(ring.reduce((p, i) => [p[0] + frame[i][0] / ring.length, p[1] + frame[i][1] / ring.length], [0, 0]));
    mask.push(1);
    ring.forEach((vertex, i) => triangles.push(vertex, ring[(i + 1) % ring.length], index));
  }
  return { positions, uv, mask, triangles, oval, width: W, height: H };
}

export function blendPresenterPositions(mesh, weights, result = new Float32Array(mesh.mask.length * 2)) {
  for (let i = 0; i < mesh.mask.length; i++) {
    result[i * 2] = mesh.positions.reduce((sum, frame, j) => sum + frame[i][0] * weights[j], 0);
    result[i * 2 + 1] = mesh.positions.reduce((sum, frame, j) => sum + frame[i][1] * weights[j], 0);
  }
  return result;
}

const finiteVector = value => value && ['x','y','z'].every(axis => Number.isFinite(value[axis]));

// A deliberate lateral impulse followed by braking. The first impulse owns
// the direction; the rebound must never turn into a second month change.
export function createMonthShakeDetector() {
  let previousTime = null, previousAngle = null, gravity = null;
  let quietSince = null, readyUntil = -Infinity, impulse = null, cooldownUntil = -Infinity;
  function disarm() { quietSince = null; readyUntil = -Infinity; impulse = null; }
  function reset() {
    previousTime = previousAngle = gravity = null;
    disarm();
    // Keep the cooldown across modal/visibility boundaries.
  }
  function push(event, now, angle = 0) {
    if (!Number.isFinite(now) || !Number.isFinite(angle)) { reset(); return null; }
    const gap = previousTime === null ? 0 : now - previousTime;
    if (gap < 0 || gap > 250 || previousAngle !== angle) { gravity = null; disarm(); }
    previousTime = now; previousAngle = angle;
    const rates = event?.rotationRate;
    if (rates && ['alpha','beta','gamma'].some(axis => Number.isFinite(rates[axis]) && Math.abs(rates[axis]) > 100)) {
      gravity = null; disarm(); return null;
    }
    let acceleration = event?.acceleration;
    if (!finiteVector(acceleration)) {
      const raw = event?.accelerationIncludingGravity;
      if (!finiteVector(raw)) { reset(); return null; }
      if (!gravity) { gravity = {x:raw.x,y:raw.y,z:raw.z}; return null; }
      const alpha = Math.max(1,Math.min(gap,100)) / (350 + Math.max(1,Math.min(gap,100)));
      acceleration = {};
      for (const axis of ['x','y','z']) {
        gravity[axis] += alpha * (raw[axis] - gravity[axis]);
        acceleration[axis] = raw[axis] - gravity[axis];
      }
    } else gravity = null;
    const radians = angle * Math.PI / 180;
    // Device axes stay in the natural orientation. Screen-right is -Y at 90°.
    const x = acceleration.x * Math.cos(radians) - acceleration.y * Math.sin(radians);
    const y = acceleration.x * Math.sin(radians) + acceleration.y * Math.cos(radians);
    const z = acceleration.z, magnitude = Math.hypot(x,y,z);
    if (magnitude > 60) { disarm(); return null; }
    if (now < cooldownUntil) { disarm(); return null; }
    const lateral = Math.abs(x) >= Math.max(3,Math.abs(y)*1.5,Math.abs(z)*1.5);
    if (impulse) {
      const elapsed = now - impulse.time;
      if (elapsed > 600 || (magnitude > 5 && !lateral)) { disarm(); return null; }
      if (elapsed >= 50 && lateral && Math.sign(x) === -impulse.direction && Math.abs(x) >= 5) {
        const direction = impulse.direction;
        cooldownUntil = now + 1200; disarm();
        return direction < 0 ? 'prev' : 'next';
      }
      return null;
    }
    if (magnitude <= 2) {
      quietSince ??= now;
      if (now - quietSince >= 250) readyUntil = now + 200;
    } else {
      quietSince = null;
      if (lateral && Math.abs(x) >= 8 && now <= readyUntil) {
        impulse = {direction:Math.sign(x),time:now}; readyUntil = -Infinity;
      } else if (magnitude > 5 && !lateral) disarm();
    }
    return null;
  }
  return {push,reset};
}

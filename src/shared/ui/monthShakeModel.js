const finiteVector = value => value && ['x','y','z'].every(axis => Number.isFinite(value[axis]));
export const hasMonthMotionData = event => finiteVector(event?.acceleration) || finiteVector(event?.accelerationIncludingGravity);

export function monthShakeScreenAngle(device = globalThis.window) {
  // iOS's legacy angle is portrait-relative. WebKit can report a different
  // natural orientation through screen.orientation (e.g. 90 vs legacy 0).
  // Never rotate portrait iPhone sensor axes based on that different frame.
  return Number.isFinite(device?.orientation) ? device.orientation
    : Number.isFinite(device?.screen?.orientation?.angle) ? device.screen.orientation.angle : 0;
}

// A deliberate lateral impulse followed by braking. The first impulse owns
// the direction; the rebound must never turn into a second month change.
export function createMonthShakeDetector({sensitivity='normal'} = {}) {
  const profile = sensitivity === 'high' ? {start:2.2,brake:1.1,area:.06} : {start:3.6,brake:1.8,area:.1};
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
    if (gap < 0 || gap > 350 || previousAngle !== angle) { gravity = null; disarm(); }
    previousTime = now; previousAngle = angle;
    const rates = event?.rotationRate;
    // Linear acceleration is already gravity-compensated. A normal wrist turn
    // must not veto it; only the gravity fallback needs a strict rotation gate.
    const rotationLimit = finiteVector(event?.acceleration) ? 500 : 100;
    if (rates && ['alpha','beta','gamma'].some(axis => Number.isFinite(rates[axis]) && Math.abs(rates[axis]) > rotationLimit)) {
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
    const lateral = Math.abs(x) >= Math.max(1.3,Math.abs(y)*1.15,Math.abs(z)*.9);
    if (impulse) {
      const elapsed = now - impulse.time;
      if (elapsed > 700 || (magnitude > profile.start*1.8 && Math.abs(x) < Math.max(Math.abs(y),Math.abs(z))*.5)) { disarm(); return null; }
      impulse.area += Math.max(0,x*impulse.direction)*Math.min(gap,80)/1000;
      const braking = Math.abs(x) >= Math.max(profile.brake,Math.abs(y)*.7,Math.abs(z)*.6);
      if (elapsed >= 25 && braking && Math.sign(x) === -impulse.direction && impulse.area >= profile.area) {
        const direction = impulse.direction;
        cooldownUntil = now + 1200; disarm();
        return direction < 0 ? 'prev' : 'next';
      }
      return null;
    }
    if (magnitude <= 2.2) {
      quietSince ??= now;
      if (now - quietSince >= 150) readyUntil = now + 500;
    } else {
      quietSince = null;
      if (lateral && Math.abs(x) >= profile.start && now <= readyUntil) {
        impulse = {direction:Math.sign(x),time:now,area:Math.abs(x)*Math.min(gap,50)/1000}; readyUntil = -Infinity;
      } else if (magnitude > profile.start && !lateral) disarm();
    }
    return null;
  }
  return {push,reset};
}

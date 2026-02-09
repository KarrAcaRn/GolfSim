/**
 * Offline simulation of ball physics to verify behavior.
 * Run with: npx tsx scripts/test-ball-physics.ts
 */

// Constants (copied from src/utils/Constants.ts)
const GRAVITY = 400;
const BOUNCE_FACTOR = 0.4;
const BOUNCE_FRICTION = 0.6;
const MIN_BOUNCE_VZ = 15;
const LANDING_SPEED_FACTOR = 0.25;
const MAX_POWER = 500;

// Terrain friction (copied from src/models/TileTypes.ts)
const TERRAIN: Record<string, number> = {
  Sand:    0.75,
  Rough:   0.82,
  Grass:   0.88,
  Fairway: 0.91,
  Tee:     0.91,
  Green:   0.94,
};

const STOP_THRESHOLD = 3;
const FPS = 60;
const DT = 1 / FPS;

interface SimResult {
  flightDist: number;
  flightTime: number;
  bounces: number;
  landingSpeed: number;
  groundRollDist: Record<string, number>;
  groundRollTime: Record<string, number>;
  totalDist: Record<string, number>;
}

function simulate(power: number, loftDeg: number, dirAngle: number = 0): SimResult {
  const loftRad = (loftDeg * Math.PI) / 180;
  const horizontalPower = power * Math.cos(loftRad);
  let vz = power * Math.sin(loftRad);

  let groundVx = Math.cos(dirAngle) * horizontalPower;
  let groundVy = Math.sin(dirAngle) * horizontalPower;
  let x = 0, y = 0, z = 0;
  let airborne = vz > MIN_BOUNCE_VZ;
  let bounces = 0;
  let flightFrames = 0;

  // === FLIGHT PHASE ===
  while (airborne) {
    x += groundVx * DT;
    y += groundVy * DT;
    vz -= GRAVITY * DT;
    z += vz * DT;
    flightFrames++;

    if (z <= 0 && vz < 0) {
      z = 0;
      if (Math.abs(vz) > MIN_BOUNCE_VZ) {
        vz = -vz * BOUNCE_FACTOR;
        groundVx *= BOUNCE_FRICTION;
        groundVy *= BOUNCE_FRICTION;
        bounces++;
      } else {
        vz = 0;
        airborne = false;
        groundVx *= LANDING_SPEED_FACTOR;
        groundVy *= LANDING_SPEED_FACTOR;
      }
    }

    if (flightFrames > 10000) break; // safety
  }

  const flightDist = Math.sqrt(x * x + y * y);
  const flightTime = flightFrames / FPS;
  const landingSpeed = Math.sqrt(groundVx * groundVx + groundVy * groundVy);

  // === GROUND ROLL PHASE (per terrain) ===
  const groundRollDist: Record<string, number> = {};
  const groundRollTime: Record<string, number> = {};
  const totalDist: Record<string, number> = {};

  for (const [name, friction] of Object.entries(TERRAIN)) {
    let gvx = groundVx;
    let gvy = groundVy;
    let gx = 0, gy = 0;
    let frames = 0;

    while (true) {
      const speed = Math.sqrt(gvx * gvx + gvy * gvy);
      if (speed < STOP_THRESHOLD) break;

      // Damping: multiply velocity by friction each frame
      gvx *= friction;
      gvy *= friction;
      gx += gvx * DT;
      gy += gvy * DT;
      frames++;

      if (frames > 10000) break;
    }

    const rollDist = Math.sqrt(gx * gx + gy * gy);
    groundRollDist[name] = rollDist;
    groundRollTime[name] = frames / FPS;
    totalDist[name] = flightDist + rollDist;
  }

  return { flightDist, flightTime, bounces, landingSpeed, groundRollDist, groundRollTime, totalDist };
}

// === RUN TESTS ===
console.log('=== BALL PHYSICS SIMULATION ===\n');

const tests = [
  { label: 'Schwacher Putt (10% Power, 10° Loft)',   power: MAX_POWER * 0.1, loft: 10 },
  { label: 'Mittlerer Putt (20% Power, 10° Loft)',   power: MAX_POWER * 0.2, loft: 10 },
  { label: 'Chip Shot (30% Power, 45° Loft)',         power: MAX_POWER * 0.3, loft: 45 },
  { label: 'Mittlerer Schlag (50% Power, 30° Loft)',  power: MAX_POWER * 0.5, loft: 30 },
  { label: 'Starker Schlag (80% Power, 30° Loft)',    power: MAX_POWER * 0.8, loft: 30 },
  { label: 'Volle Power (100% Power, 30° Loft)',      power: MAX_POWER * 1.0, loft: 30 },
  { label: 'Hoher Lob (60% Power, 60° Loft)',         power: MAX_POWER * 0.6, loft: 60 },
  { label: 'Flacher Drive (100% Power, 15° Loft)',    power: MAX_POWER * 1.0, loft: 15 },
];

for (const t of tests) {
  const r = simulate(t.power, t.loft);
  console.log(`--- ${t.label} ---`);
  console.log(`  Power: ${t.power.toFixed(0)}, Loft: ${t.loft}°`);
  console.log(`  Flug: ${r.flightDist.toFixed(1)} px in ${r.flightTime.toFixed(2)}s, ${r.bounces} Bounces`);
  console.log(`  Landegeschwindigkeit: ${r.landingSpeed.toFixed(1)} px/s`);
  console.log(`  Bodenrollen (Distanz / Zeit):`);
  for (const [name, dist] of Object.entries(r.groundRollDist)) {
    const time = r.groundRollTime[name];
    const total = r.totalDist[name];
    console.log(`    ${name.padEnd(8)}: Roll ${dist.toFixed(1).padStart(7)} px in ${time.toFixed(2)}s | Total: ${total.toFixed(1)} px (${(total/64).toFixed(1)} tiles)`);
  }
  console.log();
}

// Tile reference
console.log('=== REFERENZ: 1 Tile = 64 px ===');
console.log('32x32 Map = 2048 px Breite\n');

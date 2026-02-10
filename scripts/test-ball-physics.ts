/**
 * Offline simulation of ball physics to verify behavior.
 * Run with: npx tsx scripts/test-ball-physics.ts
 */

// Constants (copied from src/utils/Constants.ts)
const GRAVITY = 400;
const MIN_BOUNCE_VZ = 15;
const BOUNCE_HORIZONTAL_DAMPING = 0.6;

// Club data (copied from src/models/Club.ts)
const CLUBS = [
  { name: 'Driver',     maxPower: 600, loft: 12 },
  { name: 'Wood',       maxPower: 500, loft: 20 },
  { name: 'Iron',       maxPower: 400, loft: 35 },
  { name: 'Sand Wedge', maxPower: 300, loft: 55 },
  { name: 'Putter',     maxPower: 200, loft: 0  },
];

// Terrain properties (copied from src/models/TileTypes.ts)
const TERRAIN: Record<string, { friction: number; bounceFactor: number; landingSpeedFactor: number }> = {
  Sand:    { friction: 0.75, bounceFactor: 0.0,  landingSpeedFactor: 0.0  },
  Rough:   { friction: 0.82, bounceFactor: 0.25, landingSpeedFactor: 0.10 },
  Grass:   { friction: 0.88, bounceFactor: 0.35, landingSpeedFactor: 0.20 },
  Fairway: { friction: 0.91, bounceFactor: 0.40, landingSpeedFactor: 0.30 },
  Tee:     { friction: 0.91, bounceFactor: 0.40, landingSpeedFactor: 0.30 },
  Green:   { friction: 0.94, bounceFactor: 0.45, landingSpeedFactor: 0.35 },
};

const STOP_THRESHOLD = 3;
const FPS = 60;
const DT = 1 / FPS;

interface TerrainSimResult {
  flightDist: number;
  flightTime: number;
  bounces: number;
  groundRollDist: number;
  groundRollTime: number;
  totalDist: number;
}

type SimResult = Record<string, TerrainSimResult>;

function simulate(power: number, loftDeg: number, dirAngle: number = 0): SimResult {
  const loftRad = (loftDeg * Math.PI) / 180;
  const horizontalPower = power * Math.cos(loftRad);
  const initialVz = power * Math.sin(loftRad);

  const results: SimResult = {};

  // Simulate for each terrain separately
  for (const [name, terrain] of Object.entries(TERRAIN)) {
    let vz = initialVz;
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
        if (Math.abs(vz) > MIN_BOUNCE_VZ && terrain.bounceFactor > 0) {
          vz = -vz * terrain.bounceFactor;
          groundVx *= BOUNCE_HORIZONTAL_DAMPING;
          groundVy *= BOUNCE_HORIZONTAL_DAMPING;
          bounces++;
        } else {
          vz = 0;
          airborne = false;
          groundVx *= terrain.landingSpeedFactor;
          groundVy *= terrain.landingSpeedFactor;
        }
      }

      if (flightFrames > 10000) break; // safety
    }

    const flightDist = Math.sqrt(x * x + y * y);
    const flightTime = flightFrames / FPS;

    // === GROUND ROLL PHASE ===
    let gx = 0, gy = 0;
    let frames = 0;

    while (true) {
      const speed = Math.sqrt(groundVx * groundVx + groundVy * groundVy);
      if (speed < STOP_THRESHOLD) break;

      // Damping: multiply velocity by friction each frame
      groundVx *= terrain.friction;
      groundVy *= terrain.friction;
      gx += groundVx * DT;
      gy += groundVy * DT;
      frames++;

      if (frames > 10000) break;
    }

    const rollDist = Math.sqrt(gx * gx + gy * gy);
    const rollTime = frames / FPS;

    results[name] = {
      flightDist,
      flightTime,
      bounces,
      groundRollDist: rollDist,
      groundRollTime: rollTime,
      totalDist: flightDist + rollDist,
    };
  }

  return results;
}

// === RUN TESTS ===
console.log('=== BALL PHYSICS SIMULATION ===\n');

const tests: Array<{ label: string; power: number; loft: number }> = [];

// Test each club at 50% and 100% power
for (const club of CLUBS) {
  tests.push({
    label: `${club.name} - 50% Power`,
    power: club.maxPower * 0.5,
    loft: club.loft
  });
  tests.push({
    label: `${club.name} - 100% Power`,
    power: club.maxPower * 1.0,
    loft: club.loft
  });
}

for (const t of tests) {
  const r = simulate(t.power, t.loft);
  console.log(`--- ${t.label} ---`);
  console.log(`  Power: ${t.power.toFixed(0)}, Loft: ${t.loft}°`);
  for (const [name, result] of Object.entries(r)) {
    console.log(`    ${name.padEnd(8)}: Flug ${result.flightDist.toFixed(1).padStart(6)} px (${result.bounces} bounces) | Roll ${result.groundRollDist.toFixed(1).padStart(6)} px | Total: ${result.totalDist.toFixed(1).padStart(7)} px (${(result.totalDist/64).toFixed(1)} tiles)`);
  }
  console.log();
}

// Tile reference
console.log('=== REFERENZ: 1 Tile = 64 px ===');
console.log('32x32 Map = 2048 px Breite\n');

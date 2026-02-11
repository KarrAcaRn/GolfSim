import { createCanvas } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';

// Constants from the game
const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;

// Tile types and colors from TileTypes.ts
const TILE_PROPERTIES = {
  0: { type: 0, color: 0x4a8f3f, name: 'GRASS' },
  1: { type: 1, color: 0x5cb85c, name: 'FAIRWAY' },
  2: { type: 2, color: 0x7dcea0, name: 'GREEN' },
  3: { type: 3, color: 0xd4b96a, name: 'SAND' },
  4: { type: 4, color: 0x3498db, name: 'WATER' },
  5: { type: 5, color: 0x3d7a33, name: 'ROUGH' },
  6: { type: 6, color: 0x8fbc8f, name: 'TEE' },
};

// Helper functions
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function adjustColor(color: number, amount: number): number {
  const r = Math.min(255, Math.max(0, ((color >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((color >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (color & 0xff) + amount));
  return (r << 16) | (g << 8) | b;
}

function isInsideDiamond(px: number, py: number, halfW: number, halfH: number): boolean {
  return Math.abs(px - halfW) / halfW + Math.abs(py - halfH) / halfH <= 1;
}

function getDiamondWidthAtY(y: number, halfW: number, halfH: number): { minX: number; maxX: number } {
  const dy = Math.abs(y - halfH) / halfH;
  const extent = halfW * (1 - dy);
  return { minX: halfW - extent, maxX: halfW + extent };
}

function colorToRgba(color: number, alpha: number): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

// Pattern drawing functions
function drawGrassPattern(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  baseColor: number,
  rand: () => number
): void {
  // Draw ~20 small grass tufts with 2-3 short lines each
  for (let i = 0; i < 20; i++) {
    const px = rand() * TILE_WIDTH;
    const py = rand() * TILE_HEIGHT;

    if (!isInsideDiamond(px, py, halfW, halfH)) continue;

    const colorVariation = rand() < 0.5 ? -20 : 15;
    const tuftColor = adjustColor(baseColor, colorVariation);
    const lineCount = Math.floor(rand() * 2) + 2; // 2-3 lines

    ctx.strokeStyle = colorToRgba(tuftColor, 0.8);
    ctx.lineWidth = 1;

    for (let j = 0; j < lineCount; j++) {
      const angle = rand() * Math.PI * 2;
      const length = rand() * 2 + 2; // 2-4px
      const x1 = px;
      const y1 = py;
      const x2 = x1 + Math.cos(angle) * length;
      const y2 = y1 + Math.sin(angle) * length;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
}

function drawFairwayPattern(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  baseColor: number,
  rand: () => number
): void {
  // Draw alternating horizontal mow stripes
  const stripeHeight = 3;
  const lighterColor = adjustColor(baseColor, 12);

  ctx.fillStyle = colorToRgba(lighterColor, 0.5);

  for (let y = 0; y < TILE_HEIGHT; y += stripeHeight * 2) {
    const { minX, maxX } = getDiamondWidthAtY(y + stripeHeight / 2, halfW, halfH);
    if (maxX > minX) {
      ctx.fillRect(minX, y, maxX - minX, stripeHeight);
    }
  }
}

function drawGreenPattern(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  baseColor: number,
  rand: () => number
): void {
  // Draw fine horizontal lines every 3px
  const lighterColor = adjustColor(baseColor, 8);
  ctx.strokeStyle = colorToRgba(lighterColor, 0.3);
  ctx.lineWidth = 1;

  for (let y = 2; y < TILE_HEIGHT; y += 3) {
    const { minX, maxX } = getDiamondWidthAtY(y, halfW, halfH);
    if (maxX > minX) {
      ctx.beginPath();
      ctx.moveTo(minX, y);
      ctx.lineTo(maxX, y);
      ctx.stroke();
    }
  }

  // Add 3-5 tiny highlight dots
  const dotCount = Math.floor(rand() * 3) + 3;
  ctx.fillStyle = colorToRgba(adjustColor(baseColor, 15), 0.6);
  for (let i = 0; i < dotCount; i++) {
    const px = rand() * TILE_WIDTH;
    const py = rand() * TILE_HEIGHT;
    if (isInsideDiamond(px, py, halfW, halfH)) {
      ctx.fillRect(px, py, 1, 1);
    }
  }
}

function drawSandPattern(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  baseColor: number,
  rand: () => number
): void {
  // Draw ~30 random small dots (sand grains)
  for (let i = 0; i < 30; i++) {
    const px = rand() * TILE_WIDTH;
    const py = rand() * TILE_HEIGHT;

    if (!isInsideDiamond(px, py, halfW, halfH)) continue;

    const colorVariation = rand() < 0.5 ? 20 : -15;
    const dotColor = adjustColor(baseColor, colorVariation);
    ctx.fillStyle = colorToRgba(dotColor, 0.5);
    ctx.fillRect(px, py, 1, 1);
  }

  // Draw 2-3 gentle wave lines
  const waveColor = adjustColor(baseColor, -10);
  ctx.strokeStyle = colorToRgba(waveColor, 0.3);
  ctx.lineWidth = 1;

  const waveCount = Math.floor(rand() * 2) + 2;
  for (let i = 0; i < waveCount; i++) {
    const yStart = rand() * TILE_HEIGHT;
    const amplitude = 2;
    const frequency = 0.3;

    ctx.beginPath();
    let firstPoint = true;
    for (let x = 0; x < TILE_WIDTH; x++) {
      const y = yStart + Math.sin(x * frequency) * amplitude;
      if (isInsideDiamond(x, y, halfW, halfH)) {
        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    ctx.stroke();
  }
}

function drawWaterPattern(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  baseColor: number,
  rand: () => number
): void {
  // Draw 3-4 wavy horizontal lines
  const waveColor = adjustColor(baseColor, 30);
  ctx.strokeStyle = colorToRgba(waveColor, 0.4);
  ctx.lineWidth = 1;

  const waveCount = Math.floor(rand() * 2) + 3;
  for (let i = 0; i < waveCount; i++) {
    const yBase = (TILE_HEIGHT / (waveCount + 1)) * (i + 1);
    const amplitude = 2;
    const frequency = 0.4;
    const phase = rand() * Math.PI * 2;

    ctx.beginPath();
    let firstPoint = true;
    for (let step = 0; step <= 32; step++) {
      const x = (step / 32) * TILE_WIDTH;
      const y = yBase + Math.sin(x * frequency + phase) * amplitude;
      const { minX, maxX } = getDiamondWidthAtY(y, halfW, halfH);

      if (x >= minX && x <= maxX) {
        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    ctx.stroke();
  }

  // Add 4-6 tiny white highlight dots
  const dotCount = Math.floor(rand() * 3) + 4;
  ctx.fillStyle = colorToRgba(0xffffff, 0.4);
  for (let i = 0; i < dotCount; i++) {
    const px = rand() * TILE_WIDTH;
    const py = rand() * TILE_HEIGHT;
    if (isInsideDiamond(px, py, halfW, halfH)) {
      ctx.fillRect(px, py, 1, 1);
    }
  }
}

function drawRoughPattern(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  baseColor: number,
  rand: () => number
): void {
  // Draw ~35 dense grass tufts with longer lines
  for (let i = 0; i < 35; i++) {
    const px = rand() * TILE_WIDTH;
    const py = rand() * TILE_HEIGHT;

    if (!isInsideDiamond(px, py, halfW, halfH)) continue;

    const colorVariation = -Math.floor(rand() * 16 + 10); // -10 to -25
    const tuftColor = adjustColor(baseColor, colorVariation);
    const lineCount = Math.floor(rand() * 2) + 2; // 2-3 lines

    ctx.strokeStyle = colorToRgba(tuftColor, 0.8);
    ctx.lineWidth = 1;

    for (let j = 0; j < lineCount; j++) {
      const angle = rand() * Math.PI * 2;
      const length = rand() * 2 + 3; // 3-5px
      const x1 = px;
      const y1 = py;
      const x2 = x1 + Math.cos(angle) * length;
      const y2 = y1 + Math.sin(angle) * length;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  // Add ~8 dark patches
  const patchCount = Math.floor(rand() * 3) + 6;
  const patchColor = adjustColor(baseColor, -20);
  for (let i = 0; i < patchCount; i++) {
    const px = rand() * TILE_WIDTH;
    const py = rand() * TILE_HEIGHT;
    if (isInsideDiamond(px, py, halfW, halfH)) {
      const radius = rand() * 1 + 1; // 1-2px
      ctx.fillStyle = colorToRgba(patchColor, 0.3);
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawTeePattern(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  baseColor: number,
  rand: () => number
): void {
  // First draw fairway-style mow stripes
  drawFairwayPattern(ctx, halfW, halfH, baseColor, rand);

  // Add a tee marker in the center
  const markerColor = adjustColor(baseColor, 25);
  ctx.fillStyle = colorToRgba(markerColor, 0.8);
  ctx.beginPath();
  ctx.arc(halfW, halfH, 3, 0, Math.PI * 2);
  ctx.fill();

  // Add small cross lines
  ctx.strokeStyle = colorToRgba(markerColor, 0.8);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(halfW - 4, halfH);
  ctx.lineTo(halfW + 4, halfH);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(halfW, halfH - 4);
  ctx.lineTo(halfW, halfH + 4);
  ctx.stroke();
}

// Main generation function
function generateTile(tileType: number, withGrid: boolean): Buffer {
  const canvas = createCanvas(TILE_WIDTH, TILE_HEIGHT);
  const ctx = canvas.getContext('2d');
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;

  // Clear canvas (transparent background)
  ctx.clearRect(0, 0, TILE_WIDTH, TILE_HEIGHT);

  const props = TILE_PROPERTIES[tileType as keyof typeof TILE_PROPERTIES];
  const seed = tileType * 1000 + (withGrid ? 0 : 500);
  const rand = seededRandom(seed);

  // 1. Draw filled diamond base
  ctx.fillStyle = colorToRgba(props.color, 1);
  ctx.beginPath();
  ctx.moveTo(halfW, 0);
  ctx.lineTo(TILE_WIDTH, halfH);
  ctx.lineTo(halfW, TILE_HEIGHT);
  ctx.lineTo(0, halfH);
  ctx.closePath();
  ctx.fill();

  // 2. Draw pattern based on type
  switch (tileType) {
    case 0: // GRASS
      drawGrassPattern(ctx, halfW, halfH, props.color, rand);
      break;
    case 1: // FAIRWAY
      drawFairwayPattern(ctx, halfW, halfH, props.color, rand);
      break;
    case 2: // GREEN
      drawGreenPattern(ctx, halfW, halfH, props.color, rand);
      break;
    case 3: // SAND
      drawSandPattern(ctx, halfW, halfH, props.color, rand);
      break;
    case 4: // WATER
      drawWaterPattern(ctx, halfW, halfH, props.color, rand);
      break;
    case 5: // ROUGH
      drawRoughPattern(ctx, halfW, halfH, props.color, rand);
      break;
    case 6: // TEE
      drawTeePattern(ctx, halfW, halfH, props.color, rand);
      break;
  }

  // 3. Grid outline only for grid variant
  if (withGrid) {
    ctx.strokeStyle = colorToRgba(0x000000, 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(halfW, 0);
    ctx.lineTo(TILE_WIDTH, halfH);
    ctx.lineTo(halfW, TILE_HEIGHT);
    ctx.lineTo(0, halfH);
    ctx.closePath();
    ctx.stroke();
  }

  return canvas.toBuffer('image/png');
}

// Main execution
function main(): void {
  const outputDir = path.join(process.cwd(), 'public', 'assets', 'sprites', 'tiles');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created directory: ${outputDir}`);
  }

  console.log('Generating tile textures...\n');

  // Generate all tiles
  for (let tileType = 0; tileType < 7; tileType++) {
    const props = TILE_PROPERTIES[tileType as keyof typeof TILE_PROPERTIES];

    // Generate grid variant
    const gridBuffer = generateTile(tileType, true);
    const gridPath = path.join(outputDir, `tile_${tileType}.png`);
    fs.writeFileSync(gridPath, gridBuffer);
    console.log(`✓ Generated ${props.name} (with grid): tile_${tileType}.png`);

    // Generate clean variant
    const cleanBuffer = generateTile(tileType, false);
    const cleanPath = path.join(outputDir, `tile_${tileType}_clean.png`);
    fs.writeFileSync(cleanPath, cleanBuffer);
    console.log(`✓ Generated ${props.name} (clean): tile_${tileType}_clean.png`);
  }

  console.log('\nAll 14 tile textures generated successfully!');
  console.log(`Output directory: ${outputDir}`);
}

main();

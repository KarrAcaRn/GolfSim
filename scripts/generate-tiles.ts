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

// ─── Helper functions ────────────────────────────────────────────────────────

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

/** Set a single pixel via ImageData for crisp pixel-art placement */
function setPixel(
  imageData: ImageData,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a: number
): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= imageData.width || iy >= imageData.height) return;
  const idx = (iy * imageData.width + ix) * 4;
  // Alpha-blend over existing pixel
  const srcA = a / 255;
  const dstA = imageData.data[idx + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA === 0) return;
  imageData.data[idx]     = Math.round((r * srcA + imageData.data[idx]     * dstA * (1 - srcA)) / outA);
  imageData.data[idx + 1] = Math.round((g * srcA + imageData.data[idx + 1] * dstA * (1 - srcA)) / outA);
  imageData.data[idx + 2] = Math.round((b * srcA + imageData.data[idx + 2] * dstA * (1 - srcA)) / outA);
  imageData.data[idx + 3] = Math.round(outA * 255);
}

function hexToRgb(color: number): [number, number, number] {
  return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
}

// ─── Tile pattern drawing functions ─────────────────────────────────────────

/**
 * GRASS – two-tone dithered checkerboard with scattered grass blade clusters
 */
function drawGrassPattern(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  baseColor: number,
  rand: () => number
): void {
  const canvas = ctx.canvas;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const lighterColor = adjustColor(baseColor, 18);
  const [lr, lg, lb] = hexToRgb(lighterColor);

  // Checkerboard dither: every other pixel uses the lighter shade
  for (let py = 0; py < TILE_HEIGHT; py++) {
    for (let px = 0; px < TILE_WIDTH; px++) {
      if (!isInsideDiamond(px + 0.5, py + 0.5, halfW, halfH)) continue;
      if ((px + py) % 2 === 0) {
        setPixel(imageData, px, py, lr, lg, lb, 120);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Scattered grass blade clusters (2-3 short strokes per cluster, ~25 clusters)
  for (let i = 0; i < 25; i++) {
    const px = rand() * TILE_WIDTH;
    const py = rand() * TILE_HEIGHT;
    if (!isInsideDiamond(px, py, halfW, halfH)) continue;

    const darkVariant = rand() < 0.5;
    const tuftColor = adjustColor(baseColor, darkVariant ? -22 : 20);
    ctx.strokeStyle = colorToRgba(tuftColor, 0.85);
    ctx.lineWidth = 1;

    const bladeCount = Math.floor(rand() * 2) + 2; // 2-3 blades
    for (let j = 0; j < bladeCount; j++) {
      // Blades angle upward (negative y), spread slightly
      const spreadX = (rand() - 0.5) * 4;
      const height = rand() * 2 + 2; // 2-4px tall
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + spreadX, py - height);
      ctx.stroke();
    }
  }
}

/**
 * FAIRWAY – clean alternating 3px mow-stripe bands
 */
function drawFairwayPattern(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  baseColor: number,
  _rand: () => number
): void {
  const stripeHeight = 3;
  const lighterColor = adjustColor(baseColor, 14);
  const darkerColor  = adjustColor(baseColor, -8);

  // Draw alternating light/dark stripes pixel-row by pixel-row for sharpness
  for (let y = 0; y < TILE_HEIGHT; y++) {
    const stripeIndex = Math.floor(y / stripeHeight);
    const isLight = stripeIndex % 2 === 0;
    const stripeColor = isLight ? lighterColor : darkerColor;

    const { minX, maxX } = getDiamondWidthAtY(y + 0.5, halfW, halfH);
    if (maxX <= minX) continue;

    ctx.fillStyle = colorToRgba(stripeColor, 0.55);
    ctx.fillRect(Math.ceil(minX), y, Math.floor(maxX) - Math.ceil(minX) + 1, 1);
  }
}

/**
 * GREEN – ultra-smooth, fine 1px lines every 4px, a few highlight pixels
 */
function drawGreenPattern(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  baseColor: number,
  rand: () => number
): void {
  // Fine horizontal scan lines every 4 rows
  const lineColor = adjustColor(baseColor, 10);
  ctx.strokeStyle = colorToRgba(lineColor, 0.28);
  ctx.lineWidth = 1;

  for (let y = 4; y < TILE_HEIGHT; y += 4) {
    const { minX, maxX } = getDiamondWidthAtY(y, halfW, halfH);
    if (maxX <= minX) continue;
    ctx.beginPath();
    ctx.moveTo(Math.ceil(minX), y);
    ctx.lineTo(Math.floor(maxX), y);
    ctx.stroke();
  }

  // 3-5 tiny lighter highlight pixels scattered across the surface
  const dotCount = Math.floor(rand() * 3) + 3;
  const highlightColor = adjustColor(baseColor, 22);
  ctx.fillStyle = colorToRgba(highlightColor, 0.7);
  for (let i = 0; i < dotCount; i++) {
    const px = rand() * TILE_WIDTH;
    const py = rand() * TILE_HEIGHT;
    if (isInsideDiamond(px, py, halfW, halfH)) {
      ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
    }
  }
}

/**
 * SAND – dense stippled grain texture with shadow gradient areas
 */
function drawSandPattern(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  baseColor: number,
  rand: () => number
): void {
  const canvas = ctx.canvas;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Dense stipple: ~60 random 1px dots, alternating lighter/darker
  for (let i = 0; i < 60; i++) {
    const px = rand() * TILE_WIDTH;
    const py = rand() * TILE_HEIGHT;
    if (!isInsideDiamond(px + 0.5, py + 0.5, halfW, halfH)) continue;

    const variation = rand() < 0.5 ? 28 : -18;
    const c = adjustColor(baseColor, variation);
    const [r, g, b] = hexToRgb(c);
    setPixel(imageData, Math.floor(px), Math.floor(py), r, g, b, 180);
  }

  ctx.putImageData(imageData, 0, 0);

  // 2-3 subtle shadow gradient areas (dark blobs)
  const shadowCount = Math.floor(rand() * 2) + 2;
  for (let i = 0; i < shadowCount; i++) {
    const px = rand() * TILE_WIDTH;
    const py = rand() * TILE_HEIGHT;
    if (!isInsideDiamond(px, py, halfW, halfH)) continue;

    const shadowColor = adjustColor(baseColor, -20);
    const grad = ctx.createRadialGradient(px, py, 0, px, py, 5 + rand() * 4);
    grad.addColorStop(0, colorToRgba(shadowColor, 0.35));
    grad.addColorStop(1, colorToRgba(shadowColor, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, 9, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * WATER – wavy ripple lines with white specular highlights
 */
function drawWaterPattern(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  baseColor: number,
  rand: () => number
): void {
  const waveCount = 4;

  for (let i = 0; i < waveCount; i++) {
    const yBase = 4 + (TILE_HEIGHT - 8) * (i / (waveCount - 1));
    const amplitude = 1.5;
    const frequency = 0.38 + rand() * 0.12;
    const phase = rand() * Math.PI * 2;

    // Main wave line (lighter blue)
    const waveColor = adjustColor(baseColor, 35);
    ctx.strokeStyle = colorToRgba(waveColor, 0.55);
    ctx.lineWidth = 1;
    ctx.beginPath();
    let firstPoint = true;
    for (let step = 0; step <= 64; step++) {
      const x = (step / 64) * TILE_WIDTH;
      const y = yBase + Math.sin(x * frequency + phase) * amplitude;
      if (!isInsideDiamond(x, y, halfW, halfH)) {
        firstPoint = true;
        continue;
      }
      if (firstPoint) { ctx.moveTo(x, y); firstPoint = false; }
      else { ctx.lineTo(x, y); }
    }
    ctx.stroke();

    // Secondary shadow wave just below (slightly darker)
    const shadowWave = adjustColor(baseColor, -15);
    ctx.strokeStyle = colorToRgba(shadowWave, 0.25);
    ctx.beginPath();
    firstPoint = true;
    for (let step = 0; step <= 64; step++) {
      const x = (step / 64) * TILE_WIDTH;
      const y = yBase + 1.5 + Math.sin(x * frequency + phase) * amplitude;
      if (!isInsideDiamond(x, y, halfW, halfH)) {
        firstPoint = true;
        continue;
      }
      if (firstPoint) { ctx.moveTo(x, y); firstPoint = false; }
      else { ctx.lineTo(x, y); }
    }
    ctx.stroke();
  }

  // White specular highlight dots scattered (5-7 pixels)
  const specCount = Math.floor(rand() * 3) + 5;
  const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let i = 0; i < specCount; i++) {
    const px = rand() * TILE_WIDTH;
    const py = rand() * TILE_HEIGHT;
    if (!isInsideDiamond(px, py, halfW, halfH)) continue;
    setPixel(imageData, Math.floor(px), Math.floor(py), 255, 255, 255, 160);
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * ROUGH – dense dark grass tufts, dark patches, looks wild/unkept
 */
function drawRoughPattern(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  baseColor: number,
  rand: () => number
): void {
  // Dense dark patches first (background texture)
  const patchCount = Math.floor(rand() * 4) + 8;
  for (let i = 0; i < patchCount; i++) {
    const px = rand() * TILE_WIDTH;
    const py = rand() * TILE_HEIGHT;
    if (!isInsideDiamond(px, py, halfW, halfH)) continue;
    const patchColor = adjustColor(baseColor, -20 - Math.floor(rand() * 15));
    const grad = ctx.createRadialGradient(px, py, 0, px, py, 4 + rand() * 3);
    grad.addColorStop(0, colorToRgba(patchColor, 0.45));
    grad.addColorStop(1, colorToRgba(patchColor, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dense grass tufts: ~40 with 2-4 blades each, longer than GRASS
  for (let i = 0; i < 40; i++) {
    const px = rand() * TILE_WIDTH;
    const py = rand() * TILE_HEIGHT;
    if (!isInsideDiamond(px, py, halfW, halfH)) continue;

    // Always darker than base for a wild, dense look
    const tuftColor = adjustColor(baseColor, -15 - Math.floor(rand() * 18));
    ctx.strokeStyle = colorToRgba(tuftColor, 0.88);
    ctx.lineWidth = 1;

    const bladeCount = Math.floor(rand() * 3) + 2; // 2-4 blades
    for (let j = 0; j < bladeCount; j++) {
      const spreadX = (rand() - 0.5) * 5;
      const height = rand() * 3 + 3; // 3-6px – longer than grass
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + spreadX, py - height);
      ctx.stroke();
    }
  }

  // Extra random dark 1px dots sprinkled for grain
  const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const [br, bg, bb] = hexToRgb(adjustColor(baseColor, -25));
  for (let i = 0; i < 15; i++) {
    const px = Math.floor(rand() * TILE_WIDTH);
    const py = Math.floor(rand() * TILE_HEIGHT);
    if (!isInsideDiamond(px + 0.5, py + 0.5, halfW, halfH)) continue;
    setPixel(imageData, px, py, br, bg, bb, 200);
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * TEE – fairway mow stripes + white cross/circle center marker
 */
function drawTeePattern(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  baseColor: number,
  rand: () => number
): void {
  // Fairway-style mow stripes
  drawFairwayPattern(ctx, halfW, halfH, baseColor, rand);

  // White circular marker in the center
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(halfW, halfH, 3, 0, Math.PI * 2);
  ctx.fill();

  // White cross lines through the marker
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(halfW - 6, halfH);
  ctx.lineTo(halfW + 6, halfH);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(halfW, halfH - 5);
  ctx.lineTo(halfW, halfH + 5);
  ctx.stroke();

  // Thin dark outline around the marker for contrast
  ctx.strokeStyle = colorToRgba(adjustColor(baseColor, -30), 0.6);
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.arc(halfW, halfH, 3.5, 0, Math.PI * 2);
  ctx.stroke();
}

// ─── Main tile generation ────────────────────────────────────────────────────

function generateTile(tileType: number): Buffer {
  const canvas = createCanvas(TILE_WIDTH, TILE_HEIGHT);
  const ctx = canvas.getContext('2d');
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;

  ctx.clearRect(0, 0, TILE_WIDTH, TILE_HEIGHT);

  const props = TILE_PROPERTIES[tileType as keyof typeof TILE_PROPERTIES];
  const rand = seededRandom(tileType * 1337 + 42);

  // 1. Solid diamond base fill
  ctx.fillStyle = colorToRgba(props.color, 1);
  ctx.beginPath();
  ctx.moveTo(halfW, 0);
  ctx.lineTo(TILE_WIDTH, halfH);
  ctx.lineTo(halfW, TILE_HEIGHT);
  ctx.lineTo(0, halfH);
  ctx.closePath();
  ctx.fill();

  // 2. Pattern overlay
  switch (tileType) {
    case 0: drawGrassPattern(ctx, halfW, halfH, props.color, rand);   break;
    case 1: drawFairwayPattern(ctx, halfW, halfH, props.color, rand); break;
    case 2: drawGreenPattern(ctx, halfW, halfH, props.color, rand);   break;
    case 3: drawSandPattern(ctx, halfW, halfH, props.color, rand);    break;
    case 4: drawWaterPattern(ctx, halfW, halfH, props.color, rand);   break;
    case 5: drawRoughPattern(ctx, halfW, halfH, props.color, rand);   break;
    case 6: drawTeePattern(ctx, halfW, halfH, props.color, rand);     break;
  }

  // No grid outline – grid is handled in-game
  return canvas.toBuffer('image/png');
}

// ─── Sprite generation ───────────────────────────────────────────────────────

/**
 * ball.png (10x10) – white circle with gray outline, shadow bottom-right,
 * highlight top-left
 */
function generateBall(): Buffer {
  const W = 10;
  const H = 10;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, W, H);

  const cx = W / 2;
  const cy = H / 2;
  const radius = 4;

  // White fill
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Gray 1px outline
  ctx.strokeStyle = 'rgba(136,136,136,1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 0.5, 0, Math.PI * 2);
  ctx.stroke();

  // Subtle shadow on bottom-right (3 darker pixels via imageData)
  const imageData = ctx.getImageData(0, 0, W, H);
  const shadowPixels: [number, number][] = [[6, 7], [7, 6], [7, 7]];
  for (const [px, py] of shadowPixels) {
    setPixel(imageData, px, py, 180, 180, 180, 180);
  }

  // Small white highlight on top-left (1-2 pixels)
  setPixel(imageData, 3, 2, 255, 255, 255, 255);
  setPixel(imageData, 2, 3, 255, 255, 255, 200);

  ctx.putImageData(imageData, 0, 0);
  return canvas.toBuffer('image/png');
}

/**
 * player.png (12x16) – pixel-art golfer, front/isometric view
 */
function generatePlayer(): Buffer {
  const W = 12;
  const H = 16;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, W, H);

  const imageData = ctx.getImageData(0, 0, W, H);

  // Color palette
  const HAT_COLOR    = 0xffffff; // white hat/visor
  const SKIN_COLOR   = 0xffcc99; // head + arms
  const SHIRT_COLOR  = 0x2255aa; // blue shirt
  const PANTS_COLOR  = 0x443322; // brown pants
  const SHOE_COLOR   = 0x222222; // dark shoes
  const CLUB_COLOR   = 0x333333; // golf club
  const SHADOW_COLOR = 0xccaa88; // hat shadow / details

  function px(color: number, x: number, y: number, a = 255) {
    const [r, g, b] = hexToRgb(color);
    setPixel(imageData, x, y, r, g, b, a);
  }

  // Row 0-1: White hat/visor (6px wide, centered at x=3..8)
  for (let x = 3; x <= 8; x++) {
    px(HAT_COLOR, x, 0);
    px(HAT_COLOR, x, 1);
  }
  // Hat brim: slightly wider bottom row
  px(HAT_COLOR, 2, 1);
  px(HAT_COLOR, 9, 1);
  // Shadow under brim
  px(SHADOW_COLOR, 2, 2, 120);
  px(SHADOW_COLOR, 9, 2, 120);

  // Row 2-5: Skin-colored head (4px wide, centered at x=4..7)
  for (let y = 2; y <= 5; y++) {
    for (let x = 4; x <= 7; x++) {
      px(SKIN_COLOR, x, y);
    }
  }
  // Small ear pixels
  px(SKIN_COLOR, 3, 3);
  px(SKIN_COLOR, 8, 3);

  // Eyes (row 3, dark pixels)
  px(0x331100, 5, 3);
  px(0x331100, 7, 3);

  // Mouth (row 5, center)
  px(0xcc8855, 6, 5, 180);

  // Row 6-10: Blue shirt (6px wide, centered at x=3..8)
  for (let y = 6; y <= 10; y++) {
    for (let x = 3; x <= 8; x++) {
      px(SHIRT_COLOR, x, y);
    }
  }
  // Shirt shading on sides
  const shirtDark = adjustColor(SHIRT_COLOR, -20);
  for (let y = 6; y <= 10; y++) {
    px(shirtDark, 3, y);
    px(shirtDark, 8, y);
  }

  // Arms: skin-colored, 1px wide each side (row 6-9)
  for (let y = 6; y <= 9; y++) {
    px(SKIN_COLOR, 2, y); // left arm
  }
  // Right arm (rows 6-9, then extends with club)
  for (let y = 6; y <= 9; y++) {
    px(SKIN_COLOR, 9, y);
  }

  // Row 11-14: Brown pants (two legs, 3px each)
  // Left leg: x=3..5
  // Right leg: x=6..8 (gap at x=5.5 conceptually, shared col is fine)
  for (let y = 11; y <= 14; y++) {
    for (let x = 3; x <= 5; x++) px(PANTS_COLOR, x, y);
    for (let x = 6; x <= 8; x++) px(PANTS_COLOR, x, y);
  }
  // Leg shading
  const pantsDark = adjustColor(PANTS_COLOR, -15);
  for (let y = 11; y <= 14; y++) {
    px(pantsDark, 3, y);
    px(pantsDark, 8, y);
  }
  // Small gap between legs
  px(0x000000, 5, 13, 60);
  px(0x000000, 6, 13, 60);

  // Row 15: Shoes (2px per foot)
  px(SHOE_COLOR, 3, 15);
  px(SHOE_COLOR, 4, 15);
  px(SHOE_COLOR, 7, 15);
  px(SHOE_COLOR, 8, 15);

  // Golf club: 1px dark line from right arm extending down-right
  for (let i = 0; i <= 5; i++) {
    const cx = 10 + Math.floor(i * 0.4);
    const cy = 7 + i;
    if (cx < W && cy < H) px(CLUB_COLOR, cx, cy);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toBuffer('image/png');
}

/**
 * flag.png (16x24) – pole, triangular red flag, hole marker at base
 */
function generateFlag(): Buffer {
  const W = 16;
  const H = 24;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, W, H);

  const imageData = ctx.getImageData(0, 0, W, H);

  const POLE_COLOR       = 0x444444;
  const FLAG_RED         = 0xff0000;
  const FLAG_SHADOW      = 0xcc0000;
  const HOLE_MARKER      = 0x222222;

  function px(color: number, x: number, y: number, a = 255) {
    const [r, g, b] = hexToRgb(color);
    setPixel(imageData, x, y, r, g, b, a);
  }

  // Pole: 2px wide (x=2..3), full height
  for (let y = 0; y < H; y++) {
    px(POLE_COLOR, 2, y);
    px(POLE_COLOR, 3, y);
  }

  // Triangular red flag at top: 8 rows tall, widening from tip at row 0
  // At row r, flag width = round(10 * r / 7) pixels starting at x=4
  for (let r = 0; r < 8; r++) {
    const flagW = Math.round(10 * (r + 1) / 8);
    for (let x = 4; x < 4 + flagW; x++) {
      if (x < W) {
        // Bottom edge row gets shadow color
        if (r === 7) {
          px(FLAG_SHADOW, x, r);
        } else {
          px(FLAG_RED, x, r);
        }
      }
    }
  }

  // 1px darker red shadow on bottom edge of flag (row 7 already done above)
  // Extra shadow pixel at the diagonal edge
  for (let r = 0; r < 7; r++) {
    const flagW = Math.round(10 * (r + 1) / 8);
    const edgeX = 4 + flagW; // one pixel past the rightmost flag pixel
    if (edgeX < W) {
      px(FLAG_SHADOW, edgeX - 1, r, 80); // subtle diagonal shadow
    }
  }

  // Small dark circle at base (hole marker), rows 21-23
  const holeCx = 3;
  const holeCy = 22;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (Math.abs(dx) + Math.abs(dy) <= 1) {
        px(HOLE_MARKER, holeCx + dx, holeCy + dy);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toBuffer('image/png');
}

/**
 * tee_marker.png (12x12) – white T-shape with gray outline
 */
function generateTeeMarker(): Buffer {
  const W = 12;
  const H = 12;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, W, H);

  const imageData = ctx.getImageData(0, 0, W, H);

  const WHITE      = 0xffffff;
  const GRAY_DARK  = 0x888888;

  function px(color: number, x: number, y: number, a = 255) {
    const [r, g, b] = hexToRgb(color);
    setPixel(imageData, x, y, r, g, b, a);
  }

  // Horizontal bar: 8px wide (x=2..9), 2px tall (y=0..1), centered
  for (let y = 0; y <= 1; y++) {
    for (let x = 2; x <= 9; x++) {
      px(WHITE, x, y);
    }
  }

  // Vertical stem: 2px wide (x=5..6), 6px tall (y=2..7), centered below bar
  for (let y = 2; y <= 7; y++) {
    px(WHITE, 5, y);
    px(WHITE, 6, y);
  }

  // Gray outline around the T-shape
  // Top bar outline
  for (let x = 1; x <= 10; x++) {
    px(GRAY_DARK, x, H - 1, 0); // reset (transparent – we draw outline explicitly)
  }

  // Top edge of bar
  for (let x = 2; x <= 9; x++) px(GRAY_DARK, x, 0, 180);
  // Bottom edge of bar (y=2) where it meets the stem
  px(GRAY_DARK, 2, 2, 180);
  px(GRAY_DARK, 3, 2, 180);
  px(GRAY_DARK, 4, 2, 180);
  px(GRAY_DARK, 7, 2, 180);
  px(GRAY_DARK, 8, 2, 180);
  px(GRAY_DARK, 9, 2, 180);
  // Left side of bar
  for (let y = 0; y <= 1; y++) px(GRAY_DARK, 2, y, 180);
  // Right side of bar
  for (let y = 0; y <= 1; y++) px(GRAY_DARK, 9, y, 180);
  // Left side of stem
  for (let y = 2; y <= 7; y++) px(GRAY_DARK, 5, y, 100);
  // Right side of stem
  for (let y = 2; y <= 7; y++) px(GRAY_DARK, 6, y, 100);
  // Bottom of stem
  px(GRAY_DARK, 5, 7, 180);
  px(GRAY_DARK, 6, 7, 180);

  // Re-draw white on top to make sure the T body is clean (outline is subtle)
  for (let y = 0; y <= 1; y++) {
    for (let x = 2; x <= 9; x++) {
      px(WHITE, x, y);
    }
  }
  for (let y = 2; y <= 7; y++) {
    px(WHITE, 5, y);
    px(WHITE, 6, y);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toBuffer('image/png');
}

// ─── Main execution ──────────────────────────────────────────────────────────

function main(): void {
  const tilesDir   = path.join(process.cwd(), 'public', 'assets', 'sprites', 'tiles');
  const spritesDir = path.join(process.cwd(), 'public', 'assets', 'sprites');

  // Ensure directories exist
  if (!fs.existsSync(tilesDir)) {
    fs.mkdirSync(tilesDir, { recursive: true });
    console.log(`Created directory: ${tilesDir}`);
  }

  console.log('Generating tile textures...\n');

  // Generate 7 tile PNGs (no _clean variants)
  for (let tileType = 0; tileType < 7; tileType++) {
    const props = TILE_PROPERTIES[tileType as keyof typeof TILE_PROPERTIES];
    const buffer = generateTile(tileType);
    const outPath = path.join(tilesDir, `tile_${tileType}.png`);
    fs.writeFileSync(outPath, buffer);
    console.log(`  [OK] ${props.name}: tile_${tileType}.png`);
  }

  // Remove old _clean variants if they still exist
  for (let tileType = 0; tileType < 7; tileType++) {
    const cleanPath = path.join(tilesDir, `tile_${tileType}_clean.png`);
    if (fs.existsSync(cleanPath)) {
      fs.unlinkSync(cleanPath);
      console.log(`  [removed] tile_${tileType}_clean.png`);
    }
  }

  console.log('\nGenerating sprite assets...\n');

  const sprites: Array<{ name: string; buffer: Buffer }> = [
    { name: 'ball.png',        buffer: generateBall()      },
    { name: 'player.png',      buffer: generatePlayer()    },
    { name: 'flag.png',        buffer: generateFlag()      },
    { name: 'tee_marker.png',  buffer: generateTeeMarker() },
  ];

  for (const sprite of sprites) {
    const outPath = path.join(spritesDir, sprite.name);
    fs.writeFileSync(outPath, sprite.buffer);
    console.log(`  [OK] ${sprite.name}`);
  }

  console.log('\nAll assets generated successfully!');
  console.log(`  Tiles:   ${tilesDir}`);
  console.log(`  Sprites: ${spritesDir}`);
}

main();

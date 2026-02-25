import Phaser from 'phaser';
import { TILE_WIDTH, TILE_HEIGHT } from '../utils/Constants';

/**
 * Generates 16 alpha-mask CanvasTextures (blend_mask_0..15) for dual-grid
 * terrain blending.  Each mask is a 64×32 isometric diamond whose 4 quadrants
 * are filled or empty based on the 4-bit index.
 *
 * Bit layout (which quadrant is filled):
 *   bit 3 (8) = NW   bit 2 (4) = NE
 *   bit 1 (2) = SW   bit 0 (1) = SE
 *
 * Shape categories:
 *   empty (0), full (15)
 *   corner  (1,2,4,8)     – 1 quadrant, rounded boundary via quadratic bézier
 *   edge    (3,5,10,12)   – 2 adjacent quadrants, straight centre-line boundary
 *   diagonal(6,9)         – 2 opposite corners (S-curve)
 *   inner   (7,11,13,14)  – 3 quadrants, rounded cutout (inverse of corner)
 */
export function generateBlendMasks(scene: Phaser.Scene): void {
  // Diamond vertices & centre
  const N: Pt = [TILE_WIDTH / 2, 0];
  const E: Pt = [TILE_WIDTH, TILE_HEIGHT / 2];
  const S: Pt = [TILE_WIDTH / 2, TILE_HEIGHT];
  const W: Pt = [0, TILE_HEIGHT / 2];
  const C: Pt = [TILE_WIDTH / 2, TILE_HEIGHT / 2]; // bézier control point

  for (let index = 0; index < 16; index++) {
    const key = `blend_mask_${index}`;
    if (scene.textures.exists(key)) continue;

    const canvasTex = scene.textures.createCanvas(key, TILE_WIDTH, TILE_HEIGHT)!;
    const ctx = canvasTex.getContext();

    if (index === 0) { canvasTex.refresh(); continue; }

    // Clip to isometric diamond
    ctx.save();
    ctx.beginPath();
    moveTo(ctx, N); lineTo(ctx, E); lineTo(ctx, S); lineTo(ctx, W);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = 'white';

    switch (index) {
      // ---- full ----
      case 15: ctx.fillRect(0, 0, TILE_WIDTH, TILE_HEIGHT); break;

      // ---- corners (1 quadrant, rounded boundary) ----
      case 8:  corner(ctx, N, W, C); break;  // NW
      case 4:  corner(ctx, N, E, C); break;  // NE
      case 2:  corner(ctx, S, W, C); break;  // SW
      case 1:  corner(ctx, S, E, C); break;  // SE

      // ---- edges (2 adjacent quadrants, straight boundary) ----
      case 12: tri(ctx, N, E, W); break;     // NW+NE  (top half)
      case 3:  tri(ctx, E, S, W); break;     // SW+SE  (bottom half)
      case 10: tri(ctx, N, W, S); break;     // NW+SW  (left half)
      case 5:  tri(ctx, N, E, S); break;     // NE+SE  (right half)

      // ---- diagonals (2 opposite corners) ----
      case 9:  corner(ctx, N, W, C); corner(ctx, S, E, C); break; // NW+SE
      case 6:  corner(ctx, N, E, C); corner(ctx, S, W, C); break; // NE+SW

      // ---- inner corners (3 quadrants, 1 rounded cutout) ----
      case 7:  innerCorner(ctx, W, N, E, S, C); break; // ¬NW
      case 11: innerCorner(ctx, N, E, S, W, C); break; // ¬NE
      case 13: innerCorner(ctx, W, S, E, N, C); break; // ¬SW
      case 14: innerCorner(ctx, E, S, W, N, C); break; // ¬SE
    }

    ctx.restore();
    canvasTex.refresh();
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
type Pt = [number, number];

function moveTo(ctx: CanvasRenderingContext2D, p: Pt): void { ctx.moveTo(p[0], p[1]); }
function lineTo(ctx: CanvasRenderingContext2D, p: Pt): void { ctx.lineTo(p[0], p[1]); }

/** Single rounded corner: diamond-edge v1→v2, then bézier curve v2→v1 via C. */
function corner(ctx: CanvasRenderingContext2D, v1: Pt, v2: Pt, C: Pt): void {
  ctx.beginPath();
  moveTo(ctx, v1);
  lineTo(ctx, v2);
  ctx.quadraticCurveTo(C[0], C[1], v1[0], v1[1]);
  ctx.closePath();
  ctx.fill();
}

/** Straight-edged half-diamond (triangle). */
function tri(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, c: Pt): void {
  ctx.beginPath();
  moveTo(ctx, a); lineTo(ctx, b); lineTo(ctx, c);
  ctx.closePath();
  ctx.fill();
}

/** Three quadrants filled, one rounded cutout.
 *  curveA → curveB is the bézier boundary (same curve as the missing corner),
 *  then follow diamond edges v3 → v4 back to curveA. */
function innerCorner(
  ctx: CanvasRenderingContext2D,
  curveA: Pt, curveB: Pt, v3: Pt, v4: Pt, C: Pt,
): void {
  ctx.beginPath();
  moveTo(ctx, curveA);
  ctx.quadraticCurveTo(C[0], C[1], curveB[0], curveB[1]);
  lineTo(ctx, v3);
  lineTo(ctx, v4);
  ctx.closePath();
  ctx.fill();
}

import Phaser from 'phaser';
import { TILE_WIDTH, TILE_HEIGHT } from '../utils/Constants';

/**
 * Generates 16 alpha-mask CanvasTextures for dual-grid terrain blending.
 *
 * In isometric space, the 4 tiles around a vertex sit at N/E/S/W positions
 * (not NW/NE/SW/SE). The diamond is divided into 4 kite-shaped quadrants
 * by lines connecting opposite edge midpoints through the center.
 *
 * Bit layout:  bit 3(8)=N  bit 2(4)=E  bit 1(2)=W  bit 0(1)=S
 */
export function generateBlendMasks(scene: Phaser.Scene): void {
  // Diamond vertices
  const N:  P = [TILE_WIDTH / 2, 0];
  const E:  P = [TILE_WIDTH, TILE_HEIGHT / 2];
  const S:  P = [TILE_WIDTH / 2, TILE_HEIGHT];
  const W:  P = [0, TILE_HEIGHT / 2];
  const C:  P = [TILE_WIDTH / 2, TILE_HEIGHT / 2];

  // Edge midpoints (divide diamond into N/E/S/W kite quadrants)
  const NE: P = [(N[0] + E[0]) / 2, (N[1] + E[1]) / 2]; // (48, 8)
  const SE: P = [(E[0] + S[0]) / 2, (E[1] + S[1]) / 2]; // (48, 24)
  const SW: P = [(S[0] + W[0]) / 2, (S[1] + W[1]) / 2]; // (16, 24)
  const NW: P = [(W[0] + N[0]) / 2, (W[1] + N[1]) / 2]; // (16, 8)

  for (let index = 0; index < 16; index++) {
    const key = `blend_mask_${index}`;
    if (scene.textures.exists(key)) continue;

    const tex = scene.textures.createCanvas(key, TILE_WIDTH, TILE_HEIGHT)!;
    const ctx = tex.getContext();
    if (index === 0) { tex.refresh(); continue; }

    // Clip to diamond
    ctx.save();
    beginPoly(ctx, [N, E, S, W]);
    ctx.clip();
    ctx.fillStyle = 'white';

    switch (index) {
      case 15: ctx.fillRect(0, 0, TILE_WIDTH, TILE_HEIGHT); break;

      // --- Corners (single kite, curved boundary) ---
      case 8:  kite(ctx, N, NE, NW, C); break;
      case 4:  kite(ctx, E, SE, NE, C); break;
      case 1:  kite(ctx, S, SW, SE, C); break;
      case 2:  kite(ctx, W, NW, SW, C); break;

      // --- Edges (half diamond, straight diagonal boundary) ---
      case 12: quad(ctx, NW, N, E, SE); break;  // N+E
      case 3:  quad(ctx, NW, W, S, SE); break;  // W+S
      case 10: quad(ctx, NE, N, W, SW); break;  // N+W
      case 5:  quad(ctx, NE, E, S, SW); break;  // E+S

      // --- Diagonals (two opposite kites) ---
      case 9:  kite(ctx, N, NE, NW, C); kite(ctx, S, SW, SE, C); break;
      case 6:  kite(ctx, E, SE, NE, C); kite(ctx, W, NW, SW, C); break;

      // --- Inner corners (diamond minus one kite, curved cutout) ---
      case 7:  innerKite(ctx, NW, NE, [E, S, W], C); break;  // ¬N
      case 11: innerKite(ctx, NE, SE, [S, W, N], C); break;  // ¬E
      case 14: innerKite(ctx, SE, SW, [W, N, E], C); break;  // ¬S
      case 13: innerKite(ctx, SW, NW, [N, E, S], C); break;  // ¬W
    }

    ctx.restore();
    tex.refresh();
  }
}

type P = [number, number];

function beginPoly(ctx: CanvasRenderingContext2D, pts: P[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/** Single kite quadrant with curved inner boundary.
 *  vertex → mid1 (edge), mid1 → mid2 (curve via C), mid2 → vertex (edge) */
function kite(ctx: CanvasRenderingContext2D, vertex: P, mid1: P, mid2: P, C: P): void {
  ctx.beginPath();
  ctx.moveTo(vertex[0], vertex[1]);
  ctx.lineTo(mid1[0], mid1[1]);
  ctx.quadraticCurveTo(C[0], C[1], mid2[0], mid2[1]);
  ctx.closePath();
  ctx.fill();
}

/** Straight-edged quadrilateral (for edge masks). */
function quad(ctx: CanvasRenderingContext2D, a: P, b: P, c: P, d: P): void {
  beginPoly(ctx, [a, b, c, d]);
  ctx.fill();
}

/** Diamond minus one kite (inner corner with curved cutout).
 *  Curve from mid1→mid2 via C, then follow diamond vertices back. */
function innerKite(
  ctx: CanvasRenderingContext2D,
  mid1: P, mid2: P, verts: P[], C: P,
): void {
  ctx.beginPath();
  ctx.moveTo(mid1[0], mid1[1]);
  ctx.quadraticCurveTo(C[0], C[1], mid2[0], mid2[1]);
  for (const v of verts) ctx.lineTo(v[0], v[1]);
  ctx.closePath();
  ctx.fill();
}

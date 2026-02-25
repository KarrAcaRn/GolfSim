import Phaser from 'phaser';
import { TILE_WIDTH, TILE_HEIGHT } from '../utils/Constants';

/**
 * Generates 16 alpha-mask CanvasTextures (blend_mask_0..15) for dual-grid
 * terrain blending. Each mask is a 64x32 isometric diamond with quadrants
 * filled/empty based on the 4-bit index. Boundaries between filled and
 * empty quadrants use quarter-ellipse arcs for organic rounded transitions.
 *
 * Bit layout (which quadrant is filled):
 *   bit 3 (8) = NW   bit 2 (4) = NE
 *   bit 1 (2) = SW   bit 0 (1) = SE
 */
export function generateBlendMasks(scene: Phaser.Scene): void {
  const cx = TILE_WIDTH / 2;   // 32
  const cy = TILE_HEIGHT / 2;  // 16
  const rx = TILE_WIDTH / 4;   // 16  quarter-ellipse horizontal radius
  const ry = TILE_HEIGHT / 4;  //  8  quarter-ellipse vertical radius

  for (let index = 0; index < 16; index++) {
    const key = `blend_mask_${index}`;
    if (scene.textures.exists(key)) continue;

    const canvasTex = scene.textures.createCanvas(key, TILE_WIDTH, TILE_HEIGHT)!;
    const ctx = canvasTex.getContext();

    if (index === 0) {
      // fully transparent – nothing to draw
      canvasTex.refresh();
      continue;
    }

    const hasNW = (index & 8) !== 0;
    const hasNE = (index & 4) !== 0;
    const hasSW = (index & 2) !== 0;
    const hasSE = (index & 1) !== 0;

    // Clip to isometric diamond
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, 0);           // N
    ctx.lineTo(TILE_WIDTH, cy);  // E
    ctx.lineTo(cx, TILE_HEIGHT); // S
    ctx.lineTo(0, cy);           // W
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = 'white';

    // --- NW quadrant (triangle N – W – Center) ---
    if (hasNW) {
      ctx.beginPath();
      ctx.moveTo(cx, 0);   // N
      ctx.lineTo(0, cy);   // W

      // W → Center along horizontal axis
      if (hasSW) {
        ctx.lineTo(cx, cy);
      } else {
        // quarter-ellipse W(0,16)→Center(32,16) bulging UP
        ctx.ellipse(cx / 2, cy, rx, ry, 0, Math.PI, 0, true);
      }

      // Center → N along vertical axis
      if (hasNE) {
        ctx.lineTo(cx, 0);
      } else {
        // quarter-ellipse Center(32,16)→N(32,0) bulging LEFT
        ctx.ellipse(cx, cy / 2, rx, ry, 0, Math.PI / 2, -Math.PI / 2, true);
      }

      ctx.closePath();
      ctx.fill();
    }

    // --- NE quadrant (triangle N – E – Center) ---
    if (hasNE) {
      ctx.beginPath();
      ctx.moveTo(cx, 0);          // N
      ctx.lineTo(TILE_WIDTH, cy); // E

      // E → Center along horizontal axis
      if (hasSE) {
        ctx.lineTo(cx, cy);
      } else {
        // quarter-ellipse E(64,16)→Center(32,16) bulging UP
        ctx.ellipse(cx + rx, cy, rx, ry, 0, 0, Math.PI, true);
      }

      // Center → N along vertical axis
      if (hasNW) {
        ctx.lineTo(cx, 0);
      } else {
        // quarter-ellipse Center(32,16)→N(32,0) bulging RIGHT
        ctx.ellipse(cx, cy / 2, rx, ry, 0, Math.PI / 2, -Math.PI / 2, false);
      }

      ctx.closePath();
      ctx.fill();
    }

    // --- SW quadrant (triangle S – W – Center) ---
    if (hasSW) {
      ctx.beginPath();
      ctx.moveTo(cx, TILE_HEIGHT); // S
      ctx.lineTo(0, cy);           // W

      // W → Center along horizontal axis
      if (hasNW) {
        ctx.lineTo(cx, cy);
      } else {
        // quarter-ellipse W(0,16)→Center(32,16) bulging DOWN
        ctx.ellipse(cx / 2, cy, rx, ry, 0, Math.PI, 0, false);
      }

      // Center → S along vertical axis
      if (hasSE) {
        ctx.lineTo(cx, TILE_HEIGHT);
      } else {
        // quarter-ellipse Center(32,16)→S(32,32) bulging LEFT
        ctx.ellipse(cx, cy + ry, rx, ry, 0, -Math.PI / 2, Math.PI / 2, true);
      }

      ctx.closePath();
      ctx.fill();
    }

    // --- SE quadrant (triangle S – E – Center) ---
    if (hasSE) {
      ctx.beginPath();
      ctx.moveTo(cx, TILE_HEIGHT); // S
      ctx.lineTo(TILE_WIDTH, cy);  // E

      // E → Center along horizontal axis
      if (hasNE) {
        ctx.lineTo(cx, cy);
      } else {
        // quarter-ellipse E(64,16)→Center(32,16) bulging DOWN
        ctx.ellipse(cx + rx, cy, rx, ry, 0, 0, Math.PI, false);
      }

      // Center → S along vertical axis
      if (hasSW) {
        ctx.lineTo(cx, TILE_HEIGHT);
      } else {
        // quarter-ellipse Center(32,16)→S(32,32) bulging RIGHT
        ctx.ellipse(cx, cy + ry, rx, ry, 0, -Math.PI / 2, Math.PI / 2, false);
      }

      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
    canvasTex.refresh();
  }
}

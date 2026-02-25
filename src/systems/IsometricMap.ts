import Phaser from 'phaser';
import { TILE_WIDTH, TILE_HEIGHT, ELEVATION_STEP, MIN_ELEVATION, MAX_ELEVATION } from '../utils/Constants';
import { TileType, TILE_PROPERTIES, TILE_NAMES } from '../models/TileTypes';
import { CourseData } from '../models/CourseData';
import { tileToWorld } from '../utils/IsoUtils';

export class IsometricMap {
  private scene: Phaser.Scene;
  private width: number;
  private height: number;
  private tiles: TileType[][];
  private tileVariants: number[][];
  private container: Phaser.GameObjects.Container;
  private gridVisible: boolean = true;
  private cornerElevations: number[][];
  private terrainFillGraphics: Phaser.GameObjects.Graphics;
  private tileSprites: Phaser.GameObjects.Image[][];
  private slopeGraphics: Phaser.GameObjects.Graphics;
  private gridGraphics: Phaser.GameObjects.Graphics;
  private blendImage: Phaser.GameObjects.Image | null = null;
  private blendCanvasKey = '__blend_overlay__';
  private _terrainDirty = false;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.scene = scene;
    this.width = width;
    this.height = height;
    this.container = scene.add.container(0, 0);

    // Initialize tile data
    this.tiles = [];
    this.tileVariants = [];
    for (let y = 0; y < height; y++) {
      this.tiles[y] = new Array(width).fill(TileType.GRASS);
      this.tileVariants[y] = [];
      for (let x = 0; x < width; x++) {
        this.tileVariants[y][x] = Math.floor(Math.random() * 5);
      }
    }

    // Initialize corner elevations: (width+1) x (height+1) vertex grid
    this.cornerElevations = [];
    for (let j = 0; j <= height; j++) {
      this.cornerElevations[j] = new Array(width + 1).fill(0);
    }

    // Colored polygon fill behind sprites (fills gaps on slopes)
    this.terrainFillGraphics = scene.add.graphics();
    this.terrainFillGraphics.setDepth(-1);
    this.container.add(this.terrainFillGraphics);

    // Create tile sprites (positioned at elevation-aware centers)
    this.tileSprites = [];
    for (let y = 0; y < height; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < width; x++) {
        const sprite = scene.add.image(0, 0, `tile_${TILE_NAMES[this.tiles[y][x]]}_${this.tileVariants[y][x]}`);
        sprite.setOrigin(0.5, 0.5);
        sprite.setDepth(y + x * 0.01);
        this.container.add(sprite);
        this.tileSprites[y][x] = sprite;
      }
    }

    // Slope shading overlay (light/shadow on sloped tiles)
    this.slopeGraphics = scene.add.graphics();
    this.slopeGraphics.setDepth(this.width + this.height - 0.5);
    this.container.add(this.slopeGraphics);

    // Blend overlay (CanvasTexture image, created lazily in updateBlendOverlays)

    // Grid overlay graphics
    this.gridGraphics = scene.add.graphics();
    this.gridGraphics.setDepth(this.width + this.height + 1);
    this.container.add(this.gridGraphics);

    this.renderAllTiles();

    this.scene.events.on('update', this.flushIfDirty, this);
    this.scene.events.once('shutdown', () => {
      this.scene.events.off('update', this.flushIfDirty, this);
    });
  }

  // === Corner Elevation Methods ===

  getCornerElevation(cx: number, cy: number): number {
    if (cx < 0 || cx > this.width || cy < 0 || cy > this.height) return 0;
    return this.cornerElevations[cy][cx];
  }

  setCornerElevation(cx: number, cy: number, elevation: number): void {
    if (cx < 0 || cx > this.width || cy < 0 || cy > this.height) return;
    const clamped = Math.max(MIN_ELEVATION, Math.min(MAX_ELEVATION, elevation));
    this.cornerElevations[cy][cx] = clamped;
    this._terrainDirty = true;
  }

  /** Average elevation of a tile's 4 corners (convenience for physics/ball positioning) */
  getElevationAt(tileX: number, tileY: number): number {
    if (!this.isInBounds(tileX, tileY)) return 0;
    return (
      this.cornerElevations[tileY][tileX] +
      this.cornerElevations[tileY][tileX + 1] +
      this.cornerElevations[tileY + 1][tileX + 1] +
      this.cornerElevations[tileY + 1][tileX]
    ) / 4;
  }

  /** Slope computed directly from tile's corner elevations */
  getSlope(tileX: number, tileY: number): { slopeX: number; slopeY: number } {
    if (!this.isInBounds(tileX, tileY)) return { slopeX: 0, slopeY: 0 };

    const n = this.cornerElevations[tileY][tileX];         // N (top)
    const e = this.cornerElevations[tileY][tileX + 1];     // E (right)
    const s = this.cornerElevations[tileY + 1][tileX + 1]; // S (bottom)
    const w = this.cornerElevations[tileY + 1][tileX];     // W (left)

    // Tile-space gradient (positive = uphill)
    const gradX = ((e + s) - (n + w)) / 2;
    const gradY = ((w + s) - (n + e)) / 2;

    // Convert to world-space (iso 2:1: Y-axis is 2× compressed) and negate for downhill
    const worldSlopeX = -(gradX - gradY) * 0.5;
    const worldSlopeY = -(gradX + gradY);

    return { slopeX: worldSlopeX, slopeY: worldSlopeY };
  }

  // === Vertex World Position ===

  /** Get the screen position of a vertex (corner point) */
  private getVertexScreenPos(cx: number, cy: number): { x: number; y: number } {
    const worldPos = tileToWorld(cx, cy);
    const elev = this.getCornerElevation(cx, cy);
    return {
      x: worldPos.x + this.getOffsetX(),
      y: worldPos.y + this.getOffsetY() - TILE_HEIGHT / 2 - elev * ELEVATION_STEP,
    };
  }

  /** Get the 4 corner screen positions of a tile (N, E, S, W) */
  getTileCorners(x: number, y: number): { n: { x: number; y: number }; e: { x: number; y: number }; s: { x: number; y: number }; w: { x: number; y: number } } {
    return {
      n: this.getVertexScreenPos(x, y),
      e: this.getVertexScreenPos(x + 1, y),
      s: this.getVertexScreenPos(x + 1, y + 1),
      w: this.getVertexScreenPos(x, y + 1),
    };
  }

  // === Terrain Rendering (sprite-based with polygon fill + slope shading) ===

  private renderTerrain(): void {
    this.terrainFillGraphics.clear();
    this.slopeGraphics.clear();

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const sprite = this.tileSprites[y][x];
        const tileType = this.tiles[y][x];
        sprite.setTexture(`tile_${TILE_NAMES[tileType]}_${this.tileVariants[y][x]}`);

        const corners = this.getTileCorners(x, y);
        // Position sprite at average of 4 elevation-aware corner positions
        const cx = (corners.n.x + corners.e.x + corners.s.x + corners.w.x) / 4;
        const cy = (corners.n.y + corners.e.y + corners.s.y + corners.w.y) / 4;
        sprite.setPosition(cx, cy);
        sprite.setDepth(y + x * 0.01);

        // Draw colored polygon fill behind sprite (fills gaps on slopes)
        const color = TILE_PROPERTIES[tileType].color;
        this.terrainFillGraphics.fillStyle(color, 1);
        this.terrainFillGraphics.beginPath();
        this.terrainFillGraphics.moveTo(corners.n.x, corners.n.y);
        this.terrainFillGraphics.lineTo(corners.e.x, corners.e.y);
        this.terrainFillGraphics.lineTo(corners.s.x, corners.s.y);
        this.terrainFillGraphics.lineTo(corners.w.x, corners.w.y);
        this.terrainFillGraphics.closePath();
        this.terrainFillGraphics.fillPath();

        // Slope shading: light from top-left, darken low side
        this.renderSlopeShading(x, y, corners);
      }
    }
    this.renderGrid();
  }

  /** Draw semi-transparent shading on sloped tiles for 3D depth effect.
   *  Light source is top-left. Higher corners get a white highlight,
   *  lower corners get a dark shadow. Each tile is split into 2 triangles. */
  private renderSlopeShading(
    x: number, y: number,
    corners: { n: { x: number; y: number }; e: { x: number; y: number }; s: { x: number; y: number }; w: { x: number; y: number } },
  ): void {
    const n = this.cornerElevations[y][x];
    const e = this.cornerElevations[y][x + 1];
    const s = this.cornerElevations[y + 1][x + 1];
    const w = this.cornerElevations[y + 1][x];
    const avg = (n + e + s + w) / 4;

    // Skip flat tiles
    if (n === e && e === s && s === w) return;

    // For each corner, compute how much above/below average it is
    // Light comes from top-left (N and W corners are "facing the light")
    // N corner = top of diamond, W = left → these face the light source
    // S corner = bottom, E = right → these face away
    const maxElev = MAX_ELEVATION - MIN_ELEVATION; // total range
    const intensity = 0.15; // max shading alpha

    // Compute per-corner light factor: positive = lit, negative = shadowed
    // Light direction favors N (top) and W (left) corners
    const nLight = (n - avg) / maxElev;
    const eLight = (e - avg) / maxElev;
    const sLight = (s - avg) / maxElev;
    const wLight = (w - avg) / maxElev;

    // Draw two triangles per tile with appropriate shading
    // Triangle 1: N-E-S (right half)
    const triLight1 = (nLight + eLight + sLight) / 3;
    if (Math.abs(triLight1) > 0.01) {
      const isLit = triLight1 > 0;
      const alpha = Math.min(Math.abs(triLight1) * intensity * 3, intensity);
      this.slopeGraphics.fillStyle(isLit ? 0xffffff : 0x000000, alpha);
      this.slopeGraphics.fillTriangle(
        corners.n.x, corners.n.y,
        corners.e.x, corners.e.y,
        corners.s.x, corners.s.y,
      );
    }

    // Triangle 2: N-S-W (left half)
    const triLight2 = (nLight + sLight + wLight) / 3;
    if (Math.abs(triLight2) > 0.01) {
      const isLit = triLight2 > 0;
      const alpha = Math.min(Math.abs(triLight2) * intensity * 3, intensity);
      this.slopeGraphics.fillStyle(isLit ? 0xffffff : 0x000000, alpha);
      this.slopeGraphics.fillTriangle(
        corners.n.x, corners.n.y,
        corners.s.x, corners.s.y,
        corners.w.x, corners.w.y,
      );
    }
  }

  private renderGrid(): void {
    this.gridGraphics.clear();
    if (!this.gridVisible) return;

    this.gridGraphics.lineStyle(1, 0x000000, 0.3);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const corners = this.getTileCorners(x, y);

        this.gridGraphics.beginPath();
        this.gridGraphics.moveTo(corners.n.x, corners.n.y);
        this.gridGraphics.lineTo(corners.e.x, corners.e.y);
        this.gridGraphics.lineTo(corners.s.x, corners.s.y);
        this.gridGraphics.lineTo(corners.w.x, corners.w.y);
        this.gridGraphics.closePath();
        this.gridGraphics.strokePath();
      }
    }
  }

  private flushIfDirty(): void {
    if (!this._terrainDirty) return;
    this.renderTerrain();
    this.updateBlendOverlays();
    this._terrainDirty = false;
  }

  private renderAllTiles(): void {
    this.renderTerrain();
    this.updateBlendOverlays();
  }

  setTileAt(tileX: number, tileY: number, type: TileType): void {
    if (!this.isInBounds(tileX, tileY)) return;
    if (this.tiles[tileY][tileX] === type) return;
    this.tiles[tileY][tileX] = type;
    this.tileVariants[tileY][tileX] = Math.floor(Math.random() * 5);
    this._terrainDirty = true;
  }

  getTileAt(tileX: number, tileY: number): TileType {
    if (!this.isInBounds(tileX, tileY)) return TileType.GRASS;
    return this.tiles[tileY][tileX];
  }

  isInBounds(tileX: number, tileY: number): boolean {
    return tileX >= 0 && tileX < this.width && tileY >= 0 && tileY < this.height;
  }

  isCornerInBounds(cx: number, cy: number): boolean {
    return cx >= 0 && cx <= this.width && cy >= 0 && cy <= this.height;
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  getTiles(): TileType[][] {
    return this.tiles;
  }

  getOffsetX(): number {
    return (this.height * TILE_WIDTH) / 2;
  }

  getOffsetY(): number {
    return 50;
  }

  /** Convert world coordinates to tile coordinates, accounting for map offset */
  worldToTile(worldX: number, worldY: number): { tileX: number; tileY: number } {
    const adjustedX = worldX - this.getOffsetX();
    const adjustedY = worldY - this.getOffsetY();

    const tileX = Math.floor(adjustedY / TILE_HEIGHT + adjustedX / TILE_WIDTH);
    const tileY = Math.floor(adjustedY / TILE_HEIGHT - adjustedX / TILE_WIDTH);

    return { tileX, tileY };
  }

  /** Convert tile coordinates to world coordinates, accounting for map offset */
  tileToWorld(tileX: number, tileY: number): { x: number; y: number } {
    const pos = tileToWorld(tileX, tileY);
    return {
      x: pos.x + this.getOffsetX(),
      y: pos.y + this.getOffsetY(),
    };
  }

  /** Find the nearest vertex (corner point) to a world position */
  worldToNearestVertex(worldX: number, worldY: number): { cx: number; cy: number } {
    // Get approximate tile position
    const { tileX, tileY } = this.worldToTile(worldX, worldY);

    // Check all vertices around this tile (and neighboring tiles)
    let bestCx = 0;
    let bestCy = 0;
    let bestDist = Infinity;

    for (let cy = Math.max(0, tileY); cy <= Math.min(this.height, tileY + 2); cy++) {
      for (let cx = Math.max(0, tileX); cx <= Math.min(this.width, tileX + 2); cx++) {
        const pos = this.getVertexScreenPos(cx, cy);
        const dx = worldX - pos.x;
        const dy = worldY - pos.y;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestCx = cx;
          bestCy = cy;
        }
      }
    }

    return { cx: bestCx, cy: bestCy };
  }

  setGridVisible(visible: boolean): void {
    if (this.gridVisible === visible) return;
    this.gridVisible = visible;
    this._terrainDirty = true;
  }

  /** Smooth per-edge terrain blending using linear color gradients.
   *  For each tile edge where terrain changes, a gradient fades the
   *  neighbor's terrain color from the shared edge toward the tile center.
   *  This produces naturally soft, organic-looking transitions. */
  updateBlendOverlays(): void {
    const bounds = this.getWorldBounds();
    const cw = Math.ceil(bounds.width);
    const ch = Math.ceil(bounds.height);
    const ox = bounds.x;
    const oy = bounds.y;

    // Create or resize CanvasTexture
    if (this.scene.textures.exists(this.blendCanvasKey)) {
      const existing = this.scene.textures.get(this.blendCanvasKey);
      const src = existing.getSourceImage() as HTMLCanvasElement;
      if (src.width !== cw || src.height !== ch) {
        if (this.blendImage) {
          this.container.remove(this.blendImage);
          this.blendImage.destroy();
          this.blendImage = null;
        }
        this.scene.textures.remove(this.blendCanvasKey);
      }
    }

    let canvasTex: Phaser.Textures.CanvasTexture;
    if (!this.scene.textures.exists(this.blendCanvasKey)) {
      canvasTex = this.scene.textures.createCanvas(this.blendCanvasKey, cw, ch)!;
    } else {
      canvasTex = this.scene.textures.get(this.blendCanvasKey) as Phaser.Textures.CanvasTexture;
    }

    const ctx = canvasTex.getContext();
    ctx.clearRect(0, 0, cw, ch);

    const EDGE_ALPHA = 0.5;   // opacity at the shared edge
    const BLEND_DEPTH = 0.65; // how far inward the blend reaches (fraction to center)
    const EDGE_EXT = 0.35;    // extend clip past edge corners to overlap neighbors

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const type = this.tiles[y][x];
        const corners = this.getTileCorners(x, y);
        const cx = (corners.n.x + corners.e.x + corners.s.x + corners.w.x) / 4;
        const cy = (corners.n.y + corners.e.y + corners.s.y + corners.w.y) / 4;

        const edges = [
          { nx: x, ny: y - 1, ec1: corners.n, ec2: corners.e },
          { nx: x + 1, ny: y, ec1: corners.e, ec2: corners.s },
          { nx: x, ny: y + 1, ec1: corners.s, ec2: corners.w },
          { nx: x - 1, ny: y, ec1: corners.w, ec2: corners.n },
        ];

        for (const edge of edges) {
          if (!this.isInBounds(edge.nx, edge.ny)) continue;
          const nType = this.tiles[edge.ny][edge.nx];
          if (nType === type) continue;

          const color = TILE_PROPERTIES[nType].color;
          const r = (color >> 16) & 0xff;
          const g = (color >> 8) & 0xff;
          const b = color & 0xff;

          // Edge direction vector
          const edx = edge.ec2.x - edge.ec1.x;
          const edy = edge.ec2.y - edge.ec1.y;

          // Wide trapezoid clip: extend edge corners outward along edge direction,
          // inner edge pushed toward tile center. This prevents triangular taper.
          const p1x = edge.ec1.x - edx * EDGE_EXT - ox;
          const p1y = edge.ec1.y - edy * EDGE_EXT - oy;
          const p2x = edge.ec2.x + edx * EDGE_EXT - ox;
          const p2y = edge.ec2.y + edy * EDGE_EXT - oy;
          const p3x = edge.ec2.x + (cx - edge.ec2.x) * BLEND_DEPTH + edx * EDGE_EXT - ox;
          const p3y = edge.ec2.y + (cy - edge.ec2.y) * BLEND_DEPTH + edy * EDGE_EXT - oy;
          const p4x = edge.ec1.x + (cx - edge.ec1.x) * BLEND_DEPTH - edx * EDGE_EXT - ox;
          const p4y = edge.ec1.y + (cy - edge.ec1.y) * BLEND_DEPTH - edy * EDGE_EXT - oy;

          // Gradient: perpendicular to edge, from edge toward center
          const emx = (edge.ec1.x + edge.ec2.x) / 2;
          const emy = (edge.ec1.y + edge.ec2.y) / 2;
          const grad = ctx.createLinearGradient(
            emx - ox, emy - oy,
            emx + (cx - emx) * (1 / BLEND_DEPTH) - ox,
            emy + (cy - emy) * (1 / BLEND_DEPTH) - oy,
          );
          grad.addColorStop(0, `rgba(${r},${g},${b},${EDGE_ALPHA})`);
          grad.addColorStop(BLEND_DEPTH, `rgba(${r},${g},${b},0)`);
          grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(p1x, p1y);
          ctx.lineTo(p2x, p2y);
          ctx.lineTo(p3x, p3y);
          ctx.lineTo(p4x, p4y);
          ctx.closePath();
          ctx.clip();
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, cw, ch);
          ctx.restore();
        }
      }
    }

    canvasTex.refresh();

    if (!this.blendImage) {
      this.blendImage = this.scene.add.image(ox, oy, this.blendCanvasKey);
      this.blendImage.setOrigin(0, 0);
      this.blendImage.setDepth(this.width + this.height);
      this.container.add(this.blendImage);
    } else {
      this.blendImage.setPosition(ox, oy);
      this.blendImage.setTexture(this.blendCanvasKey);
    }
  }

  loadFromData(data: CourseData): void {
    for (let y = 0; y < Math.min(data.height, this.height); y++) {
      for (let x = 0; x < Math.min(data.width, this.width); x++) {
        this.tiles[y][x] = data.tiles[y][x];
        this.tileVariants[y][x] = Math.floor(Math.random() * 5);
      }
    }

    if (data.cornerElevations) {
      // New format: load corner elevations directly
      for (let j = 0; j <= Math.min(data.height, this.height); j++) {
        for (let i = 0; i <= Math.min(data.width, this.width); i++) {
          this.cornerElevations[j][i] = data.cornerElevations[j]?.[i] ?? 0;
        }
      }
    } else if (data.elevations) {
      // Legacy migration: convert tile-centered elevations to corner elevations
      this.migrateFromTileElevations(data.elevations, data.width, data.height);
    }

    this.renderTerrain();
    this.updateBlendOverlays();
  }

  /** Convert old tile-centered elevations to corner-based elevations */
  private migrateFromTileElevations(elevations: number[][], dataWidth: number, dataHeight: number): void {
    for (let j = 0; j <= this.height; j++) {
      for (let i = 0; i <= this.width; i++) {
        // Average of up to 4 adjacent tiles
        let sum = 0;
        let count = 0;
        const adjacentTiles = [
          { x: i, y: j },
          { x: i - 1, y: j },
          { x: i, y: j - 1 },
          { x: i - 1, y: j - 1 },
        ];
        for (const tile of adjacentTiles) {
          if (tile.x >= 0 && tile.x < dataWidth && tile.y >= 0 && tile.y < dataHeight) {
            sum += elevations[tile.y]?.[tile.x] ?? 0;
            count++;
          }
        }
        this.cornerElevations[j][i] = count > 0 ? sum / count : 0;
      }
    }
  }

  exportData(): { width: number; height: number; tiles: TileType[][]; cornerElevations: number[][] } {
    const tiles = this.tiles.map(row => [...row]);
    const cornerElevations = this.cornerElevations.map(row => [...row]);
    return { width: this.width, height: this.height, tiles, cornerElevations };
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /** Get the world bounds of the entire map for camera clamping */
  getWorldBounds(): { x: number; y: number; width: number; height: number } {
    const topLeft = this.tileToWorld(0, 0);
    const topRight = this.tileToWorld(this.width - 1, 0);
    const bottomLeft = this.tileToWorld(0, this.height - 1);
    const bottomRight = this.tileToWorld(this.width - 1, this.height - 1);

    const minX = Math.min(topLeft.x, bottomLeft.x) - TILE_WIDTH;
    const maxX = Math.max(topRight.x, bottomRight.x) + TILE_WIDTH;
    const minY = Math.min(topLeft.y, topRight.y) - TILE_HEIGHT - MAX_ELEVATION * ELEVATION_STEP;
    const maxY = Math.max(bottomLeft.y, bottomRight.y) + TILE_HEIGHT;

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
}

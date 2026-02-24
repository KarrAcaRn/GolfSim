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

  /** Dual-grid terrain transitions: draw a mesh diamond at each internal vertex
   *  where different terrain types meet. The diamond tips are at the actual
   *  tile centers (elevation-aware), subdivided into 4 quadrants colored by
   *  the surrounding tiles. */
  updateBlendOverlays(): void {
    // Compute world bounds for canvas sizing
    const bounds = this.getWorldBounds();
    const cw = Math.ceil(bounds.width);
    const ch = Math.ceil(bounds.height);
    const originX = bounds.x;
    const originY = bounds.y;

    // Create or resize CanvasTexture
    if (this.scene.textures.exists(this.blendCanvasKey)) {
      const existing = this.scene.textures.get(this.blendCanvasKey);
      const src = existing.getSourceImage() as HTMLCanvasElement;
      if (src.width !== cw || src.height !== ch) {
        // Size changed — destroy and recreate
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

    // Precompute all vertex screen positions (elevation-aware)
    const vPos: { x: number; y: number }[][] = [];
    for (let j = 0; j <= this.height; j++) {
      vPos[j] = [];
      for (let i = 0; i <= this.width; i++) {
        vPos[j][i] = this.getVertexScreenPos(i, j);
      }
    }

    // Helper: tile center = average of its 4 corner screen positions
    const tileCtr = (tx: number, ty: number): { x: number; y: number } => {
      const a = vPos[ty][tx];
      const b = vPos[ty][tx + 1];
      const c = vPos[ty + 1][tx + 1];
      const d = vPos[ty + 1][tx];
      return {
        x: (a.x + b.x + c.x + d.x) / 4,
        y: (a.y + b.y + c.y + d.y) / 4,
      };
    };

    const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    });

    // Iterate internal vertices (where 4 tiles share a corner)
    for (let j = 1; j < this.height; j++) {
      for (let i = 1; i < this.width; i++) {
        // 4 surrounding tiles
        const tN = this.tiles[j - 1][i - 1];
        const tE = this.tiles[j - 1][i];
        const tS = this.tiles[j][i];
        const tW = this.tiles[j][i - 1];

        // Skip if all same terrain — base tiles already cover this
        if (tN === tE && tE === tS && tS === tW) continue;

        // Center = actual vertex screen position (with elevation)
        const c = vPos[j][i];

        // Diamond tips = tile centers (elevation-aware)
        const tcN = tileCtr(i - 1, j - 1);
        const tcE = tileCtr(i, j - 1);
        const tcS = tileCtr(i, j);
        const tcW = tileCtr(i - 1, j);

        // Edge midpoints between center vertex and its 4 neighbors
        const mNE = mid(c, vPos[j - 1][i]);   // edge shared by tN & tE
        const mSE = mid(c, vPos[j][i + 1]);   // edge shared by tE & tS
        const mSW = mid(c, vPos[j + 1][i]);   // edge shared by tS & tW
        const mNW = mid(c, vPos[j][i - 1]);   // edge shared by tW & tN

        // 4 quadrants (clockwise winding)
        this.fillQuadWithPattern(ctx, originX, originY, mNW, tcN, mNE, c, tN, i - 1, j - 1);
        this.fillQuadWithPattern(ctx, originX, originY, mNE, tcE, mSE, c, tE, i, j - 1);
        this.fillQuadWithPattern(ctx, originX, originY, mSE, tcS, mSW, c, tS, i, j);
        this.fillQuadWithPattern(ctx, originX, originY, mSW, tcW, mNW, c, tW, i - 1, j);
      }
    }

    canvasTex.refresh();

    // Create or update the Image game object
    if (!this.blendImage) {
      this.blendImage = this.scene.add.image(originX, originY, this.blendCanvasKey);
      this.blendImage.setOrigin(0, 0);
      this.blendImage.setDepth(this.width + this.height);
      this.container.add(this.blendImage);
    } else {
      this.blendImage.setPosition(originX, originY);
      this.blendImage.setTexture(this.blendCanvasKey);
    }
  }

  private fillQuadWithPattern(
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number },
    d: { x: number; y: number },
    terrainType: TileType,
    tileX: number,
    tileY: number,
  ): void {
    // Build pattern from tile texture (variant 0)
    const texKey = `tile_${TILE_NAMES[terrainType]}_0`;
    if (!this.scene.textures.exists(texKey)) return;
    const img = this.scene.textures.get(texKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const pat = ctx.createPattern(img, 'repeat');
    if (!pat) return;

    // Compute pattern offset so it aligns with the tile grid
    const tileWorld = this.tileToWorld(tileX, tileY);
    const offsetX = (tileWorld.x - TILE_WIDTH / 2) - originX;
    const offsetY = (tileWorld.y - TILE_HEIGHT / 2) - originY;
    pat.setTransform(new DOMMatrix().translateSelf(offsetX, offsetY));

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(a.x - originX, a.y - originY);
    ctx.lineTo(b.x - originX, b.y - originY);
    ctx.lineTo(c.x - originX, c.y - originY);
    ctx.lineTo(d.x - originX, d.y - originY);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = pat;
    ctx.fill();
    ctx.restore();
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

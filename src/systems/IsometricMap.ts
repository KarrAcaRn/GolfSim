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

  /** Dual-grid terrain blending using pre-generated alpha masks.
   *  For each internal vertex (where 4 tiles meet), computes a 4-bit index
   *  per terrain type and composites the corresponding mask with the terrain
   *  texture onto the blend canvas. */
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

    // Cache tile source images per terrain type
    const imageCache = new Map<TileType, HTMLImageElement | HTMLCanvasElement | null>();
    const getImage = (type: TileType): HTMLImageElement | HTMLCanvasElement | null => {
      if (imageCache.has(type)) return imageCache.get(type)!;
      const texKey = `tile_${TILE_NAMES[type]}_0`;
      if (!this.scene.textures.exists(texKey)) { imageCache.set(type, null); return null; }
      const img = this.scene.textures.get(texKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      imageCache.set(type, img);
      return img;
    };

    // Helper: world → canvas coords
    const toC = (pos: { x: number; y: number }) => ({ x: pos.x - ox, y: pos.y - oy });
    const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
      x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
    });

    // Elevation-aware tile center (average of 4 corner positions)
    const getTileCenter = (tx: number, ty: number) => {
      const n = this.getVertexScreenPos(tx, ty);
      const e = this.getVertexScreenPos(tx + 1, ty);
      const s = this.getVertexScreenPos(tx + 1, ty + 1);
      const w = this.getVertexScreenPos(tx, ty + 1);
      return { x: (n.x + e.x + s.x + w.x) / 4, y: (n.y + e.y + s.y + w.y) / 4 };
    };

    // Draw a kite sub-path (vertex → mid1, curve via center to mid2, close)
    const kitePath = (
      vertex: { x: number; y: number }, mid1: { x: number; y: number },
      mid2: { x: number; y: number }, center: { x: number; y: number },
    ) => {
      ctx.moveTo(vertex.x, vertex.y);
      ctx.lineTo(mid1.x, mid1.y);
      ctx.quadraticCurveTo(center.x, center.y, mid2.x, mid2.y);
      ctx.closePath();
    };

    // Safe tile access: out-of-bounds tiles default to GRASS (map border)
    const tileAt = (tx: number, ty: number): TileType =>
      this.isInBounds(tx, ty) ? this.tiles[ty][tx] : TileType.GRASS;

    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;

    // Iterate over ALL vertices (including map border)
    for (let j = 0; j <= this.height; j++) {
      for (let i = 0; i <= this.width; i++) {
        const tN = tileAt(i - 1, j - 1); // N (above in screen)
        const tE = tileAt(i, j - 1);     // E (right in screen)
        const tW = tileAt(i - 1, j);     // W (left in screen)
        const tS = tileAt(i, j);         // S (below in screen)

        if (tN === tE && tE === tW && tW === tS) continue;

        // Elevation-aware positions in canvas coords
        const vC = toC(this.getVertexScreenPos(i, j));
        const nC = toC(getTileCenter(i - 1, j - 1));
        const eC = toC(getTileCenter(i, j - 1));
        const wC = toC(getTileCenter(i - 1, j));
        const sC = toC(getTileCenter(i, j));

        // Edge midpoints (between tile centers)
        const ne = mid(nC, eC);
        const se = mid(eC, sC);
        const sw = mid(sC, wC);
        const nw = mid(nC, wC);

        const types = new Set<TileType>();
        types.add(tN); types.add(tE); types.add(tW); types.add(tS);

        for (const type of types) {
          let bits = 0;
          if (tN === type) bits |= 8;
          if (tE === type) bits |= 4;
          if (tW === type) bits |= 2;
          if (tS === type) bits |= 1;
          if (bits === 0 || bits === 15) continue;

          const img = getImage(type);
          if (!img) continue;

          // Build elevation-aware clip path for this mask shape
          ctx.save();
          ctx.beginPath();

          switch (bits) {
            // Single kite (corner)
            case 8:  kitePath(nC, ne, nw, vC); break;
            case 4:  kitePath(eC, se, ne, vC); break;
            case 1:  kitePath(sC, sw, se, vC); break;
            case 2:  kitePath(wC, nw, sw, vC); break;
            // Half diamond (edge — straight diagonal boundary)
            case 12: ctx.moveTo(nw.x, nw.y); ctx.lineTo(nC.x, nC.y); ctx.lineTo(eC.x, eC.y); ctx.lineTo(se.x, se.y); ctx.closePath(); break;
            case 3:  ctx.moveTo(nw.x, nw.y); ctx.lineTo(wC.x, wC.y); ctx.lineTo(sC.x, sC.y); ctx.lineTo(se.x, se.y); ctx.closePath(); break;
            case 10: ctx.moveTo(ne.x, ne.y); ctx.lineTo(nC.x, nC.y); ctx.lineTo(wC.x, wC.y); ctx.lineTo(sw.x, sw.y); ctx.closePath(); break;
            case 5:  ctx.moveTo(ne.x, ne.y); ctx.lineTo(eC.x, eC.y); ctx.lineTo(sC.x, sC.y); ctx.lineTo(sw.x, sw.y); ctx.closePath(); break;
            // Diagonal (two opposite kites)
            case 9:  kitePath(nC, ne, nw, vC); kitePath(sC, sw, se, vC); break;
            case 6:  kitePath(eC, se, ne, vC); kitePath(wC, nw, sw, vC); break;
            // Inner corner (diamond minus one kite)
            case 7:  ctx.moveTo(nw.x, nw.y); ctx.quadraticCurveTo(vC.x, vC.y, ne.x, ne.y); ctx.lineTo(eC.x, eC.y); ctx.lineTo(sC.x, sC.y); ctx.lineTo(wC.x, wC.y); ctx.closePath(); break;
            case 11: ctx.moveTo(ne.x, ne.y); ctx.quadraticCurveTo(vC.x, vC.y, se.x, se.y); ctx.lineTo(sC.x, sC.y); ctx.lineTo(wC.x, wC.y); ctx.lineTo(nC.x, nC.y); ctx.closePath(); break;
            case 14: ctx.moveTo(se.x, se.y); ctx.quadraticCurveTo(vC.x, vC.y, sw.x, sw.y); ctx.lineTo(wC.x, wC.y); ctx.lineTo(nC.x, nC.y); ctx.lineTo(eC.x, eC.y); ctx.closePath(); break;
            case 13: ctx.moveTo(sw.x, sw.y); ctx.quadraticCurveTo(vC.x, vC.y, nw.x, nw.y); ctx.lineTo(nC.x, nC.y); ctx.lineTo(eC.x, eC.y); ctx.lineTo(sC.x, sC.y); ctx.closePath(); break;
          }

          ctx.clip();

          // Draw tile texture at all 4 surrounding tile positions (covers warped area)
          ctx.drawImage(img, nC.x - hw, nC.y - hh);
          ctx.drawImage(img, eC.x - hw, eC.y - hh);
          ctx.drawImage(img, wC.x - hw, wC.y - hh);
          ctx.drawImage(img, sC.x - hw, sC.y - hh);

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

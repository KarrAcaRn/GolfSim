import Phaser from 'phaser';
import { TILE_WIDTH, TILE_HEIGHT, ELEVATION_STEP, MIN_ELEVATION, MAX_ELEVATION } from '../utils/Constants';
import { TileType, TILE_PROPERTIES } from '../models/TileTypes';
import { CourseData } from '../models/CourseData';
import { tileToWorld } from '../utils/IsoUtils';

export class IsometricMap {
  private scene: Phaser.Scene;
  private width: number;
  private height: number;
  private tiles: TileType[][];
  private container: Phaser.GameObjects.Container;
  private gridVisible: boolean = true;
  private cornerElevations: number[][];
  private terrainGraphics: Phaser.GameObjects.Graphics;
  private gridGraphics: Phaser.GameObjects.Graphics;
  private blendGraphics: Phaser.GameObjects.Graphics;
  private _terrainDirty = false;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.scene = scene;
    this.width = width;
    this.height = height;
    this.container = scene.add.container(0, 0);

    // Initialize tile data
    this.tiles = [];
    for (let y = 0; y < height; y++) {
      this.tiles[y] = new Array(width).fill(TileType.GRASS);
    }

    // Initialize corner elevations: (width+1) x (height+1) vertex grid
    this.cornerElevations = [];
    for (let j = 0; j <= height; j++) {
      this.cornerElevations[j] = new Array(width + 1).fill(0);
    }

    // Terrain fill graphics (polygon-based rendering)
    this.terrainGraphics = scene.add.graphics();
    this.terrainGraphics.setDepth(0);
    this.container.add(this.terrainGraphics);

    // Blend overlay graphics
    this.blendGraphics = scene.add.graphics();
    this.blendGraphics.setDepth(1);
    this.container.add(this.blendGraphics);

    // Grid overlay graphics
    this.gridGraphics = scene.add.graphics();
    this.gridGraphics.setDepth(2);
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

    // Tile-space gradient
    const gradX = ((e + s) - (n + w)) / 2;
    const gradY = ((w + s) - (n + e)) / 2;

    // Convert to world-space (isometric projection)
    const worldSlopeX = (gradX - gradY);
    const worldSlopeY = (gradX + gradY) * 0.5;

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

  // === Terrain Rendering (polygon-based) ===

  private renderTerrain(): void {
    this.terrainGraphics.clear();

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tileType = this.tiles[y][x];
        const color = TILE_PROPERTIES[tileType].color;
        const corners = this.getTileCorners(x, y);

        this.terrainGraphics.fillStyle(color, 1);
        this.terrainGraphics.beginPath();
        this.terrainGraphics.moveTo(corners.n.x, corners.n.y);
        this.terrainGraphics.lineTo(corners.e.x, corners.e.y);
        this.terrainGraphics.lineTo(corners.s.x, corners.s.y);
        this.terrainGraphics.lineTo(corners.w.x, corners.w.y);
        this.terrainGraphics.closePath();
        this.terrainGraphics.fillPath();
      }
    }
    this.renderGrid();
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

  updateBlendOverlays(): void {
    this.blendGraphics.clear();

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tileType = this.tiles[y][x];
        const corners = this.getTileCorners(x, y);
        const cx = (corners.n.x + corners.e.x + corners.s.x + corners.w.x) / 4;
        const cy = (corners.n.y + corners.e.y + corners.s.y + corners.w.y) / 4;

        const neighbors = [
          { dx: 0, dy: -1, ox: 0, oy: -TILE_HEIGHT / 4 },
          { dx: 1, dy: 0,  ox: TILE_WIDTH / 4, oy: 0 },
          { dx: 0, dy: 1,  ox: 0, oy: TILE_HEIGHT / 4 },
          { dx: -1, dy: 0, ox: -TILE_WIDTH / 4, oy: 0 },
        ];

        for (const n of neighbors) {
          const nx = x + n.dx;
          const ny = y + n.dy;
          if (!this.isInBounds(nx, ny)) continue;

          const neighborType = this.tiles[ny][nx];
          if (neighborType === tileType) continue;

          const neighborColor = TILE_PROPERTIES[neighborType].color;
          this.blendGraphics.fillStyle(neighborColor, 0.2);
          this.blendGraphics.fillEllipse(cx + n.ox, cy + n.oy, 14, 8);
        }
      }
    }
  }

  loadFromData(data: CourseData): void {
    for (let y = 0; y < Math.min(data.height, this.height); y++) {
      for (let x = 0; x < Math.min(data.width, this.width); x++) {
        this.tiles[y][x] = data.tiles[y][x];
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

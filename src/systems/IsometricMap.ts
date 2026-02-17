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
  private elevations: number[][];
  private tileSprites: Phaser.GameObjects.Image[][] = [];
  private gridGraphics: Phaser.GameObjects.Graphics;
  private blendGraphics: Phaser.GameObjects.Graphics;
  private cornerElevations: number[][];
  private _terrainDirty = false;
  private _cornersDirty = false;

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

    // Initialize elevations
    this.elevations = [];
    for (let y = 0; y < height; y++) {
      this.elevations[y] = new Array(width).fill(0);
    }

    // Initialize corner elevations (vertices grid is (width+1) x (height+1))
    this.cornerElevations = [];
    for (let j = 0; j <= height; j++) {
      this.cornerElevations[j] = new Array(width + 1).fill(0);
    }

    // Create tile sprites (instead of terrainGraphics)
    this.tileSprites = [];
    for (let y = 0; y < height; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < width; x++) {
        const worldPos = tileToWorld(x, y);
        const sprite = scene.add.image(
          worldPos.x + this.getOffsetX(),
          worldPos.y + this.getOffsetY(),
          `tile_${this.tiles[y][x]}`
        );
        sprite.setOrigin(0.5, 0.5);
        sprite.setDepth(y + x * 0.01);
        this.container.add(sprite);
        this.tileSprites[y][x] = sprite;
      }
    }

    // Blend overlay graphics
    this.blendGraphics = scene.add.graphics();
    this.blendGraphics.setDepth(1); // just above tiles
    this.container.add(this.blendGraphics);

    // Grid overlay graphics (separate from tiles)
    this.gridGraphics = scene.add.graphics();
    this.gridGraphics.setDepth(2); // above tiles and blends
    this.container.add(this.gridGraphics);

    this.renderAllTiles();

    this.scene.events.on('update', this.flushIfDirty, this);
    this.scene.events.once('shutdown', () => {
      this.scene.events.off('update', this.flushIfDirty, this);
    });
  }


  // === Elevation Methods ===

  getElevationAt(tileX: number, tileY: number): number {
    if (!this.isInBounds(tileX, tileY)) return 0;
    return this.elevations[tileY][tileX];
  }

  setElevationAt(tileX: number, tileY: number, elevation: number): void {
    if (!this.isInBounds(tileX, tileY)) return;
    const clamped = Math.max(MIN_ELEVATION, Math.min(MAX_ELEVATION, elevation));
    this.elevations[tileY][tileX] = clamped;

    this._cornersDirty = true;
    this._terrainDirty = true;
  }

  getSlope(tileX: number, tileY: number): { slopeX: number; slopeY: number } {
    const eE = this.getElevationAt(tileX + 1, tileY);
    const eW = this.getElevationAt(tileX - 1, tileY);
    const eS = this.getElevationAt(tileX, tileY + 1);
    const eN = this.getElevationAt(tileX, tileY - 1);

    // Tile-space gradient (positive = higher to east/south)
    const gradX = (eE - eW) / 2;
    const gradY = (eS - eN) / 2;

    // Convert to world-space (isometric projection)
    // In iso: worldX ~ (tileX - tileY), worldY ~ (tileX + tileY)
    // Slope pushes ball "downhill" = toward lower elevation
    const worldSlopeX = (gradX - gradY);
    const worldSlopeY = (gradX + gradY) * 0.5;

    return { slopeX: worldSlopeX, slopeY: worldSlopeY };
  }

  // === Corner Elevation Computation ===

  private computeCornerElevations(): void {
    for (let j = 0; j <= this.height; j++) {
      for (let i = 0; i <= this.width; i++) {
        // Vertex V(i,j) is shared by up to 4 tiles:
        // (i,j), (i-1,j), (i,j-1), (i-1,j-1)
        let sum = 0;
        let count = 0;

        const adjacentTiles = [
          { x: i, y: j },
          { x: i - 1, y: j },
          { x: i, y: j - 1 },
          { x: i - 1, y: j - 1 }
        ];

        for (const tile of adjacentTiles) {
          if (this.isInBounds(tile.x, tile.y)) {
            sum += this.elevations[tile.y][tile.x];
            count++;
          }
        }

        this.cornerElevations[j][i] = count > 0 ? sum / count : 0;
      }
    }
  }

  // === World Position Methods ===

  getTileCorners(x: number, y: number): { n: { x: number; y: number }; e: { x: number; y: number }; s: { x: number; y: number }; w: { x: number; y: number } } {
    const sprite = this.tileSprites[y][x];
    const cx = sprite.x;
    const cy = sprite.y;
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;

    return {
      n: { x: cx, y: cy - hh },
      e: { x: cx + hw, y: cy },
      s: { x: cx, y: cy + hh },
      w: { x: cx - hw, y: cy },
    };
  }

  // === Terrain Rendering ===

  private renderTerrain(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const sprite = this.tileSprites[y][x];
        sprite.setTexture(`tile_${this.tiles[y][x]}`);

        const worldPos = tileToWorld(x, y);
        const avgElev = this.getAverageElevation(x, y);
        sprite.setPosition(
          worldPos.x + this.getOffsetX(),
          worldPos.y + this.getOffsetY() - avgElev * ELEVATION_STEP
        );
        sprite.setDepth(y + x * 0.01);
      }
    }
    this.renderGrid();
  }

  private getAverageElevation(x: number, y: number): number {
    return (
      this.cornerElevations[y][x] +
      this.cornerElevations[y][x + 1] +
      this.cornerElevations[y + 1][x + 1] +
      this.cornerElevations[y + 1][x]
    ) / 4;
  }

  private renderGrid(): void {
    this.gridGraphics.clear();
    if (!this.gridVisible) return;

    this.gridGraphics.lineStyle(1, 0x000000, 0.3);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const sprite = this.tileSprites[y][x];
        const cx = sprite.x;
        const cy = sprite.y;
        const hw = TILE_WIDTH / 2;
        const hh = TILE_HEIGHT / 2;

        this.gridGraphics.beginPath();
        this.gridGraphics.moveTo(cx, cy - hh);
        this.gridGraphics.lineTo(cx + hw, cy);
        this.gridGraphics.lineTo(cx, cy + hh);
        this.gridGraphics.lineTo(cx - hw, cy);
        this.gridGraphics.closePath();
        this.gridGraphics.strokePath();
      }
    }
  }

  private flushIfDirty(): void {
    if (!this._cornersDirty && !this._terrainDirty) return;

    if (this._cornersDirty) {
      this.computeCornerElevations();
      this._cornersDirty = false;
    }

    if (this._terrainDirty) {
      this.renderTerrain();
      this.updateBlendOverlays();
      this._terrainDirty = false;
    }
  }

  private renderAllTiles(): void {
    this.computeCornerElevations();
    this.renderTerrain();
    this.updateBlendOverlays();
  }

  setTileAt(tileX: number, tileY: number, type: TileType): void {
    if (!this.isInBounds(tileX, tileY)) return;
    if (this.tiles[tileY][tileX] === type) return;

    this.tiles[tileY][tileX] = type;
    // Immediate sprite texture update for editor responsiveness
    this.tileSprites[tileY][tileX].setTexture(`tile_${type}`);
    this._terrainDirty = true;
  }

  getTileAt(tileX: number, tileY: number): TileType {
    if (!this.isInBounds(tileX, tileY)) return TileType.GRASS;
    return this.tiles[tileY][tileX];
  }

  isInBounds(tileX: number, tileY: number): boolean {
    return tileX >= 0 && tileX < this.width && tileY >= 0 && tileY < this.height;
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
        const sprite = this.tileSprites[y][x];
        const cx = sprite.x;
        const cy = sprite.y;

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

    // Load elevations (backwards compatible - default to 0 if not present)
    if (data.elevations) {
      for (let y = 0; y < Math.min(data.height, this.height); y++) {
        for (let x = 0; x < Math.min(data.width, this.width); x++) {
          this.elevations[y][x] = data.elevations[y][x] ?? 0;
        }
      }
    }

    this.computeCornerElevations();
    this.renderTerrain();
    this.updateBlendOverlays();
  }

  exportData(): { width: number; height: number; tiles: TileType[][]; elevations: number[][] } {
    // Deep copy tiles and elevations
    const tiles = this.tiles.map(row => [...row]);
    const elevations = this.elevations.map(row => [...row]);
    return { width: this.width, height: this.height, tiles, elevations };
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
    const minY = Math.min(topLeft.y, topRight.y) - TILE_HEIGHT;
    const maxY = Math.max(bottomLeft.y, bottomRight.y) + TILE_HEIGHT;

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
}

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
  private terrainGraphics: Phaser.GameObjects.Graphics;
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

    // Terrain mesh graphics
    this.terrainGraphics = scene.add.graphics();
    this.terrainGraphics.setDepth(0);
    this.container.add(this.terrainGraphics);

    // Blend overlay graphics
    this.blendGraphics = scene.add.graphics();
    this.blendGraphics.setDepth(1); // just above tiles
    this.container.add(this.blendGraphics);

    this.renderAllTiles();

    this.scene.events.on('update', this.flushIfDirty, this);
    this.scene.events.once('shutdown', () => {
      this.scene.events.off('update', this.flushIfDirty, this);
    });
  }


  // === Helper Methods for Texture Generation ===

  private static seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  private static adjustColor(color: number, amount: number): number {
    const r = Math.min(255, Math.max(0, ((color >> 16) & 0xff) + amount));
    const g = Math.min(255, Math.max(0, ((color >> 8) & 0xff) + amount));
    const b = Math.min(255, Math.max(0, (color & 0xff) + amount));
    return (r << 16) | (g << 8) | b;
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

  private getCornerWorldPos(i: number, j: number): { x: number; y: number } {
    const halfW = TILE_WIDTH / 2;  // 32
    const halfH = TILE_HEIGHT / 2; // 16
    const offsetX = this.getOffsetX();
    const offsetY = this.getOffsetY();

    return {
      x: (i - j) * halfW + offsetX,
      y: (i + j) * halfH - halfH + offsetY - this.cornerElevations[j][i] * ELEVATION_STEP
    };
  }

  getTileCorners(x: number, y: number): { n: { x: number; y: number }; e: { x: number; y: number }; s: { x: number; y: number }; w: { x: number; y: number } } {
    return {
      n: this.getCornerWorldPos(x, y),       // top corner
      e: this.getCornerWorldPos(x + 1, y),   // right corner
      s: this.getCornerWorldPos(x + 1, y + 1), // bottom corner
      w: this.getCornerWorldPos(x, y + 1)    // left corner
    };
  }

  // === Terrain Rendering ===

  private renderTerrain(): void {
    this.terrainGraphics.clear();

    // Render tiles in order for proper overlap
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tileType = this.tiles[y][x];
        const color = TILE_PROPERTIES[tileType].color;
        const corners = this.getTileCorners(x, y);

        // Draw filled polygon (tile top face)
        this.terrainGraphics.fillStyle(color, 1);
        this.terrainGraphics.beginPath();
        this.terrainGraphics.moveTo(corners.n.x, corners.n.y);
        this.terrainGraphics.lineTo(corners.e.x, corners.e.y);
        this.terrainGraphics.lineTo(corners.s.x, corners.s.y);
        this.terrainGraphics.lineTo(corners.w.x, corners.w.y);
        this.terrainGraphics.closePath();
        this.terrainGraphics.fillPath();

        // Draw grid outline if visible
        if (this.gridVisible) {
          this.terrainGraphics.lineStyle(1, 0x000000, 0.3);
          this.terrainGraphics.strokePath();
        }

        // Draw tile pattern
        this.renderTilePattern(x, y, corners);
      }
    }
  }

  private renderTilePattern(x: number, y: number, corners: { n: { x: number; y: number }; e: { x: number; y: number }; s: { x: number; y: number }; w: { x: number; y: number } }): void {
    const tileType = this.tiles[y][x];
    const color = TILE_PROPERTIES[tileType].color;
    const rand = IsometricMap.seededRandom(x * 100 + y);

    // Calculate tile center
    const centerX = (corners.n.x + corners.e.x + corners.s.x + corners.w.x) / 4;
    const centerY = (corners.n.y + corners.e.y + corners.s.y + corners.w.y) / 4;

    // Helper function to lerp between two points
    const lerp = (p1: { x: number; y: number }, p2: { x: number; y: number }, t: number) => ({
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t
    });

    switch (tileType) {
      case TileType.GRASS:
        // 5-8 short lines in slightly varied color
        {
          const lineCount = Math.floor(rand() * 4) + 5;
          for (let i = 0; i < lineCount; i++) {
            const colorVariation = rand() < 0.5 ? -15 : 15;
            const lineColor = IsometricMap.adjustColor(color, colorVariation);
            const angle = rand() * Math.PI * 2;
            const length = rand() * 2 + 2;
            const px = centerX + (rand() - 0.5) * 20;
            const py = centerY + (rand() - 0.5) * 10;
            const x2 = px + Math.cos(angle) * length;
            const y2 = py + Math.sin(angle) * length;

            this.terrainGraphics.lineStyle(1, lineColor, 0.8);
            this.terrainGraphics.lineBetween(px, py, x2, y2);
          }
        }
        break;

      case TileType.FAIRWAY:
        // 2-3 lighter-colored stripes
        {
          const stripeCount = Math.floor(rand() * 2) + 2;
          const lighterColor = IsometricMap.adjustColor(color, 12);
          this.terrainGraphics.lineStyle(2, lighterColor, 0.3);

          for (let i = 0; i < stripeCount; i++) {
            const t = (i + 1) / (stripeCount + 1);
            const p1 = lerp(corners.w, corners.n, t);
            const p2 = lerp(corners.s, corners.e, t);
            this.terrainGraphics.lineBetween(p1.x, p1.y, p2.x, p2.y);
          }
        }
        break;

      case TileType.GREEN:
        // Fine horizontal lines
        {
          const lineCount = 5;
          const lighterColor = IsometricMap.adjustColor(color, 8);
          this.terrainGraphics.lineStyle(1, lighterColor, 0.2);

          for (let i = 0; i < lineCount; i++) {
            const t = (i + 1) / (lineCount + 1);
            const p1 = lerp(corners.w, corners.n, t);
            const p2 = lerp(corners.s, corners.e, t);
            this.terrainGraphics.lineBetween(p1.x, p1.y, p2.x, p2.y);
          }
        }
        break;

      case TileType.SAND:
        // 8-10 random dots
        {
          const dotCount = Math.floor(rand() * 3) + 8;
          for (let i = 0; i < dotCount; i++) {
            const px = centerX + (rand() - 0.5) * 24;
            const py = centerY + (rand() - 0.5) * 12;
            const colorVariation = rand() < 0.5 ? 20 : -15;
            const dotColor = IsometricMap.adjustColor(color, colorVariation);
            this.terrainGraphics.fillStyle(dotColor, 0.5);
            this.terrainGraphics.fillCircle(px, py, 1);
          }
        }
        break;

      case TileType.WATER:
        // 2-3 wavy lines
        {
          const waveCount = Math.floor(rand() * 2) + 2;
          const lighterColor = IsometricMap.adjustColor(color, 30);
          this.terrainGraphics.lineStyle(1, lighterColor, 0.4);

          for (let i = 0; i < waveCount; i++) {
            const t = (i + 1) / (waveCount + 1);
            const p1 = lerp(corners.w, corners.n, t);
            const p2 = lerp(corners.s, corners.e, t);
            const phase = rand() * Math.PI * 2;
            const amplitude = 2;

            this.terrainGraphics.beginPath();
            let firstPoint = true;
            for (let step = 0; step <= 16; step++) {
              const st = step / 16;
              const px = p1.x + (p2.x - p1.x) * st;
              const py = p1.y + (p2.y - p1.y) * st + Math.sin(st * Math.PI * 2 + phase) * amplitude;

              if (firstPoint) {
                this.terrainGraphics.moveTo(px, py);
                firstPoint = false;
              } else {
                this.terrainGraphics.lineTo(px, py);
              }
            }
            this.terrainGraphics.strokePath();
          }
        }
        break;

      case TileType.ROUGH:
        // 10-15 short dark lines
        {
          const lineCount = Math.floor(rand() * 6) + 10;
          for (let i = 0; i < lineCount; i++) {
            const lineColor = IsometricMap.adjustColor(color, -20);
            const angle = rand() * Math.PI * 2;
            const length = rand() * 2 + 3;
            const px = centerX + (rand() - 0.5) * 20;
            const py = centerY + (rand() - 0.5) * 10;
            const x2 = px + Math.cos(angle) * length;
            const y2 = py + Math.sin(angle) * length;

            this.terrainGraphics.lineStyle(1, lineColor, 0.8);
            this.terrainGraphics.lineBetween(px, py, x2, y2);
          }
        }
        break;

      case TileType.TEE:
        // Fairway stripes + center circle marker
        {
          // Draw stripes first
          const stripeCount = 2;
          const lighterColor = IsometricMap.adjustColor(color, 12);
          this.terrainGraphics.lineStyle(2, lighterColor, 0.3);

          for (let i = 0; i < stripeCount; i++) {
            const t = (i + 1) / (stripeCount + 1);
            const p1 = lerp(corners.w, corners.n, t);
            const p2 = lerp(corners.s, corners.e, t);
            this.terrainGraphics.lineBetween(p1.x, p1.y, p2.x, p2.y);
          }

          // Draw center marker
          const markerColor = IsometricMap.adjustColor(color, 25);
          this.terrainGraphics.fillStyle(markerColor, 0.8);
          this.terrainGraphics.fillCircle(centerX, centerY, 3);

          // Add cross lines
          this.terrainGraphics.lineStyle(1, markerColor, 0.8);
          this.terrainGraphics.lineBetween(centerX - 4, centerY, centerX + 4, centerY);
          this.terrainGraphics.lineBetween(centerX, centerY - 4, centerX, centerY + 4);
        }
        break;
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
    const offsetX = this.getOffsetX();
    const offsetY = this.getOffsetY();

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tileType = this.tiles[y][x];
        const tileColor = TILE_PROPERTIES[tileType].color;
        const worldPos = tileToWorld(x, y);
        const cx = worldPos.x + offsetX;

        // Use average corner elevation for this tile
        const avgElev = (
          this.cornerElevations[y][x] +
          this.cornerElevations[y][x + 1] +
          this.cornerElevations[y + 1][x + 1] +
          this.cornerElevations[y + 1][x]
        ) / 4;
        const cy = worldPos.y + offsetY - avgElev * ELEVATION_STEP;

        // Check 4 neighbors: N(x,y-1), E(x+1,y), S(x,y+1), W(x-1,y)
        const neighbors = [
          { dx: 0, dy: -1, ox: 0, oy: -TILE_HEIGHT / 4 },   // North
          { dx: 1, dy: 0,  ox: TILE_WIDTH / 4, oy: 0 },      // East
          { dx: 0, dy: 1,  ox: 0, oy: TILE_HEIGHT / 4 },     // South
          { dx: -1, dy: 0, ox: -TILE_WIDTH / 4, oy: 0 },     // West
        ];

        for (const n of neighbors) {
          const nx = x + n.dx;
          const ny = y + n.dy;
          if (!this.isInBounds(nx, ny)) continue;

          const neighborType = this.tiles[ny][nx];
          if (neighborType === tileType) continue;

          const neighborColor = TILE_PROPERTIES[neighborType].color;
          // Draw a small blended ellipse at the edge toward the neighbor
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

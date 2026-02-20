import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IsometricMap } from '../src/systems/IsometricMap';
import { TileType } from '../src/models/TileTypes';
import { CourseData } from '../src/models/CourseData';

// Minimal Phaser Scene mock
function createMockScene(): any {
  const mockGraphics = {
    setDepth: vi.fn().mockReturnThis(),
    clear: vi.fn().mockReturnThis(),
    fillStyle: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    beginPath: vi.fn().mockReturnThis(),
    moveTo: vi.fn().mockReturnThis(),
    lineTo: vi.fn().mockReturnThis(),
    closePath: vi.fn().mockReturnThis(),
    fillPath: vi.fn().mockReturnThis(),
    strokePath: vi.fn().mockReturnThis(),
    fillEllipse: vi.fn().mockReturnThis(),
  };

  return {
    add: {
      graphics: vi.fn(() => ({ ...mockGraphics })),
      container: vi.fn(() => ({ add: vi.fn() })),
    },
    events: {
      on: vi.fn(),
      once: vi.fn(),
      off: vi.fn(),
    },
  };
}

describe('IsometricMap', () => {
  let map: IsometricMap;

  beforeEach(() => {
    map = new IsometricMap(createMockScene(), 8, 8);
  });

  // === Corner Elevation ===

  describe('corner elevation', () => {
    it('defaults all corners to 0', () => {
      expect(map.getCornerElevation(0, 0)).toBe(0);
      expect(map.getCornerElevation(4, 4)).toBe(0);
      expect(map.getCornerElevation(8, 8)).toBe(0);
    });

    it('sets and gets corner elevation', () => {
      map.setCornerElevation(3, 3, 2);
      expect(map.getCornerElevation(3, 3)).toBe(2);
    });

    it('clamps to MAX_ELEVATION', () => {
      map.setCornerElevation(0, 0, 99);
      expect(map.getCornerElevation(0, 0)).toBe(5); // MAX_ELEVATION = 5
    });

    it('clamps to MIN_ELEVATION', () => {
      map.setCornerElevation(0, 0, -99);
      expect(map.getCornerElevation(0, 0)).toBe(-2); // MIN_ELEVATION = -2
    });

    it('returns 0 for out-of-bounds corners', () => {
      expect(map.getCornerElevation(-1, 0)).toBe(0);
      expect(map.getCornerElevation(0, -1)).toBe(0);
      expect(map.getCornerElevation(99, 0)).toBe(0);
    });
  });

  // === getElevationAt (tile average) ===

  describe('getElevationAt', () => {
    it('returns 0 for flat terrain', () => {
      expect(map.getElevationAt(0, 0)).toBe(0);
    });

    it('returns average of 4 corners', () => {
      // Tile (2,2) corners: vertex(2,2), vertex(3,2), vertex(3,3), vertex(2,3)
      map.setCornerElevation(2, 2, 4);
      map.setCornerElevation(3, 2, 4);
      map.setCornerElevation(3, 3, 0);
      map.setCornerElevation(2, 3, 0);
      expect(map.getElevationAt(2, 2)).toBe(2); // (4+4+0+0)/4
    });

    it('returns 0 for out-of-bounds tile', () => {
      expect(map.getElevationAt(-1, 0)).toBe(0);
      expect(map.getElevationAt(99, 0)).toBe(0);
    });
  });

  // === getSlope ===

  describe('getSlope', () => {
    it('returns zero slope for flat terrain', () => {
      const slope = map.getSlope(4, 4);
      expect(slope.slopeX).toBeCloseTo(0);
      expect(slope.slopeY).toBeCloseTo(0);
    });

    it('returns downhill slope when east corners are higher', () => {
      // Tile (4,4): N=vertex(4,4), E=vertex(5,4), S=vertex(5,5), W=vertex(4,5)
      // Raise east side (E and S corners)
      map.setCornerElevation(5, 4, 2); // E
      map.setCornerElevation(5, 5, 2); // S
      const slope = map.getSlope(4, 4);
      // gradX = ((E+S) - (N+W)) / 2 = ((2+2) - (0+0)) / 2 = 2
      // worldSlopeX = -(gradX - gradY) = -(2 - 0) = -2
      expect(slope.slopeX).toBe(-2);
    });

    it('returns zero net slope for uniformly raised tile', () => {
      // All 4 corners at same height → no slope
      map.setCornerElevation(4, 4, 3);
      map.setCornerElevation(5, 4, 3);
      map.setCornerElevation(5, 5, 3);
      map.setCornerElevation(4, 5, 3);
      const slope = map.getSlope(4, 4);
      expect(slope.slopeX).toBeCloseTo(0);
      expect(slope.slopeY).toBeCloseTo(0);
    });

    it('returns zero for out-of-bounds tile', () => {
      const slope = map.getSlope(-1, -1);
      expect(slope).toEqual({ slopeX: 0, slopeY: 0 });
    });
  });

  // === Bounds checking ===

  describe('bounds checking', () => {
    it('isInBounds for valid tiles', () => {
      expect(map.isInBounds(0, 0)).toBe(true);
      expect(map.isInBounds(7, 7)).toBe(true);
    });

    it('isInBounds rejects out-of-range', () => {
      expect(map.isInBounds(-1, 0)).toBe(false);
      expect(map.isInBounds(8, 0)).toBe(false);
      expect(map.isInBounds(0, 8)).toBe(false);
    });

    it('isCornerInBounds includes edge vertices', () => {
      expect(map.isCornerInBounds(0, 0)).toBe(true);
      expect(map.isCornerInBounds(8, 8)).toBe(true); // width+1, height+1
    });

    it('isCornerInBounds rejects out-of-range', () => {
      expect(map.isCornerInBounds(-1, 0)).toBe(false);
      expect(map.isCornerInBounds(9, 0)).toBe(false);
    });
  });

  // === Tile operations ===

  describe('tile operations', () => {
    it('defaults to GRASS', () => {
      expect(map.getTileAt(0, 0)).toBe(TileType.GRASS);
    });

    it('sets and gets tile type', () => {
      map.setTileAt(3, 3, TileType.WATER);
      expect(map.getTileAt(3, 3)).toBe(TileType.WATER);
    });

    it('returns GRASS for out-of-bounds', () => {
      expect(map.getTileAt(-1, 0)).toBe(TileType.GRASS);
    });
  });

  // === worldToTile ===

  describe('worldToTile', () => {
    it('converts offset-adjusted positions', () => {
      // Tile (0,0) center in world: tileToWorld(0,0) + offset
      // offsetX = (8*64)/2 = 256, offsetY = 50
      const result = map.worldToTile(256, 50);
      expect(result).toEqual({ tileX: 0, tileY: 0 });
    });
  });

  // === worldToNearestVertex ===

  describe('worldToNearestVertex', () => {
    it('returns a valid corner within bounds', () => {
      const { cx, cy } = map.worldToNearestVertex(256, 50);
      expect(map.isCornerInBounds(cx, cy)).toBe(true);
    });
  });

  // === Load / Migration ===

  describe('loadFromData', () => {
    it('loads corner elevations from new format', () => {
      const cornerElevations: number[][] = [];
      for (let j = 0; j <= 8; j++) {
        cornerElevations[j] = new Array(9).fill(0);
      }
      cornerElevations[2][3] = 4;

      const data: CourseData = {
        name: 'Test',
        width: 8,
        height: 8,
        tiles: Array.from({ length: 8 }, () => new Array(8).fill(TileType.GRASS)),
        cornerElevations,
        holes: [],
        objects: [],
        metadata: { createdAt: '', updatedAt: '', version: 1 },
      };

      map.loadFromData(data);
      expect(map.getCornerElevation(3, 2)).toBe(4);
    });

    it('migrates legacy tile-centered elevations', () => {
      const elevations: number[][] = [];
      for (let y = 0; y < 8; y++) {
        elevations[y] = new Array(8).fill(0);
      }
      // Set tile (3,3) to elevation 4
      elevations[3][3] = 4;

      const data: CourseData = {
        name: 'Legacy',
        width: 8,
        height: 8,
        tiles: Array.from({ length: 8 }, () => new Array(8).fill(TileType.GRASS)),
        elevations,
        holes: [],
        objects: [],
        metadata: { createdAt: '', updatedAt: '', version: 1 },
      };

      map.loadFromData(data);
      // Corner (3,3) should be average of tiles (3,3), (2,3), (3,2), (2,2)
      // Only tile (3,3) = 4, others = 0 → average = 1
      expect(map.getCornerElevation(3, 3)).toBe(1);
      // Corner (4,4) shares tile (3,3) too → average = 1
      expect(map.getCornerElevation(4, 4)).toBe(1);
    });
  });

  // === exportData ===

  describe('exportData', () => {
    it('exports cornerElevations (not elevations)', () => {
      map.setCornerElevation(1, 1, 3);
      const data = map.exportData();
      expect(data.cornerElevations).toBeDefined();
      expect(data.cornerElevations[1][1]).toBe(3);
      expect((data as any).elevations).toBeUndefined();
    });

    it('exports deep copies', () => {
      const data = map.exportData();
      data.tiles[0][0] = TileType.WATER;
      data.cornerElevations[0][0] = 99;
      // Original should be unchanged
      expect(map.getTileAt(0, 0)).toBe(TileType.GRASS);
      expect(map.getCornerElevation(0, 0)).toBe(0);
    });
  });
});

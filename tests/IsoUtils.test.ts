import { describe, it, expect } from 'vitest';
import { tileToWorld, worldToTile } from '../src/utils/IsoUtils';

describe('tileToWorld', () => {
  it('converts origin tile to world origin', () => {
    const pos = tileToWorld(0, 0);
    expect(pos).toEqual({ x: 0, y: 0 });
  });

  it('converts tile (1,0) correctly', () => {
    const pos = tileToWorld(1, 0);
    expect(pos).toEqual({ x: 32, y: 16 });
  });

  it('converts tile (0,1) correctly', () => {
    const pos = tileToWorld(0, 1);
    expect(pos).toEqual({ x: -32, y: 16 });
  });

  it('converts tile (1,1) correctly', () => {
    const pos = tileToWorld(1, 1);
    expect(pos).toEqual({ x: 0, y: 32 });
  });

  it('handles negative coordinates', () => {
    const pos = tileToWorld(-1, 0);
    expect(pos).toEqual({ x: -32, y: -16 });
  });
});

describe('worldToTile', () => {
  it('converts world origin to tile (0,0)', () => {
    const tile = worldToTile(0, 0);
    expect(tile).toEqual({ tileX: 0, tileY: 0 });
  });

  it('converts center of tile (1,0)', () => {
    const tile = worldToTile(32, 16);
    expect(tile).toEqual({ tileX: 1, tileY: 0 });
  });

  it('converts center of tile (0,1)', () => {
    const tile = worldToTile(-32, 16);
    expect(tile).toEqual({ tileX: 0, tileY: 1 });
  });
});

describe('roundtrip tileToWorld → worldToTile', () => {
  const testCases = [
    [0, 0], [1, 0], [0, 1], [5, 3], [10, 10], [31, 31],
  ];

  for (const [tx, ty] of testCases) {
    it(`roundtrips tile (${tx},${ty})`, () => {
      const world = tileToWorld(tx, ty);
      const tile = worldToTile(world.x, world.y);
      expect(tile).toEqual({ tileX: tx, tileY: ty });
    });
  }
});

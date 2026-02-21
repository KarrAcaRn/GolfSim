import { describe, it, expect } from 'vitest';
import { tileToWorld } from '../src/utils/IsoUtils';

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

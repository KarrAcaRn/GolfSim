import { describe, it, expect } from 'vitest';
import { createEmptyCourse } from '../src/models/CourseData';
import { TileType } from '../src/models/TileTypes';

describe('createEmptyCourse', () => {
  const course = createEmptyCourse(32, 32);

  it('has correct dimensions', () => {
    expect(course.width).toBe(32);
    expect(course.height).toBe(32);
  });

  it('creates tiles array with correct size', () => {
    expect(course.tiles).toHaveLength(32);
    expect(course.tiles[0]).toHaveLength(32);
  });

  it('fills all tiles with GRASS', () => {
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        expect(course.tiles[y][x]).toBe(TileType.GRASS);
      }
    }
  });

  it('creates cornerElevations with (height+1) x (width+1) size', () => {
    expect(course.cornerElevations).toBeDefined();
    expect(course.cornerElevations!).toHaveLength(33);
    expect(course.cornerElevations![0]).toHaveLength(33);
  });

  it('fills all corner elevations with 0', () => {
    for (let j = 0; j <= 32; j++) {
      for (let i = 0; i <= 32; i++) {
        expect(course.cornerElevations![j][i]).toBe(0);
      }
    }
  });

  it('has empty holes and objects arrays', () => {
    expect(course.holes).toEqual([]);
    expect(course.objects).toEqual([]);
  });

  it('has metadata with timestamps and version', () => {
    expect(course.metadata.version).toBe(1);
    expect(course.metadata.createdAt).toBeTruthy();
    expect(course.metadata.updatedAt).toBeTruthy();
  });

  it('works with non-square dimensions', () => {
    const rect = createEmptyCourse(16, 8);
    expect(rect.tiles).toHaveLength(8);
    expect(rect.tiles[0]).toHaveLength(16);
    expect(rect.cornerElevations!).toHaveLength(9);
    expect(rect.cornerElevations![0]).toHaveLength(17);
  });
});

import { TileType } from './TileTypes';
import { HoleData } from './HoleData';

export enum ObjectType {
  TREE_SMALL = 'tree_small',
  TREE_LARGE = 'tree_large',
  BUSH = 'bush',
  ROCK = 'rock',
}

export interface PlacedObject {
  type: ObjectType;
  tileX: number;
  tileY: number;
}

export interface CourseMetadata {
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CourseData {
  name: string;
  width: number;
  height: number;
  tiles: TileType[][];
  elevations?: number[][];
  holes: HoleData[];
  objects: PlacedObject[];
  metadata: CourseMetadata;
}

export function createEmptyCourse(width: number, height: number): CourseData {
  const tiles: TileType[][] = [];
  const elevations: number[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = new Array(width).fill(TileType.GRASS);
    elevations[y] = new Array(width).fill(0);
  }
  return {
    name: 'New Course',
    width,
    height,
    tiles,
    elevations,
    holes: [],
    objects: [],
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    },
  };
}

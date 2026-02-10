import { TileType } from './TileTypes';

export interface ClubTerrainModifier {
  hitSpeedDifferenceMin: number;
  hitSpeedDifferenceMax: number;
  hitAccuracy: number;
}

export interface Club {
  id: string;
  nameKey: string;   // i18n key, e.g. 'clubs.driver'
  minPower: number;
  maxPower: number;
  loftDegrees: number;
  teeOnly: boolean;  // true = can only be used on TEE tiles
  terrainModifiers: Partial<Record<TileType, ClubTerrainModifier>>;
}

export const CLUBS: Club[] = [
  {
    id: 'driver',
    nameKey: 'clubs.driver',
    minPower: 200,
    maxPower: 600,
    loftDegrees: 12,
    teeOnly: true,
    terrainModifiers: {
      [TileType.SAND]:  { hitSpeedDifferenceMin: -0.30, hitSpeedDifferenceMax: -0.10, hitAccuracy: 5.0 },
      [TileType.ROUGH]: { hitSpeedDifferenceMin: -0.15, hitSpeedDifferenceMax: -0.05, hitAccuracy: 2.0 },
    }
  },
  {
    id: 'wood',
    nameKey: 'clubs.wood',
    minPower: 150,
    maxPower: 500,
    loftDegrees: 20,
    teeOnly: false,
    terrainModifiers: {
      [TileType.SAND]:  { hitSpeedDifferenceMin: -0.25, hitSpeedDifferenceMax: -0.08, hitAccuracy: 4.0 },
      [TileType.ROUGH]: { hitSpeedDifferenceMin: -0.10, hitSpeedDifferenceMax: -0.03, hitAccuracy: 1.5 },
    }
  },
  {
    id: 'iron',
    nameKey: 'clubs.iron',
    minPower: 80,
    maxPower: 400,
    loftDegrees: 35,
    teeOnly: false,
    terrainModifiers: {
      [TileType.SAND]:  { hitSpeedDifferenceMin: -0.15, hitSpeedDifferenceMax: -0.05, hitAccuracy: 2.0 },
      [TileType.ROUGH]: { hitSpeedDifferenceMin: -0.05, hitSpeedDifferenceMax: -0.01, hitAccuracy: 0.5 },
    }
  },
  {
    id: 'sandwedge',
    nameKey: 'clubs.sandWedge',
    minPower: 40,
    maxPower: 300,
    loftDegrees: 55,
    teeOnly: false,
    terrainModifiers: {
      [TileType.SAND]:  { hitSpeedDifferenceMin: -0.02, hitSpeedDifferenceMax: 0.00, hitAccuracy: 0.5 },
      [TileType.ROUGH]: { hitSpeedDifferenceMin: -0.05, hitSpeedDifferenceMax: -0.01, hitAccuracy: 0.5 },
    }
  },
  {
    id: 'putter',
    nameKey: 'clubs.putter',
    minPower: 10,
    maxPower: 200,
    loftDegrees: 0,
    teeOnly: false,
    terrainModifiers: {
      [TileType.SAND]:  { hitSpeedDifferenceMin: -0.20, hitSpeedDifferenceMax: -0.10, hitAccuracy: 3.0 },
      [TileType.ROUGH]: { hitSpeedDifferenceMin: -0.10, hitSpeedDifferenceMax: -0.05, hitAccuracy: 1.5 },
    }
  },
];

export const DEFAULT_CLUB_INDEX = 2; // Iron

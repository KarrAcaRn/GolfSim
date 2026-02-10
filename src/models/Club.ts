export interface Club {
  id: string;
  nameKey: string;   // i18n key, e.g. 'clubs.driver'
  maxPower: number;
  loftDegrees: number;
  teeOnly: boolean;  // true = can only be used on TEE tiles
}

export const CLUBS: Club[] = [
  { id: 'driver',     nameKey: 'clubs.driver',     maxPower: 600, loftDegrees: 12, teeOnly: true },
  { id: 'wood',       nameKey: 'clubs.wood',       maxPower: 500, loftDegrees: 20, teeOnly: false },
  { id: 'iron',       nameKey: 'clubs.iron',       maxPower: 400, loftDegrees: 35, teeOnly: false },
  { id: 'sandwedge',  nameKey: 'clubs.sandWedge',  maxPower: 300, loftDegrees: 55, teeOnly: false },
  { id: 'putter',     nameKey: 'clubs.putter',     maxPower: 200, loftDegrees: 0,  teeOnly: false },
];

export const DEFAULT_CLUB_INDEX = 2; // Iron

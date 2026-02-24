export interface HoleScore {
  holeIndex: number;
  par: number;
  strokesA: number;
  strokesB: number;
  scoreA: number;
  scoreB: number;
  winner: 'A' | 'B' | 'tie';
}

export interface MatchScoreSheet {
  holeScores: HoleScore[];
  totalStrokesA: number;
  totalStrokesB: number;
  totalScoreA: number;
  totalScoreB: number;
  holesWonA: number;
  holesWonB: number;
  tiedHoles: number;
}

export function createEmptyScoreSheet(): MatchScoreSheet {
  return {
    holeScores: [],
    totalStrokesA: 0,
    totalStrokesB: 0,
    totalScoreA: 0,
    totalScoreB: 0,
    holesWonA: 0,
    holesWonB: 0,
    tiedHoles: 0,
  };
}

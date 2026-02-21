/**
 * Utility functions for golf scoring display
 */

/**
 * Get color for score relative to par
 * @param scoreRelPar - Score relative to par (negative = under, 0 = even, positive = over)
 * @returns Hex color code
 */
export function getScoreColor(scoreRelPar: number): number {
  if (scoreRelPar < 0) return 0x4caf50; // Green for under par
  if (scoreRelPar > 0) return 0xf44336; // Red for over par
  return 0xffffff; // White for even par
}

/**
 * Get score text for display (e.g., "E", "+2", "-1")
 * @param scoreRelPar - Score relative to par
 * @returns Formatted score text
 */
export function getScoreText(scoreRelPar: number): string {
  if (scoreRelPar === 0) return 'E';
  if (scoreRelPar > 0) return `+${scoreRelPar}`;
  return `${scoreRelPar}`;
}

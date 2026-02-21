import Phaser from 'phaser';

/** Register a UI element: track it for cleanup, pin to camera, set depth. */
export function addUIElement<T extends Phaser.GameObjects.GameObject>(
  el: T,
  elements: Phaser.GameObjects.GameObject[],
  depth: number,
): T {
  elements.push(el);
  if ('setScrollFactor' in el) (el as any).setScrollFactor(0);
  if ('setDepth' in el) (el as any).setDepth(depth);
  return el;
}

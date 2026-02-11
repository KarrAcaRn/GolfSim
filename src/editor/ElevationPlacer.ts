import Phaser from 'phaser';
import { IsometricMap } from '../systems/IsometricMap';
import { EditorState, EditorTool } from './EditorState';

export class ElevationPlacer {
  private scene: Phaser.Scene;
  private isoMap: IsometricMap;
  private state: EditorState;
  private hoverGraphics: Phaser.GameObjects.Graphics;
  private lastPaintedTile: string | null = null;

  constructor(scene: Phaser.Scene, isoMap: IsometricMap, state: EditorState) {
    this.scene = scene;
    this.isoMap = isoMap;
    this.state = state;
    this.hoverGraphics = scene.add.graphics();
    this.hoverGraphics.setDepth(900);

    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
  }

  private isElevationTool(): boolean {
    return this.state.currentTool === EditorTool.RAISE_TERRAIN ||
           this.state.currentTool === EditorTool.LOWER_TERRAIN;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.isElevationTool()) return;
    if (pointer.rightButtonDown() || pointer.middleButtonDown()) return;

    this.modifyAt(pointer.worldX, pointer.worldY);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isElevationTool()) {
      this.hoverGraphics.clear();
      return;
    }

    this.updateHover(pointer.worldX, pointer.worldY);

    if (pointer.isDown && !pointer.rightButtonDown() && !pointer.middleButtonDown()) {
      this.modifyAt(pointer.worldX, pointer.worldY);
    }
  }

  private onPointerUp(): void {
    this.lastPaintedTile = null;
  }

  private modifyAt(worldX: number, worldY: number): void {
    const { tileX, tileY } = this.isoMap.worldToTile(worldX, worldY);
    if (!this.isoMap.isInBounds(tileX, tileY)) return;

    const key = `${tileX},${tileY}`;
    if (this.lastPaintedTile === key) return;
    this.lastPaintedTile = key;

    const oldElevation = this.isoMap.getElevationAt(tileX, tileY);
    const delta = this.state.currentTool === EditorTool.RAISE_TERRAIN ? 1 : -1;
    const newElevation = oldElevation + delta;

    if (newElevation === oldElevation) return; // clamped, no change

    this.isoMap.setElevationAt(tileX, tileY, newElevation);

    // Verify the elevation actually changed (could be clamped)
    const actualElevation = this.isoMap.getElevationAt(tileX, tileY);
    if (actualElevation === oldElevation) return;

    this.state.pushAction({
      type: 'elevation_change',
      data: { tileX, tileY, oldElevation, newElevation: actualElevation },
    });
  }

  private updateHover(worldX: number, worldY: number): void {
    this.hoverGraphics.clear();
    const { tileX, tileY } = this.isoMap.worldToTile(worldX, worldY);
    if (!this.isoMap.isInBounds(tileX, tileY)) return;

    const corners = this.isoMap.getTileCorners(tileX, tileY);

    // Diamond outline
    const isRaise = this.state.currentTool === EditorTool.RAISE_TERRAIN;
    const color = isRaise ? 0x00ff00 : 0xff6600;
    this.hoverGraphics.lineStyle(2, color, 0.8);
    this.hoverGraphics.beginPath();
    this.hoverGraphics.moveTo(corners.n.x, corners.n.y);
    this.hoverGraphics.lineTo(corners.e.x, corners.e.y);
    this.hoverGraphics.lineTo(corners.s.x, corners.s.y);
    this.hoverGraphics.lineTo(corners.w.x, corners.w.y);
    this.hoverGraphics.closePath();
    this.hoverGraphics.strokePath();

    // Arrow indicator at tile center
    const centerX = (corners.n.x + corners.e.x + corners.s.x + corners.w.x) / 4;
    const centerY = (corners.n.y + corners.e.y + corners.s.y + corners.w.y) / 4;

    if (isRaise) {
      // Up arrow
      this.hoverGraphics.lineStyle(2, color, 0.9);
      this.hoverGraphics.lineBetween(centerX, centerY - 2, centerX, centerY - 10);
      this.hoverGraphics.lineBetween(centerX - 4, centerY - 6, centerX, centerY - 10);
      this.hoverGraphics.lineBetween(centerX + 4, centerY - 6, centerX, centerY - 10);
    } else {
      // Down arrow
      this.hoverGraphics.lineStyle(2, color, 0.9);
      this.hoverGraphics.lineBetween(centerX, centerY + 2, centerX, centerY + 10);
      this.hoverGraphics.lineBetween(centerX - 4, centerY + 6, centerX, centerY + 10);
      this.hoverGraphics.lineBetween(centerX + 4, centerY + 6, centerX, centerY + 10);
    }
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.hoverGraphics.destroy();
  }
}

import Phaser from 'phaser';
import { IsometricMap } from '../systems/IsometricMap';
import { EditorState, EditorTool } from './EditorState';

export class ElevationPlacer {
  private scene: Phaser.Scene;
  private isoMap: IsometricMap;
  private state: EditorState;
  private hoverGraphics: Phaser.GameObjects.Graphics;
  private lastPaintedVertex: string | null = null;

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
    this.lastPaintedVertex = null;
  }

  private modifyAt(worldX: number, worldY: number): void {
    const { cx, cy } = this.isoMap.worldToNearestVertex(worldX, worldY);
    if (!this.isoMap.isCornerInBounds(cx, cy)) return;

    const key = `${cx},${cy}`;
    if (this.lastPaintedVertex === key) return;
    this.lastPaintedVertex = key;

    const oldElevation = this.isoMap.getCornerElevation(cx, cy);
    const delta = this.state.currentTool === EditorTool.RAISE_TERRAIN ? 1 : -1;
    const newElevation = oldElevation + delta;

    if (newElevation === oldElevation) return; // clamped, no change

    this.isoMap.setCornerElevation(cx, cy, newElevation);

    // Verify the elevation actually changed (could be clamped)
    const actualElevation = this.isoMap.getCornerElevation(cx, cy);
    if (actualElevation === oldElevation) return;

    this.state.pushAction({
      type: 'elevation_change',
      data: { cornerX: cx, cornerY: cy, oldElevation, newElevation: actualElevation },
    });
  }

  private updateHover(worldX: number, worldY: number): void {
    this.hoverGraphics.clear();
    const { cx, cy } = this.isoMap.worldToNearestVertex(worldX, worldY);
    if (!this.isoMap.isCornerInBounds(cx, cy)) return;

    // Get vertex screen position by finding an adjacent tile and picking the right corner
    const vertexPos = this.getVertexScreenPos(cx, cy);
    if (!vertexPos) return;

    const isRaise = this.state.currentTool === EditorTool.RAISE_TERRAIN;
    const color = isRaise ? 0x00ff00 : 0xff6600;

    // Draw a circle at the vertex position
    this.hoverGraphics.lineStyle(2, color, 0.8);
    this.hoverGraphics.fillStyle(color, 0.3);
    this.hoverGraphics.fillCircle(vertexPos.x, vertexPos.y, 6);
    this.hoverGraphics.strokeCircle(vertexPos.x, vertexPos.y, 6);

    // Draw arrow indicator at vertex position
    if (isRaise) {
      // Up arrow
      this.hoverGraphics.lineStyle(2, color, 0.9);
      this.hoverGraphics.lineBetween(vertexPos.x, vertexPos.y - 8, vertexPos.x, vertexPos.y - 16);
      this.hoverGraphics.lineBetween(vertexPos.x - 4, vertexPos.y - 12, vertexPos.x, vertexPos.y - 16);
      this.hoverGraphics.lineBetween(vertexPos.x + 4, vertexPos.y - 12, vertexPos.x, vertexPos.y - 16);
    } else {
      // Down arrow
      this.hoverGraphics.lineStyle(2, color, 0.9);
      this.hoverGraphics.lineBetween(vertexPos.x, vertexPos.y + 8, vertexPos.x, vertexPos.y + 16);
      this.hoverGraphics.lineBetween(vertexPos.x - 4, vertexPos.y + 12, vertexPos.x, vertexPos.y + 16);
      this.hoverGraphics.lineBetween(vertexPos.x + 4, vertexPos.y + 12, vertexPos.x, vertexPos.y + 16);
    }
  }

  /**
   * Get screen position of a vertex by finding an adjacent tile and picking the right corner.
   * Vertex (cx, cy) can be:
   * - N corner of tile (cx, cy) if in bounds
   * - E corner of tile (cx-1, cy) if in bounds
   * - W corner of tile (cx, cy-1) if in bounds
   * - S corner of tile (cx-1, cy-1) if in bounds
   */
  private getVertexScreenPos(cx: number, cy: number): { x: number; y: number } | null {
    // Try tile (cx, cy) → N corner
    if (this.isoMap.isInBounds(cx, cy)) {
      const corners = this.isoMap.getTileCorners(cx, cy);
      return { x: corners.n.x, y: corners.n.y };
    }

    // Try tile (cx-1, cy) → E corner
    if (this.isoMap.isInBounds(cx - 1, cy)) {
      const corners = this.isoMap.getTileCorners(cx - 1, cy);
      return { x: corners.e.x, y: corners.e.y };
    }

    // Try tile (cx, cy-1) → W corner
    if (this.isoMap.isInBounds(cx, cy - 1)) {
      const corners = this.isoMap.getTileCorners(cx, cy - 1);
      return { x: corners.w.x, y: corners.w.y };
    }

    // Try tile (cx-1, cy-1) → S corner
    if (this.isoMap.isInBounds(cx - 1, cy - 1)) {
      const corners = this.isoMap.getTileCorners(cx - 1, cy - 1);
      return { x: corners.s.x, y: corners.s.y };
    }

    return null;
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.hoverGraphics.destroy();
  }
}

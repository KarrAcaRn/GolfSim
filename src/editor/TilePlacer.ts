import Phaser from 'phaser';
import { IsometricMap } from '../systems/IsometricMap';
import { EditorState, EditorTool } from './EditorState';
import { TileType, TILE_PROPERTIES } from '../models/TileTypes';
import { TILE_WIDTH, TILE_HEIGHT } from '../utils/Constants';

export class TilePlacer {
  private scene: Phaser.Scene;
  private isoMap: IsometricMap;
  private state: EditorState;
  private hoverGraphics: Phaser.GameObjects.Graphics;
  private lastPaintedTile: { x: number; y: number } | null = null;

  constructor(scene: Phaser.Scene, isoMap: IsometricMap, state: EditorState) {
    this.scene = scene;
    this.isoMap = isoMap;
    this.state = state;
    this.hoverGraphics = scene.add.graphics();
    this.hoverGraphics.setDepth(1000);

    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.rightButtonDown() || pointer.middleButtonDown()) return;
    if (this.state.currentTool !== EditorTool.PAINT_TERRAIN && this.state.currentTool !== EditorTool.ERASE) return;

    this.paintAt(pointer.worldX, pointer.worldY);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    // Always update hover
    this.updateHover(pointer.worldX, pointer.worldY);

    // Paint while dragging
    if (pointer.isDown && !pointer.rightButtonDown() && !pointer.middleButtonDown()) {
      if (this.state.currentTool === EditorTool.PAINT_TERRAIN || this.state.currentTool === EditorTool.ERASE) {
        this.paintAt(pointer.worldX, pointer.worldY);
      }
    }
  }

  private onPointerUp(): void {
    this.lastPaintedTile = null;
  }

  private paintAt(worldX: number, worldY: number): void {
    const { tileX, tileY } = this.isoMap.worldToTile(worldX, worldY);
    if (!this.isoMap.isInBounds(tileX, tileY)) return;

    // Skip if same tile as last paint (avoid duplicate undo entries while dragging)
    if (this.lastPaintedTile && this.lastPaintedTile.x === tileX && this.lastPaintedTile.y === tileY) return;
    this.lastPaintedTile = { x: tileX, y: tileY };

    const oldType = this.isoMap.getTileAt(tileX, tileY);
    const newType = this.state.currentTool === EditorTool.ERASE ? TileType.GRASS : this.state.selectedTerrain;

    if (oldType === newType) return;

    this.isoMap.setTileAt(tileX, tileY, newType);
    this.state.pushAction({
      type: 'tile_change',
      data: { tileX, tileY, oldType, newType },
    });
  }

  private updateHover(worldX: number, worldY: number): void {
    this.hoverGraphics.clear();
    const { tileX, tileY } = this.isoMap.worldToTile(worldX, worldY);
    if (!this.isoMap.isInBounds(tileX, tileY)) return;

    const worldPos = this.isoMap.tileToWorld(tileX, tileY);
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;

    // Determine hover color based on tool
    let hoverColor = 0xffffff;
    if (this.state.currentTool === EditorTool.PAINT_TERRAIN) {
      hoverColor = TILE_PROPERTIES[this.state.selectedTerrain].color;
    } else if (this.state.currentTool === EditorTool.ERASE) {
      hoverColor = 0xff0000;
    }

    this.hoverGraphics.lineStyle(2, hoverColor, 0.8);
    this.hoverGraphics.beginPath();
    this.hoverGraphics.moveTo(worldPos.x, worldPos.y - halfH);
    this.hoverGraphics.lineTo(worldPos.x + halfW, worldPos.y);
    this.hoverGraphics.lineTo(worldPos.x, worldPos.y + halfH);
    this.hoverGraphics.lineTo(worldPos.x - halfW, worldPos.y);
    this.hoverGraphics.closePath();
    this.hoverGraphics.strokePath();
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.hoverGraphics.destroy();
  }
}

import Phaser from 'phaser';
import { IsometricMap } from '../systems/IsometricMap';
import { EditorState, EditorTool } from './EditorState';
import { HoleData, TileCoord } from '../models/HoleData';
import { TileType } from '../models/TileTypes';
import { TILE_WIDTH, TILE_HEIGHT } from '../utils/Constants';
import { EventBus } from '../utils/EventBus';

export enum HolePlaceStep {
  PLACE_TEE = 'place_tee',
  PLACE_FLAG = 'place_flag',
}

export class HolePlacer {
  private scene: Phaser.Scene;
  private isoMap: IsometricMap;
  private state: EditorState;
  private holes: HoleData[] = [];
  private step: HolePlaceStep = HolePlaceStep.PLACE_TEE;
  private pendingTee: TileCoord | null = null;
  private markerGraphics: Phaser.GameObjects.Graphics;
  private instructionText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, isoMap: IsometricMap, state: EditorState) {
    this.scene = scene;
    this.isoMap = isoMap;
    this.state = state;

    this.markerGraphics = scene.add.graphics();
    this.markerGraphics.setDepth(500);

    this.instructionText = scene.add.text(
      scene.scale.width / 2,
      scene.scale.height - 40,
      '',
      {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#000000cc',
        padding: { x: 10, y: 5 },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(2000).setVisible(false);

    scene.input.on('pointerdown', this.onPointerDown, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.rightButtonDown() || pointer.middleButtonDown()) return;
    if (this.state.currentTool !== EditorTool.PLACE_HOLE) return;

    const { tileX, tileY } = this.isoMap.worldToTile(pointer.worldX, pointer.worldY);
    if (!this.isoMap.isInBounds(tileX, tileY)) return;

    if (this.step === HolePlaceStep.PLACE_TEE) {
      const tileType = this.isoMap.getTileAt(tileX, tileY);
      if (tileType !== TileType.TEE) {
        EventBus.emit('show-message', 'Tee must be on a Tee tile! (Paint one with key 7)');
        return;
      }
      this.pendingTee = { tileX, tileY };
      this.step = HolePlaceStep.PLACE_FLAG;
      this.updateInstruction();
      this.renderMarkers();
    } else if (this.step === HolePlaceStep.PLACE_FLAG) {
      const tileType = this.isoMap.getTileAt(tileX, tileY);
      if (tileType !== TileType.GREEN) {
        EventBus.emit('show-message', 'Flag must be on a Green tile! (Paint one with key 3)');
        return;
      }
      if (!this.pendingTee) return;

      const hole: HoleData = {
        index: this.holes.length,
        par: 3,
        teePosition: this.pendingTee,
        flagPosition: { tileX, tileY },
      };
      this.holes.push(hole);
      EventBus.emit('hole-placed', hole);

      // Reset
      this.pendingTee = null;
      this.step = HolePlaceStep.PLACE_TEE;
      this.updateInstruction();
      this.renderMarkers();
    }
  }

  update(): void {
    if (this.state.currentTool === EditorTool.PLACE_HOLE) {
      if (!this.instructionText.visible) {
        this.instructionText.setVisible(true);
        this.updateInstruction();
      }
    } else {
      this.instructionText.setVisible(false);
      // Reset if switching away
      if (this.pendingTee) {
        this.pendingTee = null;
        this.step = HolePlaceStep.PLACE_TEE;
        this.renderMarkers();
      }
    }
  }

  private updateInstruction(): void {
    if (this.step === HolePlaceStep.PLACE_TEE) {
      this.instructionText.setText(`Place Hole ${this.holes.length + 1}: Click a TEE tile for tee position`);
    } else {
      this.instructionText.setText(`Place Hole ${this.holes.length + 1}: Click a GREEN tile for flag position`);
    }
  }

  renderMarkers(): void {
    this.markerGraphics.clear();
    const halfW = TILE_WIDTH / 2;

    // Render all placed holes
    for (const hole of this.holes) {
      // Tee marker (white T)
      const teePos = this.isoMap.tileToWorld(hole.teePosition.tileX, hole.teePosition.tileY);
      this.markerGraphics.lineStyle(2, 0xffffff, 1);
      this.markerGraphics.lineBetween(teePos.x - 6, teePos.y - 10, teePos.x + 6, teePos.y - 10);
      this.markerGraphics.lineBetween(teePos.x, teePos.y - 10, teePos.x, teePos.y);

      // Flag marker (red flag on stick)
      const flagPos = this.isoMap.tileToWorld(hole.flagPosition.tileX, hole.flagPosition.tileY);
      this.markerGraphics.lineStyle(2, 0x333333, 1);
      this.markerGraphics.lineBetween(flagPos.x, flagPos.y, flagPos.x, flagPos.y - 16);
      this.markerGraphics.fillStyle(0xff0000, 1);
      this.markerGraphics.fillTriangle(
        flagPos.x, flagPos.y - 16,
        flagPos.x + 10, flagPos.y - 12,
        flagPos.x, flagPos.y - 8
      );

      // Hole number
      // Use a small circle to mark the hole
      this.markerGraphics.fillStyle(0x000000, 0.7);
      this.markerGraphics.fillCircle(flagPos.x, flagPos.y + 4, 6);
    }

    // Render pending tee
    if (this.pendingTee) {
      const teePos = this.isoMap.tileToWorld(this.pendingTee.tileX, this.pendingTee.tileY);
      this.markerGraphics.lineStyle(2, 0x00ff00, 1);
      this.markerGraphics.strokeCircle(teePos.x, teePos.y, 8);
    }
  }

  getHoles(): HoleData[] {
    return [...this.holes];
  }

  setHoles(holes: HoleData[]): void {
    this.holes = [...holes];
    this.renderMarkers();
  }

  removeLastHole(): HoleData | undefined {
    const hole = this.holes.pop();
    this.renderMarkers();
    return hole;
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.markerGraphics.destroy();
    this.instructionText.destroy();
  }
}

import { TileType } from '../models/TileTypes';
import { IsometricMap } from '../systems/IsometricMap';

export enum EditorTool {
  PAINT_TERRAIN = 'paint_terrain',
  ERASE = 'erase',
  PLACE_HOLE = 'place_hole',
  RAISE_TERRAIN = 'raise_terrain',
  LOWER_TERRAIN = 'lower_terrain',
}

export interface EditorAction {
  type: 'tile_change' | 'hole_place' | 'hole_remove' | 'elevation_change';
  data: TileChangeData | ElevationChangeData | unknown;
}

interface TileChangeData {
  tileX: number;
  tileY: number;
  oldType: TileType;
  newType: TileType;
}

interface ElevationChangeData {
  tileX: number;
  tileY: number;
  oldElevation: number;
  newElevation: number;
}

export class EditorState {
  currentTool: EditorTool = EditorTool.PAINT_TERRAIN;
  selectedTerrain: TileType = TileType.FAIRWAY;
  brushSize = 1;

  private undoStack: EditorAction[] = [];
  private redoStack: EditorAction[] = [];

  pushAction(action: EditorAction): void {
    this.undoStack.push(action);
    this.redoStack.length = 0;
  }

  undo(map: IsometricMap): void {
    const action = this.undoStack.pop();
    if (!action) return;

    if (action.type === 'tile_change') {
      const data = action.data as TileChangeData;
      map.setTileAt(data.tileX, data.tileY, data.oldType);
    }
    if (action.type === 'elevation_change') {
      const data = action.data as ElevationChangeData;
      map.setElevationAt(data.tileX, data.tileY, data.oldElevation);
    }
    this.redoStack.push(action);
  }

  redo(map: IsometricMap): void {
    const action = this.redoStack.pop();
    if (!action) return;

    if (action.type === 'tile_change') {
      const data = action.data as TileChangeData;
      map.setTileAt(data.tileX, data.tileY, data.newType);
    }
    if (action.type === 'elevation_change') {
      const data = action.data as ElevationChangeData;
      map.setElevationAt(data.tileX, data.tileY, data.newElevation);
    }
    this.undoStack.push(action);
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}

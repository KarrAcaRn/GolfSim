import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorState, EditorTool } from '../src/editor/EditorState';
import { TileType } from '../src/models/TileTypes';

// Minimal IsometricMap mock
function createMockMap() {
  return {
    setTileAt: vi.fn(),
    setCornerElevation: vi.fn(),
  } as any;
}

describe('EditorState', () => {
  let state: EditorState;
  let mockMap: ReturnType<typeof createMockMap>;

  beforeEach(() => {
    state = new EditorState();
    mockMap = createMockMap();
  });

  it('defaults to PAINT_TERRAIN tool', () => {
    expect(state.currentTool).toBe(EditorTool.PAINT_TERRAIN);
  });

  it('starts with empty undo/redo stacks', () => {
    expect(state.canUndo()).toBe(false);
    expect(state.canRedo()).toBe(false);
  });

  describe('tile change undo/redo', () => {
    it('undoes a tile change', () => {
      state.pushAction({
        type: 'tile_change',
        data: { tileX: 5, tileY: 5, oldType: TileType.GRASS, newType: TileType.WATER },
      });

      expect(state.canUndo()).toBe(true);
      state.undo(mockMap);
      expect(mockMap.setTileAt).toHaveBeenCalledWith(5, 5, TileType.GRASS);
    });

    it('redoes a tile change', () => {
      state.pushAction({
        type: 'tile_change',
        data: { tileX: 5, tileY: 5, oldType: TileType.GRASS, newType: TileType.WATER },
      });

      state.undo(mockMap);
      expect(state.canRedo()).toBe(true);
      state.redo(mockMap);
      expect(mockMap.setTileAt).toHaveBeenCalledWith(5, 5, TileType.WATER);
    });
  });

  describe('elevation change undo/redo', () => {
    it('undoes an elevation change using cornerX/cornerY', () => {
      state.pushAction({
        type: 'elevation_change',
        data: { cornerX: 3, cornerY: 4, oldElevation: 0, newElevation: 2 },
      });

      state.undo(mockMap);
      expect(mockMap.setCornerElevation).toHaveBeenCalledWith(3, 4, 0);
    });

    it('redoes an elevation change', () => {
      state.pushAction({
        type: 'elevation_change',
        data: { cornerX: 3, cornerY: 4, oldElevation: 0, newElevation: 2 },
      });

      state.undo(mockMap);
      state.redo(mockMap);
      expect(mockMap.setCornerElevation).toHaveBeenCalledWith(3, 4, 2);
    });
  });

  describe('stack behavior', () => {
    it('clears redo stack on new action', () => {
      state.pushAction({
        type: 'tile_change',
        data: { tileX: 0, tileY: 0, oldType: TileType.GRASS, newType: TileType.SAND },
      });
      state.undo(mockMap);
      expect(state.canRedo()).toBe(true);

      // New action should clear redo
      state.pushAction({
        type: 'tile_change',
        data: { tileX: 1, tileY: 1, oldType: TileType.GRASS, newType: TileType.FAIRWAY },
      });
      expect(state.canRedo()).toBe(false);
    });

    it('handles multiple undo/redo', () => {
      state.pushAction({
        type: 'elevation_change',
        data: { cornerX: 0, cornerY: 0, oldElevation: 0, newElevation: 1 },
      });
      state.pushAction({
        type: 'elevation_change',
        data: { cornerX: 0, cornerY: 0, oldElevation: 1, newElevation: 2 },
      });

      expect(state.canUndo()).toBe(true);
      state.undo(mockMap); // undo second
      state.undo(mockMap); // undo first
      expect(state.canUndo()).toBe(false);
      expect(state.canRedo()).toBe(true);
    });

    it('does nothing on undo with empty stack', () => {
      state.undo(mockMap);
      expect(mockMap.setTileAt).not.toHaveBeenCalled();
      expect(mockMap.setCornerElevation).not.toHaveBeenCalled();
    });
  });
});

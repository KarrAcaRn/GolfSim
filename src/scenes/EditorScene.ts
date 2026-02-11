import Phaser from 'phaser';
import { IsometricMap } from '../systems/IsometricMap';
import { CameraController } from '../systems/CameraController';
import { EditorState, EditorTool } from '../editor/EditorState';
import { TilePlacer } from '../editor/TilePlacer';
import { HolePlacer } from '../editor/HolePlacer';
import { ElevationPlacer } from '../editor/ElevationPlacer';
import { TileType } from '../models/TileTypes';
import { CourseData, createEmptyCourse } from '../models/CourseData';
import { MAP_WIDTH, MAP_HEIGHT } from '../utils/Constants';
import { EventBus } from '../utils/EventBus';
import { CourseStorage } from '../storage/CourseStorage';
import { t } from '../i18n/i18n';

export class EditorScene extends Phaser.Scene {
  private isoMap!: IsometricMap;
  private cameraController!: CameraController;
  private editorState!: EditorState;
  private tilePlacer!: TilePlacer;
  private holePlacer!: HolePlacer;
  private elevationPlacer!: ElevationPlacer;
  private courseData!: CourseData;

  constructor() {
    super({ key: 'Editor' });
  }

  create(data: { courseData?: CourseData }): void {
    this.courseData = data.courseData ?? createEmptyCourse(MAP_WIDTH, MAP_HEIGHT);

    // Create the isometric map
    this.isoMap = new IsometricMap(this, this.courseData.width, this.courseData.height);
    this.isoMap.loadFromData(this.courseData);

    // Camera setup
    const bounds = this.isoMap.getWorldBounds();
    this.cameras.main.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    const center = this.isoMap.tileToWorld(
      Math.floor(this.courseData.width / 2),
      Math.floor(this.courseData.height / 2)
    );
    this.cameras.main.centerOn(center.x, center.y);

    this.cameraController = new CameraController(this);

    // Editor state, tile placer, hole placer
    this.editorState = new EditorState();
    this.tilePlacer = new TilePlacer(this, this.isoMap, this.editorState);
    this.holePlacer = new HolePlacer(this, this.isoMap, this.editorState);
    this.elevationPlacer = new ElevationPlacer(this, this.isoMap, this.editorState);

    // Load existing holes if any
    if (this.courseData.holes.length > 0) {
      this.holePlacer.setHoles(this.courseData.holes);
    }

    // Keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Launch UI overlay
    this.scene.launch('UI', { mode: 'editor' });

    // Listen for UI events
    this.setupEventListeners();
  }

  private setupKeyboardShortcuts(): void {
    const keyboard = this.input.keyboard!;

    keyboard.on('keydown-ONE', () => this.selectTerrain(TileType.GRASS));
    keyboard.on('keydown-TWO', () => this.selectTerrain(TileType.FAIRWAY));
    keyboard.on('keydown-THREE', () => this.selectTerrain(TileType.GREEN));
    keyboard.on('keydown-FOUR', () => this.selectTerrain(TileType.SAND));
    keyboard.on('keydown-FIVE', () => this.selectTerrain(TileType.WATER));
    keyboard.on('keydown-SIX', () => this.selectTerrain(TileType.ROUGH));
    keyboard.on('keydown-SEVEN', () => this.selectTerrain(TileType.TEE));

    keyboard.on('keydown-E', () => {
      this.editorState.currentTool = this.editorState.currentTool === EditorTool.ERASE
        ? EditorTool.PAINT_TERRAIN
        : EditorTool.ERASE;
    });

    keyboard.on('keydown-H', () => {
      this.editorState.currentTool = EditorTool.PLACE_HOLE;
    });

    keyboard.on('keydown-Z', (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.shiftKey) {
          this.editorState.redo(this.isoMap);
        } else {
          this.editorState.undo(this.isoMap);
        }
      }
    });

    keyboard.on('keydown-Y', (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        this.editorState.redo(this.isoMap);
      }
    });

    // Pause
    keyboard.on('keydown-ESC', () => {
      this.scene.pause();
      this.scene.launch('Pause', { callingScene: 'Editor' });
    });
  }

  private setupEventListeners(): void {
    EventBus.on('editor-select-terrain', (type: TileType) => {
      this.selectTerrain(type);
    });

    EventBus.on('editor-select-tool', (tool: EditorTool) => {
      this.editorState.currentTool = tool;
    });

    EventBus.on('editor-play', () => {
      const holes = this.holePlacer.getHoles();
      if (holes.length === 0) {
        EventBus.emit('show-message', t('editor.validation.noHoles'));
        return;
      }
      const courseData = this.getCourseData();
      courseData.holes = holes;
      this.scene.stop('UI');
      this.scene.start('Play', { courseData });
    });

    EventBus.on('editor-save', () => {
      const courseData = this.getCourseData();
      CourseStorage.save(courseData);
      EventBus.emit('show-message', `Course "${courseData.name}" saved!`);
    });

    EventBus.on('editor-load', () => {
      const courses = CourseStorage.listSavedCourses();
      if (courses.length === 0) {
        EventBus.emit('show-message', 'No saved courses found.');
        return;
      }
      // Load the most recently saved course
      const loaded = CourseStorage.load(courses[0]);
      if (loaded) {
        this.scene.stop('UI');
        this.scene.restart({ courseData: loaded });
      }
    });
  }

  private selectTerrain(type: TileType): void {
    this.editorState.selectedTerrain = type;
    this.editorState.currentTool = EditorTool.PAINT_TERRAIN;
  }

  update(_time: number, delta: number): void {
    this.cameraController.update(delta);
    this.holePlacer.update();
  }

  getIsoMap(): IsometricMap {
    return this.isoMap;
  }

  getCourseData(): CourseData {
    const mapData = this.isoMap.exportData();
    return {
      ...this.courseData,
      ...mapData,
      holes: this.holePlacer.getHoles(),
      metadata: {
        ...this.courseData.metadata,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  shutdown(): void {
    EventBus.removeAllListeners();
  }
}

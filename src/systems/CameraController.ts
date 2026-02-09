import Phaser from 'phaser';

const PAN_SPEED = 400;
const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;

export class CameraController {
  private scene: Phaser.Scene;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private dragStart: { x: number; y: number } | null = null;
  private isDragging = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.camera = scene.cameras.main;

    // Keyboard controls
    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Mouse drag (middle or right button)
    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown() || pointer.rightButtonDown()) {
        this.isDragging = true;
        this.dragStart = { x: pointer.x, y: pointer.y };
      }
    });

    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging && this.dragStart) {
        const dx = this.dragStart.x - pointer.x;
        const dy = this.dragStart.y - pointer.y;
        this.camera.scrollX += dx / this.camera.zoom;
        this.camera.scrollY += dy / this.camera.zoom;
        this.dragStart = { x: pointer.x, y: pointer.y };
      }
    });

    scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.middleButtonDown() && !pointer.rightButtonDown()) {
        this.isDragging = false;
        this.dragStart = null;
      }
    });

    // Zoom with mouse wheel
    scene.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: unknown[], _deltaX: number, deltaY: number) => {
      const newZoom = this.camera.zoom - Math.sign(deltaY) * ZOOM_STEP;
      this.camera.setZoom(Phaser.Math.Clamp(newZoom, MIN_ZOOM, MAX_ZOOM));
    });

    // Disable right-click context menu
    scene.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  update(delta: number): void {
    const speed = (PAN_SPEED / this.camera.zoom) * (delta / 1000);

    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      this.camera.scrollX -= speed;
    }
    if (this.cursors.right.isDown || this.wasd.D.isDown) {
      this.camera.scrollX += speed;
    }
    if (this.cursors.up.isDown || this.wasd.W.isDown) {
      this.camera.scrollY -= speed;
    }
    if (this.cursors.down.isDown || this.wasd.S.isDown) {
      this.camera.scrollY += speed;
    }
  }
}

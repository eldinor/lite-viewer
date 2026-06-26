import {
  addToScene,
  attachControl,
  captureScreenshot,
  createDefaultCamera,
  createEngine,
  createHemisphericLight,
  createSceneContext,
  disposeEngine,
  disposeScene,
  loadGltf,
  pauseAnimation,
  playAnimation as playBabylonAnimation,
  registerScene,
  startEngine,
  stopEngine,
  stopAnimation,
  type ArcRotateCamera,
  type AssetContainer,
  type EngineContext,
  type SceneContext,
} from "@babylonjs/lite";
import { DEFAULT_CLEAR_COLOR, WEBGPU_REQUIRED_MESSAGE } from "./defaults.js";
import type {
  LiteViewerAnimationGroup,
  LiteViewerClearColor,
  LiteViewerDetails,
  LiteViewerOptions,
  LiteViewerScreenshot,
  LiteViewerSource,
  ViewerState,
} from "./types.js";

/**
 * Minimal Babylon Lite model viewer for a single canvas.
 *
 * The viewer owns a WebGPU engine, an active scene, and an ArcRotate camera. It
 * loads one model scene at a time: loading a new model disposes the previous
 * scene before creating the next one. Loaded models are framed automatically.
 * No enviironment settings to keep everything minimal as possible.
 * One default light with controlled intensity. ClearColor with alpha channel (use alphaMode: "premultiplied" for transparency).
 */
export class LiteViewer {
  private engine?: EngineContext;
  private scene?: SceneContext;
  private camera?: ArcRotateCamera;
  private animationGroups: LiteViewerAnimationGroup[] = [];
  private state: ViewerState = "idle";
  private running = false;
  private detachCameraControl?: () => void;
  private sceneRegistered = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: LiteViewerOptions = {},
  ) {}

  /**
   * Initializes the WebGPU engine, scene, light, and camera.
   *
   * If `options.source` is provided, the model is loaded before the promise
   * resolves. Rendering starts automatically unless `options.autoStart` is false.
   *
   * @returns Handles for the initialized viewer, canvas, engine, scene, and camera.
   * @throws If WebGPU is unavailable or Babylon Lite initialization fails.
   */
  async initialize(): Promise<LiteViewerDetails> {
    if (this.state === "disposed") {
      throw new Error("Cannot initialize a disposed LiteViewer.");
    }

    if (this.engine && this.scene && this.camera) {
      return this.createDetails();
    }

    this.state = "initializing";

    try {
      this.assertWebGPUSupported();

      const engine = await this.createEngine();
      const scene = createSceneContext(engine);

      this.engine = engine;
      this.scene = scene;
      this.applyClearColor(scene);

      this.addDefaultLight(scene);

      this.state = "ready";

      if (this.options.source) {
        await this.loadModel(this.options.source);
      }

      if (!this.camera) {
        this.createCameraForScene(this.requireScene());
      }
      this.options.onInitialized?.(this.createDetails());

      if (!this.sceneRegistered) {
        await registerScene(this.requireScene());
        this.sceneRegistered = true;
      }

      if (this.options.autoStart !== false) {
        this.start();
      }

      return this.createDetails();
    } catch (error) {
      this.state = "error";
      this.options.onError?.(error);
      this.dispose();
      throw error;
    }
  }

  /**
   * Loads a glTF/GLB model from a URL, `Blob`, or `ArrayBuffer`.
   *
   * When another model is already loaded, the current scene is disposed and a
   * fresh scene is created first. This keeps only one model active at a time.
   * The loaded model is framed automatically before `onLoaded` runs.
   *
   * @param source - Remote URL, application-hosted URL, uploaded file `Blob`, or model `ArrayBuffer`.
   */
  async loadModel(source: LiteViewerSource): Promise<void> {
    this.state = "loading";

    try {
      if (this.sceneRegistered) {
        this.disposeCurrentScene();
        this.createScene();
      }

      const scene = this.requireScene();

      const model = await loadLiteViewerSource(this.requireEngine(), source);
      addToScene(scene, model);

      this.animationGroups = model.animationGroups ?? [];
      if (this.options.autoPlayAnimations === false) {
        this.stopAnimationGroups();
      }

      this.createCameraForScene(scene);

      if (!this.sceneRegistered && this.engine) {
        await registerScene(scene);
        this.sceneRegistered = true;
      }

      this.state = "loaded";
      this.options.onLoaded?.(this.createDetails());
    } catch (error) {
      this.state = "error";
      this.options.onError?.(error);
      throw error;
    }
  }

  /**
   * Returns the current viewer lifecycle state.
   */
  getState(): ViewerState {
    return this.state;
  }

  /**
   * Returns animation groups loaded with the active model.
   */
  getAnimationGroups(): readonly LiteViewerAnimationGroup[] {
    return this.animationGroups;
  }

  /**
   * Stops other loaded animation groups and starts the group with `name`.
   *
   * @throws If no animation group with `name` exists on the active model.
   */
  playAnimationGroup(name: string): LiteViewerAnimationGroup {
    const group = this.animationGroups.find(
      (animation) => animation.name === name,
    );
    if (!group) {
      throw new Error(`Animation group "${name}" was not found.`);
    }

    this.stopAnimationGroups(group);
    playBabylonAnimation(group);
    group.isPlaying = true;
    syncAnimationControllerPlayback(group);
    return group;
  }

  /**
   * Pauses all animation groups loaded with the active model.
   */
  pauseAnimations(): void {
    for (const group of this.animationGroups) {
      pauseAnimation(group);
      group.isPlaying = false;
      pauseAnimationController(group);
    }
  }

  /**
   * Stops all animation groups loaded with the active model.
   */
  stopAnimations(): void {
    this.stopAnimationGroups();
  }

  /**
   * Captures the current viewer canvas.
   *
   * The screenshot data is opaque; Babylon Lite forces alpha to 255 when
   * reading back the presented canvas.
   */
  captureScreenshot(): Promise<LiteViewerScreenshot> {
    return captureScreenshot(this.requireEngine());
  }

  /**
   * Updates the scene clear color.
   *
   * The value is also used for future replacement scenes created by
   * {@link loadModel}.
   */
  setClearColor(color: LiteViewerClearColor): void {
    this.options.clearColor = color;

    if (this.scene) {
      this.scene.clearColor = color;
    }
  }

  /**
   * Starts the Babylon Lite render loop.
   *
   * This is called automatically by {@link initialize} unless `autoStart` is false.
   */
  start(): void {
    if (!this.engine || this.running || this.state === "disposed") return;

    void startEngine(this.engine);
    this.running = true;
  }

  /**
   * Stops the Babylon Lite render loop.
   */
  stop(): void {
    if (!this.engine || !this.running) return;

    stopEngine(this.engine);
    this.running = false;
  }

  /**
   * Stops rendering and disposes the active scene and engine.
   *
   * A disposed viewer cannot be initialized again.
   */
  dispose(): void {
    if (this.state === "disposed") return;

    this.stop();
    this.disposeCurrentScene();
    if (this.engine) {
      disposeEngine(this.engine);
    }

    this.detachCameraControl = undefined;
    this.sceneRegistered = false;
    this.camera = undefined;
    this.scene = undefined;
    this.engine = undefined;
    this.state = "disposed";
  }

  private assertWebGPUSupported(): void {
    const gpu = (globalThis.navigator as NavigatorWithGpu | undefined)?.gpu;
    if (!gpu) {
      throw new Error(WEBGPU_REQUIRED_MESSAGE);
    }
  }

  private createEngine(): Promise<EngineContext> {
    if (!this.options.alphaMode) {
      return createEngine(this.canvas);
    }

    return createEngine(this.canvas, {
      alphaMode: this.options.alphaMode,
    });
  }

  private createDetails(): LiteViewerDetails {
    if (!this.engine || !this.scene || !this.camera) {
      throw new Error("LiteViewer is not initialized.");
    }

    return {
      viewer: this,
      canvas: this.canvas,
      engine: this.engine,
      scene: this.scene,
      camera: this.camera,
    };
  }

  private requireEngine(): EngineContext {
    if (!this.engine) {
      throw new Error("LiteViewer must be initialized before loading models.");
    }

    return this.engine;
  }

  private requireScene(): SceneContext {
    if (!this.scene) {
      throw new Error("LiteViewer must be initialized before loading models.");
    }

    return this.scene;
  }

  private createScene(): SceneContext {
    const scene = createSceneContext(this.requireEngine());
    this.applyClearColor(scene);
    this.addDefaultLight(scene);
    this.scene = scene;
    return scene;
  }

  private applyClearColor(scene: SceneContext): void {
    scene.clearColor = this.options.clearColor ?? DEFAULT_CLEAR_COLOR;
  }

  private addDefaultLight(scene: SceneContext): void {
    addToScene(scene, createHemisphericLight([0, 1, 0], this.options.lightIntensity ?? 1));
  }

  private createCameraForScene(scene: SceneContext): void {
    this.detachCameraControl?.();
    const camera = createDefaultCamera(scene);
    camera.alpha += Math.PI;
    this.camera = camera;
    this.detachCameraControl = attachControl(camera, this.canvas, scene);
  }

  private disposeCurrentScene(): void {
    this.detachCameraControl?.();
    this.detachCameraControl = undefined;

    if (this.scene) {
      disposeScene(this.scene);
    }

    this.scene = undefined;
    this.camera = undefined;
    this.sceneRegistered = false;
    this.animationGroups = [];
  }

  private stopAnimationGroups(except?: LiteViewerAnimationGroup): void {
    for (const group of this.animationGroups) {
      if (group === except) continue;

      stopAnimation(group);
      group.isPlaying = false;
      group.currentTime = 0;
      syncAnimationControllerPlayback(group);
    }
  }
}

type AnimationGroupWithController = LiteViewerAnimationGroup & {
  _ctrl?: {
    playing?: boolean;
    time?: number;
  };
};

function pauseAnimationController(group: LiteViewerAnimationGroup): void {
  const internalGroup = group as AnimationGroupWithController;
  if (!internalGroup._ctrl) return;

  group.currentTime = internalGroup._ctrl.time ?? group.currentTime;
  internalGroup._ctrl.playing = group.isPlaying;
}

function syncAnimationControllerPlayback(group: LiteViewerAnimationGroup): void {
  const internalGroup = group as AnimationGroupWithController;
  if (!internalGroup._ctrl) return;

  internalGroup._ctrl.playing = group.isPlaying;
  internalGroup._ctrl.time = group.currentTime;
}

type NavigatorWithGpu = Navigator & {
  gpu?: unknown;
};

const loadLiteViewerSource = loadGltf as (engine: EngineContext, source: LiteViewerSource) => Promise<AssetContainer>;

import type { ArcRotateCamera, EngineContext, SceneContext } from "@babylonjs/lite";
import type { LiteViewer } from "./LiteViewer.js";

/**
 * Model input accepted by {@link LiteViewer.loadModel}.
 *
 * Use a string for remote or application-hosted glTF/GLB assets. Use `Blob` or
 * `ArrayBuffer` for locally selected files.
 */
export type LiteViewerSource = string | Blob | ArrayBuffer;

/**
 * Scene clear color.
 *
 * Color channels use WebGPU clear-color semantics: `r`, `g`, `b`, and `a` are
 * numeric channel values, usually in the `0` to `1` range.
 */
export type LiteViewerClearColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

/**
 * WebGPU canvas alpha compositing mode.
 *
 * Use `"premultiplied"` when `clearColor.a < 1` should let HTML content behind
 * the canvas show through. Defaults to `"opaque"`.
 */
export type LiteViewerAlphaMode = "opaque" | "premultiplied";

/**
 * Startup and lifecycle options for {@link LiteViewer}.
 */
export type LiteViewerOptions = {
  /**
   * Optional model to load during initialization.
   */
  source?: LiteViewerSource;

  /**
   * Intensity for the default hemispheric light.
   *
   * Defaults to `1`.
   */
  lightIntensity?: number;

  /**
   * Optional scene clear color.
   */
  clearColor?: LiteViewerClearColor;

  /**
   * Canvas alpha compositing mode.
   *
   * Defaults to `"opaque"`.
   */
  alphaMode?: LiteViewerAlphaMode;

  /**
   * Controls whether the render loop starts automatically after initialization.
   *
   * Defaults to `true`. Set this to `false` when you want to call
   * {@link LiteViewer.start} manually.
   */
  autoStart?: boolean;

  /**
   * Called after the engine, scene, and camera are ready.
   */
  onInitialized?: (details: LiteViewerDetails) => void;

  /**
   * Called after a model has been loaded and added to the scene.
   */
  onLoaded?: (details: LiteViewerDetails) => void;

  /**
   * Called when initialization or model loading fails.
   */
  onError?: (error: unknown) => void;
};

/**
 * Handles returned after viewer initialization.
 */
export type LiteViewerDetails = {
  /**
   * The high-level viewer instance.
   */
  viewer: LiteViewer;

  /**
   * Canvas element used for rendering and camera controls.
   */
  canvas: HTMLCanvasElement;

  /**
   * Babylon Lite engine context.
   */
  engine: EngineContext;

  /**
   * Active Babylon Lite scene context.
   */
  scene: SceneContext;

  /**
   * Active ArcRotate camera created by Babylon Lite.
   */
  camera: ArcRotateCamera;
};

/**
 * Internal lifecycle state used by the viewer.
 *
 * This type is exported for diagnostics and advanced integrations, but ordinary
 * applications usually do not need it.
 */
export type ViewerState = "idle" | "initializing" | "ready" | "loading" | "loaded" | "error" | "disposed";

# Functional Lite Viewer Plan

## Goal

Create a second Lite Viewer API that avoids classes and starts with a small bare viewer.

The bare viewer should do only the essential work:

- create a WebGPU engine for one canvas
- create one scene
- add one default light
- create one default camera
- attach camera controls
- load and replace one model at a time
- start, stop, and dispose rendering

Additional capabilities should be exported as separate feature functions. Users import those functions only when they need them.

## API Direction

Use a minimal factory:

```ts
import { createBareLiteViewer } from "@litools/babylon-lite-viewer";

const viewer = await createBareLiteViewer(canvas);

await viewer.loadModel("/models/chair.glb");
viewer.dispose();
```

Add features through separate imports:

```ts
import {
  captureScreenshot,
  createBareLiteViewer,
  setClearColor,
} from "@litools/babylon-lite-viewer";

const viewer = await createBareLiteViewer(canvas, "/models/chair.glb");

setClearColor(viewer, { r: 0.1, g: 0.1, b: 0.12, a: 1 });

const screenshot = await captureScreenshot(viewer);
```

This keeps the default API small and lets bundlers tree-shake unused features.

## Bare Viewer Type

Suggested first type:

```ts
export type BareLiteViewer = {
  readonly canvas: HTMLCanvasElement;
  readonly engine: EngineContext;
  getScene(): SceneContext;
  getCamera(): ArcRotateCamera;
  loadModel(source: LiteViewerSource): Promise<void>;
  start(): void;
  stop(): void;
  dispose(): void;
};
```

Use `getScene()` and `getCamera()` instead of stable `scene` and `camera` properties because model replacement disposes the old scene and creates a new one.

## File Layout

Add the bare viewer first:

```txt
src/createBareLiteViewer.ts
```

Put optional features in small modules:

```txt
src/features/clearColor.ts
src/features/screenshot.ts
src/features/animations.ts
```

Keep shared internal helpers private until there is a real need to expose them:

```txt
src/internal/webgpu.ts
src/internal/animationControllers.ts
```

Do not create an internal folder too early if one file is enough. Start simple and split when duplication appears.

## Phase 1: Bare Viewer

Implement:

```ts
createBareLiteViewer(
  canvas: HTMLCanvasElement,
  source?: LiteViewerSource,
): Promise<BareLiteViewer>
```

Responsibilities:

- validate `HTMLCanvasElement`
- check `navigator.gpu`
- create engine
- create scene
- apply default clear color
- add default hemispheric light
- create default camera
- attach camera controls
- register scene
- start engine
- optionally load an initial model
- return a plain object

Initial imports:

```ts
import {
  addToScene,
  attachControl,
  createDefaultCamera,
  createEngine,
  createHemisphericLight,
  createSceneContext,
  disposeEngine,
  disposeScene,
  loadGltf,
  registerScene,
  startEngine,
  stopEngine,
} from "@babylonjs/lite";
```

## Phase 2: Conservative Model Replacement

We will dispose and recreate the whole scene on each model load.

Reason:

- matches current `LiteViewer` class behavior
- avoids unclear cleanup of scene-level animation hooks
- avoids stale lights, cameras, materials, skeletons, and variants from previous assets
- makes future feature parity easier

`loadModel(source)` should:

- detach old camera controls
- dispose old scene
- create a fresh scene
- apply current clear color
- add default light
- load model with `loadGltf`
- add model to scene
- create and attach a new camera
- register the new scene

Internal state:

```ts
let scene: SceneContext | undefined;
let camera: ArcRotateCamera | undefined;
let detachCameraControl: (() => void) | undefined;
let disposed = false;
let running = false;
```

Use the cleanup function returned by `attachControl()`:

```ts
detachCameraControl = attachControl(camera, canvas, scene);
```

Before scene replacement or dispose:

```ts
detachCameraControl?.();
detachCameraControl = undefined;
```

## Phase 3: Feature Function Pattern

Feature functions should accept the bare viewer as their first argument:

```ts
setClearColor(viewer, color);
captureScreenshot(viewer);
getAnimationGroups(viewer);
playAnimationGroup(viewer, name);
pauseAnimations(viewer);
stopAnimations(viewer);
```

This is the core extension pattern. The user imports only what they need.

Avoid this for the bare viewer:

```ts
viewer.setClearColor(color);
viewer.captureScreenshot();
viewer.playAnimationGroup("Idle");
```

Those methods would make the bare object grow into the same shape as the class.

## Phase 4: Shared Feature State

Some features need state that the bare viewer owns.

Examples:

- current clear color
- animation groups from the active model
- lifecycle/disposed checks
- active scene and engine access

Keep this state inside the bare viewer closure, but expose narrow internal accessors through a symbol or non-documented internal shape if needed.

Suggested internal type:

```ts
type BareLiteViewerInternals = {
  requireEngine(): EngineContext;
  requireScene(): SceneContext;
  requireCamera(): ArcRotateCamera;
  setClearColorValue(color: LiteViewerClearColor): void;
  getAnimationGroupsValue(): readonly LiteViewerAnimationGroup[];
  assertActive(): void;
};
```

Avoid exposing `BareLiteViewerInternals` as public API. Feature functions can use it inside the package.

If TypeScript privacy gets awkward, use a module-local `WeakMap`:

```ts
const viewerInternals = new WeakMap<BareLiteViewer, BareLiteViewerInternals>();
```

Then feature modules can import an internal helper:

```ts
const internals = getBareLiteViewerInternals(viewer);
```

## Phase 5: First Optional Features

Add optional features in this order.

1. Clear color:

```ts
setClearColor(viewer, color);
```

This updates the active scene and stores the value so replacement scenes use it.

2. Screenshot:

```ts
const shot = await captureScreenshot(viewer);
```

This imports `captureScreenshot` from `@babylonjs/lite` only in the screenshot feature module.

3. Animations:

```ts
const groups = getAnimationGroups(viewer);
playAnimationGroup(viewer, "Idle");
pauseAnimations(viewer);
stopAnimations(viewer);
```

This imports animation helpers only in the animation feature module.

## Phase 6: Options

Keep the first factory small:

```ts
createBareLiteViewer(canvas, source?)
```

After the core is stable, consider an options object:

```ts
createBareLiteViewer(canvas, {
  source,
  autoStart,
  alphaMode,
  lightIntensity,
});
```

Add options only when they are needed by a real feature or example.

Recommended option order:

1. `autoStart`
2. `alphaMode`
3. `lightIntensity`

Clear color should remain a feature function at first:

```ts
setClearColor(viewer, color);
```

## Phase 7: Tests

Add tests for the bare viewer:

```txt
tests/createBareLiteViewer.lifecycle.test.ts
```

Test:

- creates engine, scene, light, camera
- attaches camera controls
- registers scene
- starts engine
- loads initial source if provided
- replaces scene on `loadModel`
- detaches old controls on replacement
- disposes scene and engine
- dispose can be called twice
- active operations after dispose are guarded

Add feature tests separately:

```txt
tests/features/clearColor.test.ts
tests/features/screenshot.test.ts
tests/features/animations.test.ts
```

Each feature test should prove that importing and calling the feature works against a `BareLiteViewer`.

## Phase 8: Public Exports

Update:

```txt
src/index.ts
```

Initial exports:

```ts
export { createBareLiteViewer } from "./createBareLiteViewer.js";
export type { BareLiteViewer } from "./types.js";
```

Feature exports are added only when the feature exists:

```ts
export { setClearColor } from "./features/clearColor.js";
export { captureScreenshot } from "./features/screenshot.js";
export {
  getAnimationGroups,
  pauseAnimations,
  playAnimationGroup,
  stopAnimations,
} from "./features/animations.js";
```

Keep the existing class API exported during this work.

## Phase 9: Documentation

Update `README.md` with a new section:

```md
## Bare Functional API
```

Show:

- one import for the bare viewer
- model loading
- cleanup
- optional feature imports

Example:

```ts
import {
  captureScreenshot,
  createBareLiteViewer,
} from "@litools/babylon-lite-viewer";

const viewer = await createBareLiteViewer(canvas, "/models/chair.glb");
const shot = await captureScreenshot(viewer);

viewer.dispose();
```

## Long-Term Direction

The functional API can become the primary implementation over time.

Possible future shape:

- `createBareLiteViewer` owns the real engine/scene lifecycle
- feature functions provide opt-in capabilities
- the existing `LiteViewer` class becomes a compatibility wrapper
- examples migrate gradually to the bare functional API
- class export remains available until a major-version decision

This keeps the package friendly for simple use while still allowing richer viewer behavior through explicit imports.

## Deferred Alternative: Persistent Scene

`@babylonjs/lite` exposes:

```ts
removeFromScene(scene, mesh);
getContainerMeshes(container);
```

So a persistent-scene approach is technically possible.

We are not using it for the first functional viewer because `addToScene(scene, container)` can register scene-level animation callbacks that do not have an obvious public cleanup function. Disposing the whole scene is more conservative and matches the current class.

Revisit persistent scenes only if scene replacement becomes a measured bottleneck or Babylon Lite exposes a full asset-container disposer.


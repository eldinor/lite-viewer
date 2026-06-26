# @litools/babylon-lite-viewer

Minimal canvas-based model viewer built with [`@babylonjs/lite`](https://www.npmjs.com/package/@babylonjs/lite).

The viewer creates a WebGPU Babylon Lite scene, loads one glTF/GLB model at a time, frames it with Babylon Lite's default camera helper, and exposes a small TypeScript API for embedding the viewer in an application.

## Features

- Uses `@babylonjs/lite` only.
- Loads remote `.glb` and `.gltf` URLs.
- Loads local uploaded GLB files as `Blob` or `ArrayBuffer` objects.
- Keeps only one model scene active at a time.
- Frames each loaded model with a default ArcRotate camera.
- Supports an optional scene clear color.
- Includes TypeScript declarations.

## Requirements

This package requires a browser with WebGPU support. If `navigator.gpu` is unavailable, initialization throws an error.

The canvas should have an explicit size through CSS or layout:

```css
#viewer {
  width: 100%;
  height: 100%;
}
```

## Installation

```sh
npm install @litools/babylon-lite-viewer
```

## Basic Usage

```html
<canvas id="viewer"></canvas>
```

```ts
import { createLiteViewerForCanvas } from "@litools/babylon-lite-viewer";

const canvas = document.querySelector("#viewer") as HTMLCanvasElement;

const details = await createLiteViewerForCanvas(canvas, {
  source: "https://playground.babylonjs.com/scenes/BoomBox.glb",
});
```

The returned `details` object contains the viewer instance plus the underlying Babylon Lite `engine`, `scene`, and `camera`.

Use `viewer.getState()` when an integration needs the current lifecycle state.

## Loading Another Model

`loadModel` disposes the current scene and creates a new scene before adding the next model. This keeps only one loaded model active, and the new model is framed automatically.

```ts
await details.viewer.loadModel("/models/chair.glb");
```

## Uploading a Local GLB

`loadModel` also accepts a `Blob` or `ArrayBuffer`, so it can load a GLB file selected by the user.

```html
<input id="file" type="file" accept=".glb,model/gltf-binary" />
```

```ts
const fileInput = document.querySelector("#file") as HTMLInputElement;

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  await details.viewer.loadModel(file);
});
```

## Manual Viewer Construction

Use `LiteViewer` directly when you want to control construction and initialization separately.

```ts
import { LiteViewer } from "@litools/babylon-lite-viewer";

const viewer = new LiteViewer(canvas, {
  autoStart: false,
});

await viewer.initialize();

await viewer.loadModel("/models/model.glb");
viewer.start();
```

## Options

```ts
type LiteViewerOptions = {
  source?: string | Blob | ArrayBuffer;
  lightIntensity?: number;
  clearColor?: LiteViewerClearColor;
  alphaMode?: "opaque" | "premultiplied";
  autoPlayAnimations?: boolean;
  autoStart?: boolean;
  onInitialized?: (details: LiteViewerDetails) => void;
  onLoaded?: (details: LiteViewerDetails) => void;
  onError?: (error: unknown) => void;
};
```

Animation groups returned by `getAnimationGroups()` use the exported
`LiteViewerAnimationGroup` type.

### `source`

Optional model source to load during initialization. It can be a URL string, `Blob`, or `ArrayBuffer`.

### `lightIntensity`

Intensity for the default hemispheric light. Defaults to `1`.

### `clearColor`

Optional scene clear color. Defaults to `DEFAULT_CLEAR_COLOR`.

```ts
clearColor: { r: 0.02, g: 0.02, b: 0.025, a: 1 }
```

Set `alphaMode` to `"premultiplied"` if `clearColor.a < 1` should make the canvas transparent over page content.

Change the clear color after initialization with:

```ts
details.viewer.setClearColor({ r: 0.1, g: 0.1, b: 0.12, a: 1 });
```

### `alphaMode`

Canvas alpha compositing mode. Defaults to `"opaque"`.

### `autoPlayAnimations`

Controls whether loaded glTF animation groups start automatically. Defaults to `true`. Set it to `false` to stop all animation groups after a model is loaded.

### `autoStart`

Controls whether the render loop starts automatically after initialization. It defaults to `true`; set it to `false` when you want to call `viewer.start()` manually.

### Lifecycle Callbacks

- `onInitialized` runs after the engine, scene, and camera are ready.
- `onLoaded` runs after a model is loaded.
- `onError` runs when initialization or model loading fails.

## API

### `createLiteViewerForCanvas(canvas, options?)`

Creates a `LiteViewer`, initializes it, and returns `LiteViewerDetails`.

```ts
const details = await createLiteViewerForCanvas(canvas, options);
```

### `LiteViewer`

```ts
const viewer = new LiteViewer(canvas, options);
```

Methods:

- `initialize()` initializes WebGPU, the engine, scene, light, and camera.
- `loadModel(source)` loads a URL, `Blob`, or `ArrayBuffer` and frames the model automatically.
- `getAnimationGroups()` returns animation groups loaded with the active model.
- `playAnimationGroup(name)` stops other groups and starts the named animation group.
- `pauseAnimations()` pauses all animation groups loaded with the active model.
- `stopAnimations()` stops all animation groups loaded with the active model.
- `captureScreenshot()` captures the current viewer canvas.
- `getState()` returns the current viewer lifecycle state.
- `setClearColor(color)` updates the active scene clear color.
- `start()` starts rendering.
- `stop()` stops rendering.
- `dispose()` disposes the scene and engine.

## Local Development

Install dependencies:

```sh
npm install
```

Run the demo:

```sh
npm run demo
```

Build the package:

```sh
npm run build
```

Run tests:

```sh
npm test
```

Generate API docs:

```sh
npm run docs
```

Check the npm package contents:

```sh
npm pack --dry-run
```

## Demo

The basic canvas demo is in `examples/basic-canvas`. It loads BoomBox by default and includes two more remote samples plus a GLB upload button.

Screenshot capture uses Babylon Lite's canvas readback. Saved screenshots are opaque; transparent canvas alpha is not preserved in the image data.

```sh
npm run demo:basic-canvas
```

## License

No license has been specified yet.

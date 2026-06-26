# Issue Draft For Babylon Lite

## Title

`attachControl` cleanup is not registered with `disposeScene`

## Body

### Summary

In `@babylonjs/lite@1.4.0`, `attachControl(camera, canvas, scene)` returns a cleanup function that removes canvas DOM listeners and its scene `_beforeRender` hook.

The naming can be easy to misread. The call itself attaches the controls immediately:

```ts
const detachCameraControl = attachControl(camera, canvas, scene);
```

In this pattern:

- `attachControl(...)` attaches pointer, wheel, touch, and gesture listeners to the canvas.
- The return value is the opposite operation: a function that detaches those listeners.
- The variable is usually named `detachCameraControl`, `cleanupCameraControl`, or similar because it stores the returned cleanup function.

So the line above means:

```ts
const cleanupFunction = attachControl(camera, canvas, scene);
```

and later:

```ts
cleanupFunction();
```

removes the controls.

However, when a caller passes a `scene`, the cleanup function does not appear to be registered with `scene._disposables`. As a result, calling `disposeScene(scene)` clears scene-owned data, including `_beforeRender`, but does not remove the DOM listeners attached to the canvas by `attachControl`.

This means consumers must remember to call the returned cleanup function separately before or after disposing the scene:

```ts
const detachCameraControl = attachControl(camera, canvas, scene);

// Later:
detachCameraControl();
disposeScene(scene);
```

If they only call:

```ts
disposeScene(scene);
```

the canvas listeners from `attachControl` remain attached.

### Expected Behavior

The expected behavior is that `disposeScene(scene)` disposes everything associated with that scene.

Since `attachControl(camera, canvas, scene)` receives the scene and registers scene-related camera behavior, it is reasonable to expect that disposing the scene also disposes the controls attached for that scene.

In other words, this should be enough:

```ts
attachControl(camera, canvas, scene);

// Later:
disposeScene(scene);
```

Expected result:

- scene resources are disposed
- scene `_beforeRender` hooks are cleared
- camera controls associated with that scene are detached
- canvas event listeners created by `attachControl` are removed

The returned cleanup function is still useful for manually detaching controls before scene disposal, but scene disposal should also be complete on its own.

### Why This Matters

For viewers that replace scenes repeatedly, it is natural to assume that `disposeScene(scene)` cleans up all scene-associated behavior.

Since `attachControl` accepts a `scene` and registers an inertia callback on `scene._beforeRender`, it feels scene-associated. But part of its cleanup lives outside the scene, on the canvas.

This can lead to:

- stale pointer/wheel/touch listeners on the canvas
- duplicate camera input handling after repeated scene replacement
- retained references to disposed cameras/scenes
- subtle memory leaks

### Observed Implementation

Installed package:

```txt
@babylonjs/lite@1.4.0
```

Package metadata:

```json
{
  "babylonLiteRelease": {
    "azureBuildId": "55198",
    "sourceVersion": "9a6619e6ab55aa579c025bc06a78ae33a7e6199f"
  }
}
```

`attachControl` adds canvas event listeners and returns a cleanup function:

```js
for (const [ev, h, opts] of listeners) {
  canvas.addEventListener(ev, h, opts);
}

return () => {
  if (scene) {
    const idx = scene._beforeRender.indexOf(applyInertia);
    if (idx >= 0) {
      scene._beforeRender.splice(idx, 1);
    }
  }

  for (const [ev, h] of listeners) {
    canvas.removeEventListener(ev, h);
  }
};
```

`disposeScene` clears scene arrays and disposables:

```js
for (const fn of ctx._disposables) {
  fn();
}

ctx._beforeRender.length = 0;
ctx._disposables.length = 0;
ctx.lights.length = 0;
ctx.animationGroups.length = 0;
ctx.camera = null;
```

But `attachControl` does not appear to push its returned cleanup into `scene._disposables`.

### Question

Would the Babylon Lite team consider registering the `attachControl` cleanup with the scene when a scene is provided?

For example, conceptually:

```ts
const dispose = () => {
  removeBeforeRenderHook();
  removeCanvasListeners();
};

if (scene) {
  onSceneDispose(scene, dispose);
}

return dispose;
```

The returned cleanup function should probably remain available for explicit early detach, but `disposeScene(scene)` would also clean up the canvas listeners automatically.

### Possible Compatibility Concern

The cleanup would need to be idempotent. If consumers already call both:

```ts
detachCameraControl();
disposeScene(scene);
```

then registering the cleanup with the scene should not remove listeners twice in an unsafe way.

### Current Workaround

Consumers should store and call the returned function:

```ts
let detachCameraControl: (() => void) | undefined;

detachCameraControl = attachControl(camera, canvas, scene);

// On scene replacement or viewer dispose:
detachCameraControl?.();
detachCameraControl = undefined;
disposeScene(scene);
```

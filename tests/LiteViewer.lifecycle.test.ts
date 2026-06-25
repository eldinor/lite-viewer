import { beforeEach, describe, expect, it, vi } from "vitest";

const createEngine = vi.fn();
const createSceneContext = vi.fn();
const createDefaultCamera = vi.fn();
const createHemisphericLight = vi.fn();
const attachControl = vi.fn();
const registerScene = vi.fn();
const loadGltf = vi.fn();
const addToScene = vi.fn();
const startEngine = vi.fn();
const stopEngine = vi.fn();
const disposeScene = vi.fn();
const disposeEngine = vi.fn();

vi.mock("@babylonjs/lite", () => ({
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
}));

describe("LiteViewer lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    createEngine.mockReset();
    createSceneContext.mockReset();
    createDefaultCamera.mockReset();
    createHemisphericLight.mockReset();
    attachControl.mockReset();
    registerScene.mockReset();
    loadGltf.mockReset();
    addToScene.mockClear();
    startEngine.mockClear();
    stopEngine.mockClear();
    disposeScene.mockClear();
    disposeEngine.mockClear();

    createEngine.mockResolvedValue({ engine: true });
    createSceneContext.mockImplementation(() => ({
      clearColor: { r: 0, g: 0, b: 0, a: 1 },
      camera: null,
      lights: [],
      meshes: [],
    }));
    createDefaultCamera.mockReturnValue({
      target: { x: 0, y: 0, z: 0 },
      radius: 5,
      fov: Math.PI / 4,
      alpha: 1,
      beta: 1,
    });
    createHemisphericLight.mockReturnValue({ lightType: "hemispheric" });
    attachControl.mockReturnValue(vi.fn());
    registerScene.mockResolvedValue(undefined);

    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: {},
    });
  });

  it("viewer initializes", async () => {
    const { LiteViewer } = await import("../src/LiteViewer.js");
    const viewer = new LiteViewer(document.createElement("canvas"));

    expect(viewer.getState()).toBe("idle");

    const details = await viewer.initialize();

    expect(details.viewer).toBe(viewer);
    expect(viewer.getState()).toBe("ready");
    expect(createEngine).toHaveBeenCalledWith(details.canvas);
    expect(createDefaultCamera).toHaveBeenCalledOnce();
    expect(createHemisphericLight).toHaveBeenCalledWith([0, 1, 0], 1);
    expect(registerScene).toHaveBeenCalledOnce();
    expect(startEngine).toHaveBeenCalledOnce();
  });

  it("can set default light intensity", async () => {
    const { LiteViewer } = await import("../src/LiteViewer.js");
    const viewer = new LiteViewer(document.createElement("canvas"), {
      lightIntensity: 0.45,
    });

    await viewer.initialize();

    expect(createHemisphericLight).toHaveBeenCalledWith([0, 1, 0], 0.45);
  });

  it("passes alphaMode to the engine", async () => {
    const { LiteViewer } = await import("../src/LiteViewer.js");
    const canvas = document.createElement("canvas");
    const viewer = new LiteViewer(canvas, {
      alphaMode: "premultiplied",
    });

    await viewer.initialize();

    expect(createEngine).toHaveBeenCalledWith(canvas, {
      alphaMode: "premultiplied",
    });
  });

  it("applies the default clear color", async () => {
    const { DEFAULT_CLEAR_COLOR, LiteViewer } = await import("../src/index.js");
    const viewer = new LiteViewer(document.createElement("canvas"));

    const details = await viewer.initialize();

    expect(details.scene.clearColor).toBe(DEFAULT_CLEAR_COLOR);
  });

  it("can disable automatic start", async () => {
    const { LiteViewer } = await import("../src/LiteViewer.js");
    const viewer = new LiteViewer(document.createElement("canvas"), {
      autoStart: false,
    });

    await viewer.initialize();

    expect(startEngine).not.toHaveBeenCalled();
  });

  it("loadModel can be called", async () => {
    const model = {
      entities: [createMesh()],
    };
    loadGltf.mockResolvedValueOnce(model);
    const { LiteViewer } = await import("../src/LiteViewer.js");
    const viewer = new LiteViewer(document.createElement("canvas"));

    await viewer.initialize();
    await viewer.loadModel("/models/box.glb");

    expect(loadGltf).toHaveBeenCalledWith(
      expect.anything(),
      "/models/box.glb",
    );
    expect(addToScene).toHaveBeenCalledWith(expect.anything(), model);
    expect(disposeScene).toHaveBeenCalledOnce();
    expect(createDefaultCamera).toHaveBeenCalledTimes(2);
    expect(createHemisphericLight).toHaveBeenCalledTimes(2);
    expect(viewer.getState()).toBe("loaded");
  });

  it("applies clearColor when provided", async () => {
    const { LiteViewer } = await import("../src/LiteViewer.js");
    const clearColor = { r: 0.1, g: 0.2, b: 0.3, a: 1 };
    const viewer = new LiteViewer(document.createElement("canvas"), {
      clearColor,
    });

    const details = await viewer.initialize();

    expect(details.scene.clearColor).toBe(clearColor);
  });

  it("setClearColor updates the active scene", async () => {
    const { LiteViewer } = await import("../src/LiteViewer.js");
    const clearColor = { r: 0.4, g: 0.3, b: 0.2, a: 0.5 };
    const viewer = new LiteViewer(document.createElement("canvas"));

    const details = await viewer.initialize();
    viewer.setClearColor(clearColor);

    expect(details.scene.clearColor).toBe(clearColor);
  });

  it("applies clearColor to replacement scenes", async () => {
    const model = {
      entities: [createMesh()],
    };
    const clearColor = { r: 0.1, g: 0.2, b: 0.3, a: 1 };
    loadGltf.mockResolvedValueOnce(model);
    const { LiteViewer } = await import("../src/LiteViewer.js");
    const viewer = new LiteViewer(document.createElement("canvas"), {
      clearColor,
    });

    await viewer.initialize();
    await viewer.loadModel("/models/box.glb");

    expect(createSceneContext).toHaveReturnedTimes(2);
    expect(createSceneContext.mock.results[1]?.value.clearColor).toBe(
      clearColor,
    );
  });

  it("setClearColor applies to replacement scenes", async () => {
    const model = {
      entities: [createMesh()],
    };
    const clearColor = { r: 0.4, g: 0.3, b: 0.2, a: 0.5 };
    loadGltf.mockResolvedValueOnce(model);
    const { LiteViewer } = await import("../src/LiteViewer.js");
    const viewer = new LiteViewer(document.createElement("canvas"));

    await viewer.initialize();
    viewer.setClearColor(clearColor);
    await viewer.loadModel("/models/box.glb");

    expect(createSceneContext.mock.results[1]?.value.clearColor).toBe(
      clearColor,
    );
  });

  it("dispose can be called twice safely", async () => {
    const { LiteViewer } = await import("../src/LiteViewer.js");
    const viewer = new LiteViewer(document.createElement("canvas"));

    await viewer.initialize();

    expect(() => {
      viewer.dispose();
      viewer.dispose();
    }).not.toThrow();
    expect(viewer.getState()).toBe("disposed");
  });

  it("errors call onError", async () => {
    const error = new Error("load failed");
    const onError = vi.fn();
    loadGltf.mockRejectedValueOnce(error);
    const { LiteViewer } = await import("../src/LiteViewer.js");
    const viewer = new LiteViewer(document.createElement("canvas"), { onError });

    await viewer.initialize();
    await expect(viewer.loadModel("broken.glb")).rejects.toThrow("load failed");

    expect(onError).toHaveBeenCalledWith(error);
  });
});

function createMesh() {
  return {
    name: "mesh",
    visible: true,
    children: [],
    material: {},
    boundMin: [-1, -1, -1],
    boundMax: [1, 1, 1],
  };
}

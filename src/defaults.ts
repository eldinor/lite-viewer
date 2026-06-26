import type { LiteViewerClearColor } from "./types.js";

export const DEFAULT_CLEAR_COLOR: LiteViewerClearColor = {
  r: 0.2,
  g: 0.2,
  b: 0.3,
  a: 1,
};

export const WEBGPU_REQUIRED_MESSAGE =
  "This viewer requires WebGPU. Please use a browser with WebGPU support.";

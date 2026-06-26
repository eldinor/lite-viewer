import { createLiteViewerForCanvas, type LiteViewerScreenshot } from "../../src/index.js";

const canvas = document.querySelector("#viewer") as HTMLCanvasElement;
const loading = document.querySelector("#loading") as HTMLElement;
const error = document.querySelector("#error") as HTMLElement;
const model = document.querySelector("#model") as HTMLSelectElement;
const file = document.querySelector("#file") as HTMLInputElement;
const upload = document.querySelector("#upload") as HTMLButtonElement;
const clearColor = document.querySelector("#clear-color") as HTMLInputElement;
const clearAlpha = document.querySelector("#clear-alpha") as HTMLInputElement;
const animation = document.querySelector("#animation") as HTMLSelectElement;
const pauseAnimation = document.querySelector("#pause-animation") as HTMLButtonElement;
const stopAnimation = document.querySelector("#stop-animation") as HTMLButtonElement;
const screenshot = document.querySelector("#screenshot") as HTMLButtonElement;
const screenshotPreview = document.querySelector("#screenshot-preview") as HTMLElement;
const screenshotImage = document.querySelector("#screenshot-image") as HTMLImageElement;
const downloadScreenshot = document.querySelector("#download-screenshot") as HTMLAnchorElement;
let animationsPaused = false;
let screenshotUrl: string | undefined;

function hexToRgb(value: string) {
  const hex = value.replace("#", "");
  return {
    r: Number.parseInt(hex.slice(0, 2), 16) / 255,
    g: Number.parseInt(hex.slice(2, 4), 16) / 255,
    b: Number.parseInt(hex.slice(4, 6), 16) / 255,
  };
}

function getClearColor() {
  return {
    ...hexToRgb(clearColor.value),
    a: Number(clearAlpha.value),
  };
}

function setLoading(message: string) {
  loading.hidden = false;
  loading.textContent = message;
  error.hidden = true;
}

function showError(err: unknown) {
  loading.hidden = true;
  error.hidden = false;
  error.textContent = err instanceof Error ? err.message : String(err);
}

function screenshotToBlob(shot: LiteViewerScreenshot): Promise<Blob> {
  const output = document.createElement("canvas");
  output.width = shot.width;
  output.height = shot.height;

  const context = output.getContext("2d");
  if (!context) {
    throw new Error("Could not create screenshot canvas.");
  }

  context.putImageData(new ImageData(shot.data, shot.width, shot.height), 0, 0);

  return new Promise((resolve, reject) => {
    output.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Could not encode screenshot."));
      }
    }, "image/png");
  });
}

setLoading("Loading...");

const details = await createLiteViewerForCanvas(canvas, {
  source: model.value,
  // clearColor: getClearColor(),
  alphaMode: "premultiplied",
  onLoaded: () => {
    loading.hidden = true;
  },
  onError: showError,
});

function updateAnimationGroups() {
  const groups = details.viewer.getAnimationGroups();
  animationsPaused = false;
  pauseAnimation.textContent = "Pause";

  animation.replaceChildren();

  if (groups.length === 0) {
    animation.append(new Option("No animations", ""));
    animation.disabled = true;
    pauseAnimation.disabled = true;
    stopAnimation.disabled = true;
    return;
  }

  for (const group of groups) {
    animation.append(new Option(group.name, group.name));
  }

  animation.disabled = false;
  pauseAnimation.disabled = false;
  stopAnimation.disabled = false;
  const playingGroup = groups.find((group) => group.isPlaying);
  animation.value = playingGroup?.name ?? groups[0]?.name ?? "";
}

function applyClearColor() {
  details.viewer.setClearColor(getClearColor());
}

updateAnimationGroups();

model.addEventListener("change", async () => {
  try {
    setLoading("Loading...");
    await details.viewer.loadModel(model.value);
    updateAnimationGroups();
    loading.hidden = true;
  } catch (err) {
    showError(err);
  }
});

upload.addEventListener("click", () => {
  file.click();
});

file.addEventListener("change", async () => {
  const selectedFile = file.files?.[0];
  if (!selectedFile) return;

  try {
    setLoading(`Loading ${selectedFile.name}...`);

    await details.viewer.loadModel(selectedFile);
    updateAnimationGroups();
    loading.hidden = true;
    file.value = "";
  } catch (err) {
    showError(err);
  }
});

clearColor.addEventListener("input", applyClearColor);
clearAlpha.addEventListener("input", applyClearColor);

animation.addEventListener("change", () => {
  if (!animation.value) return;

  try {
    details.viewer.playAnimationGroup(animation.value);
    animationsPaused = false;
    pauseAnimation.textContent = "Pause";
  } catch (err) {
    showError(err);
  }
});

pauseAnimation.addEventListener("click", () => {
  if (animationsPaused) {
    if (!animation.value) return;

    try {
      details.viewer.playAnimationGroup(animation.value);
      animationsPaused = false;
      pauseAnimation.textContent = "Pause";
    } catch (err) {
      showError(err);
    }
    return;
  }

  details.viewer.pauseAnimations();
  animationsPaused = true;
  pauseAnimation.textContent = "Play";
});

stopAnimation.addEventListener("click", () => {
  details.viewer.stopAnimations();
  animationsPaused = true;
  pauseAnimation.textContent = "Play";
});

screenshot.addEventListener("click", async () => {
  try {
    screenshot.disabled = true;
    const shot = await details.viewer.captureScreenshot();
    const blob = await screenshotToBlob(shot);

    if (screenshotUrl) {
      URL.revokeObjectURL(screenshotUrl);
    }

    screenshotUrl = URL.createObjectURL(blob);
    screenshotImage.src = screenshotUrl;
    downloadScreenshot.href = screenshotUrl;
    screenshotPreview.hidden = false;
  } catch (err) {
    showError(err);
  } finally {
    screenshot.disabled = false;
  }
});

import { createLiteViewerForCanvas } from "../../src/index.js";

const canvas = document.querySelector("#viewer") as HTMLCanvasElement;
const loading = document.querySelector("#loading") as HTMLElement;
const error = document.querySelector("#error") as HTMLElement;
const model = document.querySelector("#model") as HTMLSelectElement;
const load = document.querySelector("#load") as HTMLButtonElement;
const file = document.querySelector("#file") as HTMLInputElement;
const upload = document.querySelector("#upload") as HTMLButtonElement;

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

setLoading("Loading...");

const details = await createLiteViewerForCanvas(canvas, {
  source: model.value,
  clearColor: { r: 0.02, g: 0.02, b: 0.5, a: 0.2 },
  alphaMode: "premultiplied",
  onLoaded: () => {
    loading.hidden = true;
  },
  onError: showError,
});

load.addEventListener("click", async () => {
  try {
    setLoading("Loading...");
    await details.viewer.loadModel(model.value);
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
    loading.hidden = true;
    file.value = "";
  } catch (err) {
    showError(err);
  }
});

export type AiBackgroundMode = "dark" | "light";

type BackgroundConfig = {
  mode: AiBackgroundMode;
  css: string;
  rgb: [number, number, number];
  tolerance: number;
  feather: number;
};

export type PreparedAiPayload = {
  imageBase64: string;
  region: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  background: BackgroundConfig;
};

const DARK_BACKGROUND: BackgroundConfig = {
  mode: "dark",
  css: "#0d0f17",
  rgb: [13, 15, 23],
  tolerance: 52,
  feather: 36,
};

const LIGHT_BACKGROUND: BackgroundConfig = {
  mode: "light",
  css: "#ffffff",
  rgb: [255, 255, 255],
  tolerance: 26,
  feather: 24,
};

const MAX_IMAGE_SIDE = 768;

const MASK_EXPANSION_RATIO = 0.018;

const getBackgroundConfig = (whiteboard: boolean): BackgroundConfig =>
  whiteboard ? LIGHT_BACKGROUND : DARK_BACKGROUND;

const getColorDistance = (
  red: number,
  green: number,
  blue: number,
  [targetRed, targetGreen, targetBlue]: [number, number, number]
) => Math.hypot(red - targetRed, green - targetGreen, blue - targetBlue);

const isDrawingPixel = (
  data: Uint8ClampedArray,
  index: number,
  background: BackgroundConfig
) => {
  const alpha = data[index + 3];
  if (alpha < 12) return false;

  if (background.mode === "dark") {
    return true;
  }

  return (
    getColorDistance(data[index], data[index + 1], data[index + 2], background.rgb) > 18
  );
};

export function prepareAiPayload(
  canvas: HTMLCanvasElement,
  whiteboard: boolean
): PreparedAiPayload | null {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  const { width, height } = canvas;
  const background = getBackgroundConfig(whiteboard);
  const { data } = context.getImageData(0, 0, width, height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (!isDrawingPixel(data, index, background)) continue;

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0 || maxY < 0) return null;

  const contentWidth = maxX - minX + 1;
  const contentHeight = maxY - minY + 1;
  const padding = Math.max(18, Math.round(Math.max(contentWidth, contentHeight) * 0.1));

  const x = Math.max(0, minX - padding);
  const y = Math.max(0, minY - padding);
  const croppedWidth = Math.min(width - x, contentWidth + padding * 2);
  const croppedHeight = Math.min(height - y, contentHeight + padding * 2);

  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(croppedWidth, croppedHeight));
  const outputWidth = Math.max(1, Math.round(croppedWidth * scale));
  const outputHeight = Math.max(1, Math.round(croppedHeight * scale));

  const payloadCanvas = document.createElement("canvas");
  payloadCanvas.width = outputWidth;
  payloadCanvas.height = outputHeight;

  const payloadContext = payloadCanvas.getContext("2d");
  if (!payloadContext) return null;

  payloadContext.fillStyle = background.css;
  payloadContext.fillRect(0, 0, outputWidth, outputHeight);
  payloadContext.drawImage(
    canvas,
    x,
    y,
    croppedWidth,
    croppedHeight,
    0,
    0,
    outputWidth,
    outputHeight
  );

  return {
    imageBase64: payloadCanvas.toDataURL("image/jpeg", whiteboard ? 0.9 : 0.84),
    region: {
      x,
      y,
      width: croppedWidth,
      height: croppedHeight,
    },
    background,
  };
}

export function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load AI image result."));
    image.src = src;
  });
}

export function createTransparentAiLayer(
  image: HTMLImageElement,
  background: PreparedAiPayload["background"],
  sourceCanvas?: HTMLCanvasElement,
  region?: PreparedAiPayload["region"]
) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not prepare AI layer.");

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha === 0) continue;

    const distance = getColorDistance(
      data[index],
      data[index + 1],
      data[index + 2],
      background.rgb
    );

    if (distance <= background.tolerance) {
      data[index + 3] = 0;
      continue;
    }

    if (distance < background.tolerance + background.feather) {
      const ratio = (distance - background.tolerance) / background.feather;
      data[index + 3] = Math.round(alpha * ratio);
    }
  }

  if (sourceCanvas && region) {
    const maskCanvas = createExpandedDrawingMask(sourceCanvas, region, canvas.width, canvas.height, background);

    context.save();
    context.globalCompositeOperation = "destination-in";
    context.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
    context.restore();
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

function createExpandedDrawingMask(
  sourceCanvas: HTMLCanvasElement,
  region: PreparedAiPayload["region"],
  outputWidth: number,
  outputHeight: number,
  background: PreparedAiPayload["background"]
) {
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = outputWidth;
  maskCanvas.height = outputHeight;

  const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true });
  if (!maskContext) return maskCanvas;

  maskContext.drawImage(
    sourceCanvas,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    outputWidth,
    outputHeight
  );

  const maskImageData = maskContext.getImageData(0, 0, outputWidth, outputHeight);
  const { data } = maskImageData;

  for (let index = 0; index < data.length; index += 4) {
    const drawn = isDrawingPixel(data, index, background);
    data[index] = 255;
    data[index + 1] = 255;
    data[index + 2] = 255;
    data[index + 3] = drawn ? 255 : 0;
  }

  maskContext.putImageData(maskImageData, 0, 0);

  const expandedMaskCanvas = document.createElement("canvas");
  expandedMaskCanvas.width = outputWidth;
  expandedMaskCanvas.height = outputHeight;

  const expandedMaskContext = expandedMaskCanvas.getContext("2d");
  if (!expandedMaskContext) return maskCanvas;

  const expansionRadius = Math.max(
    4,
    Math.round(Math.max(outputWidth, outputHeight) * MASK_EXPANSION_RATIO)
  );

  expandedMaskContext.globalAlpha = 0.14;

  for (let offsetX = -expansionRadius; offsetX <= expansionRadius; offsetX += 2) {
    for (let offsetY = -expansionRadius; offsetY <= expansionRadius; offsetY += 2) {
      if (offsetX * offsetX + offsetY * offsetY > expansionRadius * expansionRadius) continue;
      expandedMaskContext.drawImage(maskCanvas, offsetX, offsetY);
    }
  }

  expandedMaskContext.globalAlpha = 1;
  expandedMaskContext.drawImage(maskCanvas, 0, 0);

  return expandedMaskCanvas;
}
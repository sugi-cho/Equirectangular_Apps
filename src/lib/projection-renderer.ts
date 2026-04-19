import type { StoryboardLayer, StoryboardScene, Vec3 } from "./types";
import {
  addVec3,
  computeBillboardBasis,
  computeLayerRenderSize,
  computeLayerWorldPosition,
  crossVec3,
  directionToEquirectUv,
  dotVec3,
  equirectUvToDirection,
  normalizeVec3,
  scaleVec3,
  subtractVec3,
} from "./projection-math";

const MAX_TEXTURE_EDGE = 1024;
const imageElementCache = new Map<string, Promise<HTMLImageElement>>();
const imageDataCache = new Map<string, Promise<CachedImageData>>();

type CachedImageData = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  aspect: number;
};

type LayerPlane = {
  center: Vec3;
  right: Vec3;
  up: Vec3;
  width: number;
  height: number;
};

export async function renderProjection(canvas: HTMLCanvasElement, scene: StoryboardScene) {
  const width = ensureCanvasSize(canvas);
  const height = Math.max(2, Math.floor(width / 2));
  await renderProjectionIntoCanvas(canvas, scene, width, height);
}

export async function renderProjectionToBlob(
  scene: StoryboardScene,
  width = 3840,
) {
  const canvas = document.createElement("canvas");
  const height = Math.max(2, Math.floor(width / 2));
  canvas.width = width;
  canvas.height = height;
  await renderProjectionIntoCanvas(canvas, scene, width, height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to export rendered result"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

async function renderProjectionIntoCanvas(
  canvas: HTMLCanvasElement,
  scene: StoryboardScene,
  width: number,
  height: number,
) {
  if (canvas.height !== height) {
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const background = scene.backgroundImageUrl
    ? await loadImageElement(scene.backgroundImageUrl)
    : null;

  ctx.clearRect(0, 0, width, height);
  if (background) {
    ctx.drawImage(background, 0, 0, width, height);
  } else {
    ctx.fillStyle = "#05070c";
    ctx.fillRect(0, 0, width, height);
  }

  const output = ctx.getImageData(0, 0, width, height);
  const outputData = output.data;

  const sortedLayers = scene.layers
    .filter((layer) => layer.visible && layer.imageUrl)
    .slice()
    .sort((a, b) => b.distance - a.distance);

  for (const layer of sortedLayers) {
    const image = await loadImageData(layer.imageUrl);
    const plane = buildLayerPlane(layer, scene.camera.position, scene.dome.radius);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const direction = equirectUvToDirection((x + 0.5) / width, (y + 0.5) / height);
        const sample = sampleLayerAtDirection(scene.camera.position, direction, plane, image);
        if (!sample || sample[3] === 0) {
          continue;
        }

        const index = (y * width + x) * 4;
        const alpha = sample[3] / 255;
        const inverseAlpha = 1 - alpha;
        outputData[index] = Math.round(sample[0] * alpha + outputData[index] * inverseAlpha);
        outputData[index + 1] = Math.round(sample[1] * alpha + outputData[index + 1] * inverseAlpha);
        outputData[index + 2] = Math.round(sample[2] * alpha + outputData[index + 2] * inverseAlpha);
        outputData[index + 3] = 255;
      }
    }
  }

  ctx.putImageData(output, 0, 0);
}

function ensureCanvasSize(canvas: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(2, Math.floor(canvas.clientWidth * dpr));
  if (canvas.width !== width) {
    canvas.width = width;
  }
  return width;
}

function buildLayerPlane(layer: StoryboardLayer, cameraPosition: Vec3, sphereRadius: number): LayerPlane {
  const center = computeLayerWorldPosition(layer.latitude, layer.longitude, sphereRadius - layer.distance);
  const { right, up } = computeBillboardBasis(center, cameraPosition, layer.rotation);
  const size = computeLayerRenderSize(layer);
  const aspect = Math.max(0.1, layer.imageAspect ?? 1);
  return {
    center,
    right,
    up,
    width: size * aspect,
    height: size,
  };
}

function sampleLayerAtDirection(
  cameraPosition: Vec3,
  direction: Vec3,
  plane: LayerPlane,
  image: CachedImageData,
) {
  const planeNormal = crossVec3(plane.right, plane.up);
  const denominator = dotVec3(direction, planeNormal);
  if (Math.abs(denominator) < 1e-6) {
    return null;
  }

  const t = dotVec3(subtractVec3(plane.center, cameraPosition), planeNormal) / denominator;
  if (t <= 0) {
    return null;
  }

  const hitPoint = addVec3(cameraPosition, scaleVec3(direction, t));
  const local = subtractVec3(hitPoint, plane.center);
  const u = dotVec3(local, plane.right) / plane.width + 0.5;
  const v = 0.5 - dotVec3(local, plane.up) / plane.height;

  if (u < 0 || u > 1 || v < 0 || v > 1) {
    return null;
  }

  return sampleCachedImage(image, u, v);
}

async function loadImageElement(url: string) {
  const cached = imageElementCache.get(url);
  if (cached) {
    return cached;
  }

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    image.src = url;
  });
  imageElementCache.set(url, promise);
  return promise;
}

async function loadImageData(url: string) {
  const cached = imageDataCache.get(url);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const image = await loadImageElement(url);
    const scale = Math.min(1, MAX_TEXTURE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to create 2D context");
    }
    ctx.drawImage(image, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height).data;
    return {
      width,
      height,
      data,
      aspect: image.naturalWidth / image.naturalHeight,
    };
  })();

  imageDataCache.set(url, promise);
  return promise;
}

function sampleCachedImage(image: CachedImageData, u: number, v: number) {
  const x = u * (image.width - 1);
  const y = v * (image.height - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(image.width - 1, x0 + 1);
  const y1 = Math.min(image.height - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;

  const c00 = readPixel(image, x0, y0);
  const c10 = readPixel(image, x1, y0);
  const c01 = readPixel(image, x0, y1);
  const c11 = readPixel(image, x1, y1);

  return [
    lerp(lerp(c00[0], c10[0], tx), lerp(c01[0], c11[0], tx), ty),
    lerp(lerp(c00[1], c10[1], tx), lerp(c01[1], c11[1], tx), ty),
    lerp(lerp(c00[2], c10[2], tx), lerp(c01[2], c11[2], tx), ty),
    lerp(lerp(c00[3], c10[3], tx), lerp(c01[3], c11[3], tx), ty),
  ] as const;
}

function readPixel(image: CachedImageData, x: number, y: number) {
  const index = (y * image.width + x) * 4;
  return [
    image.data[index],
    image.data[index + 1],
    image.data[index + 2],
    image.data[index + 3],
  ] as const;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

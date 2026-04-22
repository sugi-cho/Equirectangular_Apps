import type { StoryboardLayer, StoryboardScene, Vec3 } from "./types";
import { createEmptyLayer } from "./scene";

export const PROJECT_FILE_VERSION = 1;

type ProjectFileV1 = {
  version: 1;
  scene: StoryboardScene;
};

export function serializeProject(scene: StoryboardScene) {
  const document: ProjectFileV1 = {
    version: PROJECT_FILE_VERSION,
    scene,
  };
  return JSON.stringify(document, null, 2);
}

export function parseProject(text: string) {
  const parsed = JSON.parse(text) as unknown;
  const scene = extractScene(parsed);
  return normalizeScene(scene);
}

function extractScene(value: unknown): StoryboardScene {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid project file");
  }

  const record = value as { version?: unknown; scene?: unknown };
  if (record.version === PROJECT_FILE_VERSION && record.scene) {
    return record.scene as StoryboardScene;
  }

  if ("layers" in record && "dome" in record && "camera" in record) {
    return record as StoryboardScene;
  }

  throw new Error("Unsupported project file");
}

function normalizeScene(scene: StoryboardScene) {
  return {
    guideImageUrl: scene.guideImageUrl ?? "",
    backgroundImageUrl: scene.backgroundImageUrl ?? "",
    dome: {
      radius: Number(scene.dome?.radius ?? 527),
      scale: normalizeVec3(scene.dome?.scale, [1, 0.85, 1]),
      translate: normalizeVec3(scene.dome?.translate, [0, 0, -129.92]),
    },
    camera: {
      position: normalizeVec3(scene.camera?.position, [0, 0, 0]),
    },
    layers: normalizeLayers(scene.layers),
  } satisfies StoryboardScene;
}

function normalizeLayers(layers: StoryboardScene["layers"]) {
  if (!Array.isArray(layers) || layers.length === 0) {
    return [createEmptyLayer(0)];
  }

  return layers.map((layer, index) => normalizeLayer(layer, index));
}

function normalizeLayer(layer: StoryboardLayer, index: number) {
  return {
    id: String(layer.id ?? `layer-${index + 1}`),
    name: String(layer.name ?? `Layer ${index + 1}`),
    imageUrl: String(layer.imageUrl ?? ""),
    imageName: layer.imageName ? String(layer.imageName) : undefined,
    imageAspect: Number(layer.imageAspect ?? 1),
    latitude: Number(layer.latitude ?? 0),
    longitude: Number(layer.longitude ?? 0),
    distance: Number(layer.distance ?? 6),
    rotation: Number(layer.rotation ?? 0),
    scale: Number(layer.scale ?? 1),
    visible: Boolean(layer.visible ?? true),
  };
}

function normalizeVec3(value: Vec3 | undefined, fallback: Vec3): Vec3 {
  if (!Array.isArray(value) || value.length < 3) {
    return fallback;
  }

  return [
    Number(value[0] ?? fallback[0]),
    Number(value[1] ?? fallback[1]),
    Number(value[2] ?? fallback[2]),
  ] as Vec3;
}

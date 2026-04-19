import type { StoryboardLayer, StoryboardScene, Vec3 } from "./types";
import { createLayerId, createLayerName } from "./geometry";

export function createEmptyLayer(index: number): StoryboardLayer {
  return {
    id: createLayerId(index),
    name: createLayerName(index),
    imageUrl: "",
    imageName: undefined,
    imageAspect: 1,
    latitude: 0,
    longitude: 0,
    distance: 6,
    rotation: 0,
    scale: 1,
    visible: true,
  };
}

export function addLayer(scene: StoryboardScene): StoryboardScene {
  if (scene.layers.length >= 10) {
    return scene;
  }

  return {
    ...scene,
    layers: [...scene.layers, createEmptyLayer(scene.layers.length)],
  };
}

export function updateLayer(
  scene: StoryboardScene,
  id: string,
  patch: Partial<StoryboardLayer>,
): StoryboardScene {
  return {
    ...scene,
    layers: scene.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)),
  };
}

export function setVec3Value(values: Vec3, axis: number, nextValue: number): Vec3 {
  return values.map((value, index) => (index === axis ? nextValue : value)) as Vec3;
}

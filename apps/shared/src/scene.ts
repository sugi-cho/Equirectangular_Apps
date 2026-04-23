import type { StoryboardLayer, StoryboardScene, Vec3 } from "./types";

export function createEmptyLayer(index: number): StoryboardLayer {
  return {
    id: `layer-${index + 1}`,
    name: `Layer ${index + 1}`,
    imageUrl: "",
    latitude: 0,
    longitude: 0,
    distance: 6,
    rotation: 0,
    scale: 1,
    visible: true,
  };
}

export function addLayer(scene: StoryboardScene) {
  if (scene.layers.length >= 10) {
    return scene;
  }

  return {
    ...scene,
    layers: [...scene.layers, createEmptyLayer(scene.layers.length)],
  };
}

export function deleteLayer(scene: StoryboardScene, layerId: string) {
  const nextLayers = scene.layers.filter((layer) => layer.id !== layerId);
  if (nextLayers.length === scene.layers.length) {
    return scene;
  }

  return {
    ...scene,
    layers: nextLayers,
  };
}

export function updateLayer(
  scene: StoryboardScene,
  layerId: string,
  patch: Partial<StoryboardLayer>,
) {
  return {
    ...scene,
    layers: scene.layers.map((layer) =>
      layer.id === layerId ? { ...layer, ...patch } : layer,
    ),
  };
}

export function setVec3Value(value: Vec3, axis: 0 | 1 | 2, nextValue: number) {
  const next = [...value] as Vec3;
  next[axis] = nextValue;
  return next;
}

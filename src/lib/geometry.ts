import type { StoryboardLayer } from "./types";

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function latitudeLongitudeToVector3(
  latitude: number,
  longitude: number,
  radius: number,
) {
  const lat = degreesToRadians(latitude);
  const lon = degreesToRadians(longitude);
  const x = radius * Math.cos(lat) * Math.sin(lon);
  const y = radius * Math.sin(lat);
  const z = radius * Math.cos(lat) * Math.cos(lon);
  return [x, y, z] as const;
}

export function screenPointToLatitudeLongitude(
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const longitude = clamp((x / width) * 360 - 180, -180, 180);
  const latitude = clamp(90 - (y / height) * 180, -90, 90);
  return { latitude, longitude };
}

export function createLayerId(index: number) {
  return `layer-${index + 1}`;
}

export function createLayerName(index: number) {
  return `Layer ${index + 1}`;
}

export function estimateLayerPreviewSize(layer: StoryboardLayer) {
  return clamp((160 * layer.scale) / Math.max(layer.distance, 0.2), 40, 220);
}


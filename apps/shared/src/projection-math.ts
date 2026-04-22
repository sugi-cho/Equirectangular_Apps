import type { StoryboardLayer, Vec3 } from "./types";

export const panoramaFrontRotationY = -Math.PI / 2;
export const panoramaLayerLongitudeOffset = 180;

export function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function normalizeVec3(value: Vec3) {
  const length = Math.hypot(value[0], value[1], value[2]) || 1;
  return [value[0] / length, value[1] / length, value[2] / length] as Vec3;
}

export function subtractVec3(a: Vec3, b: Vec3) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]] as Vec3;
}

export function addVec3(a: Vec3, b: Vec3) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]] as Vec3;
}

export function scaleVec3(value: Vec3, factor: number) {
  return [value[0] * factor, value[1] * factor, value[2] * factor] as Vec3;
}

export function dotVec3(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function crossVec3(a: Vec3, b: Vec3) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ] as Vec3;
}

export function computeLayerWorldPosition(
  latitude: number,
  longitude: number,
  radius: number,
) {
  const lat = degreesToRadians(latitude);
  const lon = degreesToRadians(panoramaLayerLongitudeOffset - longitude);
  const x = radius * Math.cos(lat) * Math.sin(lon);
  const y = radius * Math.sin(lat);
  const z = radius * Math.cos(lat) * Math.cos(lon);
  return [x, y, z] as Vec3;
}

export function computeLayerRenderSize(layer: StoryboardLayer) {
  return Math.max(0.2, layer.scale * (220 / Math.max(layer.distance, 0.25)));
}

export function computeBillboardBasis(
  center: Vec3,
  cameraPosition: Vec3,
  rotationDegrees: number,
) {
  const normal = normalizeVec3(subtractVec3(cameraPosition, center));
  let right = crossVec3([0, 1, 0], normal);
  if (Math.hypot(right[0], right[1], right[2]) < 1e-6) {
    right = crossVec3([1, 0, 0], normal);
  }
  right = normalizeVec3(right);
  const up = normalizeVec3(crossVec3(normal, right));

  const rotation = degreesToRadians(rotationDegrees);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  const rotatedRight = normalizeVec3([
    right[0] * cos - up[0] * sin,
    right[1] * cos - up[1] * sin,
    right[2] * cos - up[2] * sin,
  ]);
  const rotatedUp = normalizeVec3([
    right[0] * sin + up[0] * cos,
    right[1] * sin + up[1] * cos,
    right[2] * sin + up[2] * cos,
  ]);

  return {
    normal,
    right: rotatedRight,
    up: rotatedUp,
  };
}

export function directionToEquirectUv(direction: Vec3) {
  const lon = Math.atan2(direction[0], -direction[2]);
  const lat = Math.asin(Math.max(-1, Math.min(1, direction[1])));
  const u = 0.5 + lon / (Math.PI * 2);
  const v = 0.5 - lat / Math.PI;
  return { u: wrap01(u), v: clamp01(v) };
}

export function equirectUvToDirection(u: number, v: number) {
  const lon = (u - 0.5) * Math.PI * 2;
  const lat = (0.5 - v) * Math.PI;
  const x = Math.sin(lon) * Math.cos(lat);
  const y = Math.sin(lat);
  const z = -Math.cos(lon) * Math.cos(lat);
  return normalizeVec3([x, y, z]);
}

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function wrap01(value: number) {
  const wrapped = value % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

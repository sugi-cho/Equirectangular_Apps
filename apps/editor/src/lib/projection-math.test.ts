import { describe, expect, it } from "vitest";
import {
  computeBillboardBasis,
  computeLayerWorldPosition,
  getLayerDistance,
  directionToEquirectUv,
  equirectUvToDirection,
} from "./projection-math";

describe("projection math", () => {
  it("maps front to the negative z axis with the current panorama basis", () => {
    const [x, y, z] = computeLayerWorldPosition(0, 0, 10);
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(-10, 5);
  });

  it("converts front direction to centered equirectangular uv", () => {
    const uv = directionToEquirectUv([0, 0, -1]);
    expect(uv.u).toBeCloseTo(0.5, 5);
    expect(uv.v).toBeCloseTo(0.5, 5);
  });

  it("converts centered uv to front direction", () => {
    const direction = equirectUvToDirection(0.5, 0.5);
    expect(direction[0]).toBeCloseTo(0, 5);
    expect(direction[1]).toBeCloseTo(0, 5);
    expect(direction[2]).toBeCloseTo(-1, 5);
  });

  it("builds an orthogonal billboard basis", () => {
    const basis = computeBillboardBasis([0, 0, -5], [0, 0, 0], 0);
    expect(Math.abs(basis.normal[2])).toBeCloseTo(1, 5);
    expect(basis.right[1]).toBeCloseTo(0, 5);
    expect(basis.up[0]).toBeCloseTo(0, 5);
  });

  it("keeps layer distance as a plain positive value", () => {
    expect(getLayerDistance(6)).toBe(6);
    expect(getLayerDistance(13.3)).toBe(13.3);
    expect(getLayerDistance(20)).toBe(20);
  });
});

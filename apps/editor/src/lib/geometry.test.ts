import { describe, expect, it } from "vitest";
import {
  clamp,
  latitudeLongitudeToVector3,
  screenPointToLatitudeLongitude,
} from "./geometry";

describe("geometry", () => {
  it("clamps values", () => {
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp(-1, 0, 10)).toBe(0);
  });

  it("maps screen points to latitude and longitude", () => {
    expect(screenPointToLatitudeLongitude(0, 0, 100, 50)).toEqual({
      latitude: 90,
      longitude: -180,
    });
    expect(screenPointToLatitudeLongitude(50, 25, 100, 50)).toEqual({
      latitude: 0,
      longitude: 0,
    });
  });

  it("maps latitude and longitude to a 3D vector", () => {
    const [x, y, z] = latitudeLongitudeToVector3(0, 90, 10);
    expect(Math.round(x)).toBe(10);
    expect(Math.round(y)).toBe(0);
    expect(Math.round(z)).toBe(0);
  });
});


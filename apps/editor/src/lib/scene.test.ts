import { describe, expect, it } from "vitest";
import { addLayer, createEmptyLayer, updateLayer } from "./scene";
import { defaultScene } from "./defaultScene";

describe("scene", () => {
  it("creates predictable layer defaults", () => {
    expect(createEmptyLayer(0).name).toBe("Layer 1");
    expect(createEmptyLayer(0).visible).toBe(true);
  });

  it("adds up to ten layers", () => {
    let scene = defaultScene;
    for (let index = 0; index < 9; index += 1) {
      scene = addLayer(scene);
    }

    expect(scene.layers).toHaveLength(10);
    expect(addLayer(scene)).toBe(scene);
  });

  it("updates a single layer without touching others", () => {
    const next = updateLayer(defaultScene, "layer-1", { latitude: 12.5 });
    expect(next.layers[0]?.latitude).toBe(12.5);
  });
});


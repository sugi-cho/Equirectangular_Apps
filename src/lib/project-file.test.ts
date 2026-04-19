import { describe, expect, it } from "vitest";
import { defaultScene } from "./defaultScene";
import { parseProject, serializeProject } from "./project-file";

describe("project file", () => {
  it("round-trips a scene through the project file format", () => {
    const json = serializeProject(defaultScene);
    const next = parseProject(json);

    expect(next.guideImageUrl).toBe(defaultScene.guideImageUrl);
    expect(next.layers).toHaveLength(defaultScene.layers.length);
    expect(next.dome.radius).toBe(defaultScene.dome.radius);
  });

  it("accepts a legacy direct scene document", () => {
    const next = parseProject(JSON.stringify(defaultScene));
    expect(next.camera.position).toEqual(defaultScene.camera.position);
  });
});

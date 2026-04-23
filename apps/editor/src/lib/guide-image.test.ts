import { describe, expect, it } from "vitest";
import { defaultGuideImageUrl } from "./defaultScene";
import { resolveGuideImageUrl } from "./guide-image";

describe("guide image", () => {
  it("falls back to the default guide when empty", () => {
    expect(resolveGuideImageUrl("")).toBe(defaultGuideImageUrl);
  });

  it("keeps explicit guide urls", () => {
    expect(resolveGuideImageUrl("data:image/png;base64,abc")).toBe(
      "data:image/png;base64,abc",
    );
  });
});

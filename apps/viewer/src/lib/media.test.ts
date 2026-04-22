import { describe, expect, it } from "vitest";
import { formatTime, readMediaKind } from "./media";

describe("media helpers", () => {
  it("formats time", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(61)).toBe("1:01");
    expect(formatTime(600)).toBe("10:00");
  });

  it("detects media kind", () => {
    expect(readMediaKind(new File([], "a.jpg", { type: "image/jpeg" }))).toBe("image");
    expect(readMediaKind(new File([], "a.mp4", { type: "video/mp4" }))).toBe("video");
  });
});

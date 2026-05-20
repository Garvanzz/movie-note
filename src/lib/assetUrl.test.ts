import { describe, expect, it } from "vitest";
import { assetUrl } from "./assetUrl";

describe("assetUrl", () => {
  it("returns undefined for empty input", () => {
    expect(assetUrl(undefined)).toBeUndefined();
    expect(assetUrl(null)).toBeUndefined();
    expect(assetUrl("")).toBeUndefined();
  });

  it("keeps remote and blob urls unchanged", () => {
    expect(assetUrl("https://example.com/image.jpg")).toBe("https://example.com/image.jpg");
    expect(assetUrl("blob:movie-note-preview")).toBe("blob:movie-note-preview");
    expect(assetUrl("asset://cover.png")).toBe("asset://cover.png");
  });

  it("normalizes local windows paths when convertFileSrc is not available", () => {
    expect(assetUrl(String.raw`D:\self\movie-note\AppData\workspaces\default\images\cover.jpg`)).toBe(
      "D:/self/movie-note/AppData/workspaces/default/images/cover.jpg",
    );
  });
});
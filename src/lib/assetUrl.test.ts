import { afterEach, describe, expect, it, vi } from "vitest";
import { assetUrl, preloadAssetUrl } from "./assetUrl";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("uses tauri convertFileSrc even when internals appear after preload", async () => {
    await preloadAssetUrl();

    const convertFileSrc = vi.fn((filePath: string) => `asset://localhost/${filePath}`);
    vi.stubGlobal("__TAURI_INTERNALS__", { convertFileSrc });

    expect(assetUrl(String.raw`D:\covers\poster.png`)).toBe("asset://localhost/D:/covers/poster.png");
    expect(convertFileSrc).toHaveBeenCalledWith("D:/covers/poster.png", "asset");
  });
});
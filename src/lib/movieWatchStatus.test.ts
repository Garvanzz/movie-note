import { describe, expect, it } from "vitest";
import { MOVIE_WATCH_STATUS_OPTIONS, getMovieWatchStatusMeta, normalizeMovieWatchStatus } from "./movieWatchStatus";

describe("movieWatchStatus", () => {
  it("normalizes legacy values to unwatched unless explicitly watched", () => {
    expect(normalizeMovieWatchStatus(undefined)).toBe("unwatched");
    expect(normalizeMovieWatchStatus(null)).toBe("unwatched");
    expect(normalizeMovieWatchStatus("watched")).toBe("watched");
    expect(normalizeMovieWatchStatus("in-progress")).toBe("unwatched");
  });

  it("returns consistent metadata for both supported values", () => {
    expect(getMovieWatchStatusMeta("watched")).toMatchObject({ value: "watched", label: "已观看" });
    expect(getMovieWatchStatusMeta("anything-else")).toMatchObject({ value: "unwatched", label: "未观看" });
  });

  it("exposes exactly two watch status options", () => {
    expect(MOVIE_WATCH_STATUS_OPTIONS).toHaveLength(2);
    expect(MOVIE_WATCH_STATUS_OPTIONS.map((option) => option.value)).toEqual(["unwatched", "watched"]);
  });
});
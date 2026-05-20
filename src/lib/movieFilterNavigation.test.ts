import { describe, expect, it } from "vitest";
import { createFilterKey, describeFilter, getInteractionKeys } from "./movieFilterNavigation";

describe("movieFilterNavigation helpers", () => {
  it("builds stable filter keys", () => {
    expect(createFilterKey({ actor_ids: [3], watch_status: "watched" })).toBe('{"actor_ids":[3],"watch_status":"watched"}');
  });

  it("describes the most specific filter type", () => {
    expect(describeFilter({ actor_ids: [1] })).toBe("演员筛选");
    expect(describeFilter({ tag_ids: [2] })).toBe("标签筛选");
    expect(describeFilter({ genre_ids: [3] })).toBe("类型筛选");
    expect(describeFilter({ series: "SSIS" })).toBe("SSIS");
    expect(describeFilter({ has_files: true })).toBe("有文件影片");
    expect(describeFilter({ watch_status: "watched" })).toBe("观看状态筛选");
    expect(describeFilter({})).toBe("组合筛选");
  });

  it("derives interaction keys from all selected dimensions", () => {
    expect(getInteractionKeys({ tag_ids: [2, 4], actor_ids: [3], genre_ids: [8], series: "FC2" })).toEqual([
      "tag:2",
      "tag:4",
      "actor:3",
      "genre:8",
      "series:FC2",
    ]);
  });
});
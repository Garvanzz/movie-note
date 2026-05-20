import { beforeEach, describe, expect, it } from "vitest";
import { useInteractionStatsStore } from "./interactionStatsStore";
import { useMovieFilterStore } from "./movieFilterStore";
import { useRecentVisitsStore } from "./recentVisitsStore";

function resetMovieFilterStore() {
  useMovieFilterStore.setState({
    search: undefined,
    tag_ids: undefined,
    actor_ids: undefined,
    genre_ids: undefined,
    series: undefined,
    rating_min: undefined,
    rating_max: undefined,
    watch_status: undefined,
    has_files: undefined,
    sort_by: undefined,
    sort_dir: undefined,
    page: 1,
    pageSize: 40,
    viewMode: "grid",
  });
}

describe("movieFilterStore", () => {
  beforeEach(() => {
    resetMovieFilterStore();
  });

  it("updates search and resets pagination", () => {
    useMovieFilterStore.getState().setPage(3);
    useMovieFilterStore.getState().setSearch("ipx");

    expect(useMovieFilterStore.getState().search).toBe("ipx");
    expect(useMovieFilterStore.getState().page).toBe(1);
  });

  it("toggles tag ids on and off", () => {
    const store = useMovieFilterStore.getState();

    store.toggleTag(7);
    expect(useMovieFilterStore.getState().tag_ids).toEqual([7]);

    useMovieFilterStore.getState().toggleTag(7);
    expect(useMovieFilterStore.getState().tag_ids).toEqual([]);
  });

  it("replaces filters and resets page", () => {
    useMovieFilterStore.getState().setFilter({ actor_ids: [3], sort_by: "rating", sort_dir: "desc" });

    expect(useMovieFilterStore.getState().actor_ids).toEqual([3]);
    expect(useMovieFilterStore.getState().sort_by).toBe("rating");
    expect(useMovieFilterStore.getState().page).toBe(1);
  });
});

describe("recentVisitsStore", () => {
  beforeEach(() => {
    useRecentVisitsStore.setState({ items: [] });
  });

  it("keeps the latest 12 visits and deduplicates keys", () => {
    const store = useRecentVisitsStore.getState();

    for (let index = 1; index <= 13; index += 1) {
      store.addVisit({ key: `movie:${index}`, type: "movie", title: `Movie ${index}` });
    }

    expect(useRecentVisitsStore.getState().items).toHaveLength(12);
    expect(useRecentVisitsStore.getState().items[0].key).toBe("movie:13");

    store.addVisit({ key: "movie:5", type: "movie", title: "Movie 5 updated" });
    expect(useRecentVisitsStore.getState().items).toHaveLength(12);
    expect(useRecentVisitsStore.getState().items[0].key).toBe("movie:5");
    expect(useRecentVisitsStore.getState().items[0].title).toBe("Movie 5 updated");
  });

  it("clears the history", () => {
    useRecentVisitsStore.getState().addVisit({ key: "actor:1", type: "actor", title: "Actor 1" });
    useRecentVisitsStore.getState().clearVisits();

    expect(useRecentVisitsStore.getState().items).toEqual([]);
  });
});

describe("interactionStatsStore", () => {
  beforeEach(() => {
    useInteractionStatsStore.setState({ counts: {} });
  });

  it("increments single and multiple usage counters", () => {
    const store = useInteractionStatsStore.getState();

    store.increment("tag:1");
    store.incrementMany(["tag:1", "actor:2", "series:FC2"]);

    expect(useInteractionStatsStore.getState().counts).toEqual({
      "tag:1": 2,
      "actor:2": 1,
      "series:FC2": 1,
    });
  });
});
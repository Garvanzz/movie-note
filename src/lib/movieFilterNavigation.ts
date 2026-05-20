import type { MovieFilter } from "@/types/movie";

export function createFilterKey(filter: Partial<MovieFilter>) {
  return JSON.stringify(filter);
}

export function describeFilter(filter: Partial<MovieFilter>) {
  if (filter.actor_ids?.length) return "演员筛选";
  if (filter.tag_ids?.length) return "标签筛选";
  if (filter.genre_ids?.length) return "类型筛选";
  if (filter.series) return filter.series;
  if (filter.has_files === true) return "有文件影片";
  if (filter.watch_status) return "观看状态筛选";
  return "组合筛选";
}

export function getInteractionKeys(filter: Partial<MovieFilter>) {
  return [
    ...(filter.tag_ids ?? []).map((id) => `tag:${id}`),
    ...(filter.actor_ids ?? []).map((id) => `actor:${id}`),
    ...(filter.genre_ids ?? []).map((id) => `genre:${id}`),
    ...(filter.series ? [`series:${filter.series}`] : []),
  ];
}
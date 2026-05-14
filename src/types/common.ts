export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface FilterOption {
  label: string;
  value: string;
  count: number;
}

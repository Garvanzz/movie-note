// Mock Tauri invoke API for browser development.
// When running inside Tauri, delegates to the real @tauri-apps/api/core invoke.
// When running in a browser, returns mock data or empty responses.

let realInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;

async function getRealInvoke() {
  if (realInvoke) return realInvoke;
  try {
    const mod = await import("@tauri-apps/api/core");
    realInvoke = mod.invoke;
    return realInvoke;
  } catch {
    return null;
  }
}

const mockHandlers: Record<string, (args: Record<string, unknown>) => unknown> = {
  get_movies: () => ({ items: [], total: 0, page: 1, page_size: 40 }),
  get_movie_by_code: () => {
    throw new Error("Movie not found");
  },
  create_movie: (args) => ({
    code: args.code as string,
    code_norm: (args.code as string).toUpperCase(),
    series: null,
    title: (args.title as string) ?? null,
    title_jp: null,
    runtime: null,
    release_date: null,
    rating: null,
    comment: null,
    notes: null,
    watch_status: "pending",
    cover_path: null,
    source_url: null,
    source_site: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  update_movie: () => undefined,
  delete_movie: () => undefined,
  get_movie_tags: () => [],
  add_movie_tag: () => undefined,
  remove_movie_tag: () => undefined,
  get_movie_filter_options: () => ({ tags: [], series: [] }),
  get_actors: () => ({ items: [], total: 0, page: 1, page_size: 40 }),
  get_actor: () => {
    throw new Error("Actor not found");
  },
  create_actor: (args) => ({
    id: 1,
    name: args.name as string,
    name_jp: null,
    measurements: null,
    birth_date: null,
    debut_year: null,
    rating: null,
    comment: null,
    avatar_path: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  update_actor: () => undefined,
  delete_actor: () => undefined,
  get_tags: () => [],
  create_tag: (args) => ({ id: 1, name: args.name as string, description: null }),
  delete_tag: () => undefined,
  get_tag_groups: () => [],
  create_tag_group: (args) => ({
    id: 1,
    name: args.name as string,
    description: null,
    sort_order: 0,
  }),
  get_genres: () => [],
  create_genre: (args) => ({
    id: 1,
    name: args.name as string,
    description: null,
  }),
  delete_genre: () => undefined,
  get_movie_files: () => [],
  add_movie_file: () => undefined,
  remove_movie_file: () => undefined,
  scraper_search: () => [],
  scraper_get_detail: () => {
    throw new Error("Scraper not available in browser mode");
  },
  scraper_import: () => undefined,
  export_all_data: () => ({}),
  import_all_data: () => 0,
};

export async function invoke<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const real = await getRealInvoke();
  if (real) {
    return real(cmd, args) as Promise<T>;
  }

  const handler = mockHandlers[cmd];
  if (handler) {
    const result = handler(args ?? {});
    if (result instanceof Error || (result as { error?: string })?.error) {
      throw result;
    }
    return result as T;
  }

  console.warn(`[mock-invoke] No handler for command: ${cmd}`);
  return undefined as unknown as T;
}

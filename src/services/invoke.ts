// Mock Tauri invoke API for browser development.
// When running inside Tauri, delegates to the real @tauri-apps/api/core invoke.
// When running in a browser, returns mock data or empty responses.

let realInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;

function hasTauriRuntime() {
  return !!(globalThis as Record<string, unknown>).__TAURI_INTERNALS__;
}

async function getRealInvoke() {
  if (realInvoke) return realInvoke;
  if (!hasTauriRuntime()) {
    return null;
  }

  try {
    const mod = await import("@tauri-apps/api/core");
    realInvoke = mod.invoke;
    console.log("[invoke] Using real Tauri invoke");
    return realInvoke;
  } catch (e) {
    console.warn("[invoke] Tauri API import failed, using mock mode:", e);
    return null;
  }
}

// In-memory mock stores for image entities
let mockImageId = 1000;
const mockImageStore = {
  covers: {} as Record<string, Array<{ id: number; code: string; image_path: string; is_primary: boolean; source: string }>>,
  screenshots: {} as Record<string, Array<{ id: number; code: string; image_path: string; sort_order: number }>>,
  actorImages: {} as Record<number, Array<{ id: number; actor_id: number; image_path: string; sort_order: number }>>,
  actorAvatars: {} as Record<number, string>,

  addCover(code: string, path: string, setPrimary: boolean) {
    const covers = this.covers[code] ?? [];
    if (setPrimary) covers.forEach((c) => (c.is_primary = false));
    const cover = { id: ++mockImageId, code, image_path: path, is_primary: setPrimary, source: "local" };
    covers.push(cover);
    this.covers[code] = covers;
    return cover;
  },
  removeCover(code: string, id: number) {
    const covers = this.covers[code] ?? [];
    const idx = covers.findIndex((c) => c.id === id);
    const wasPrimary = idx >= 0 && covers[idx].is_primary;
    if (idx >= 0) covers.splice(idx, 1);
    if (wasPrimary && covers.length > 0) covers[0].is_primary = true;
    this.covers[code] = covers;
  },
  setPrimary(code: string, id: number) {
    const covers = this.covers[code] ?? [];
    covers.forEach((c) => (c.is_primary = c.id === id));
  },
  getScreenshots(code: string) { return this.screenshots[code] ?? []; },
  addScreenshot(code: string, path: string) {
    const arr = this.screenshots[code] ?? [];
    const screenshot = { id: ++mockImageId, code, image_path: path, sort_order: arr.length };
    arr.push(screenshot);
    this.screenshots[code] = arr;
    return screenshot;
  },
  removeScreenshot(id: number) {
    for (const key of Object.keys(this.screenshots)) {
      const arr = this.screenshots[key];
      const idx = arr.findIndex((s: { id: number }) => s.id === id);
      if (idx >= 0) { arr.splice(idx, 1); return; }
    }
  },
  getActorImages(actorId: number) { return this.actorImages[actorId] ?? []; },
  addActorImage(actorId: number, path: string) {
    const arr = this.actorImages[actorId] ?? [];
    const img = { id: ++mockImageId, actor_id: actorId, image_path: path, sort_order: arr.length };
    arr.push(img);
    this.actorImages[actorId] = arr;
    return img;
  },
  removeActorImage(id: number) {
    for (const key of Object.keys(this.actorImages)) {
      const arr = this.actorImages[Number(key)];
      const idx = arr.findIndex((i: { id: number }) => i.id === id);
      if (idx >= 0) { arr.splice(idx, 1); return; }
    }
  },
};

const MOCK_WORKSPACE_STORAGE_KEY = "movie-note-mock-workspaces";

interface MockWorkspaceState {
  active: string;
  names: string[];
}

function normalizeWorkspaceName(name: string) {
  const normalized = name
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_");

  return normalized || "default";
}

function loadMockWorkspaceState(): MockWorkspaceState {
  try {
    const saved = localStorage.getItem(MOCK_WORKSPACE_STORAGE_KEY);
    if (!saved) {
      return { active: "default", names: ["default"] };
    }

    const parsed = JSON.parse(saved) as Partial<MockWorkspaceState>;
    const names = Array.from(new Set((parsed.names ?? []).map((name) => normalizeWorkspaceName(String(name)))));
    const active = normalizeWorkspaceName(String(parsed.active ?? names[0] ?? "default"));
    if (!names.includes(active)) {
      names.push(active);
    }

    if (names.length === 0) {
      names.push("default");
    }

    return { active, names };
  } catch {
    return { active: "default", names: ["default"] };
  }
}

function saveMockWorkspaceState(state: MockWorkspaceState) {
  localStorage.setItem(MOCK_WORKSPACE_STORAGE_KEY, JSON.stringify(state));
}

function listMockWorkspaces() {
  const state = loadMockWorkspaceState();
  return state.names
    .slice()
    .sort((left, right) => left.localeCompare(right, "zh-CN", { sensitivity: "base" }))
    .map((name) => ({ name, is_active: name === state.active }));
}

function switchMockWorkspace(name: string) {
  const normalized = normalizeWorkspaceName(name);
  const state = loadMockWorkspaceState();
  const names = state.names.includes(normalized) ? state.names : [...state.names, normalized];
  const nextState = { active: normalized, names };
  saveMockWorkspaceState(nextState);
}

const mockHandlers: Record<string, (args: Record<string, unknown>) => unknown> = {
  get_movies: () => ({ items: [], total: 0, page: 1, page_size: 40 }),
  suggest_movies: () => [],
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
    watch_status: "unwatched",
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
  suggest_actors: () => [],
  get_actor: () => {
    throw new Error("Actor not found");
  },
  get_actor_aliases: () => [],
  add_actor_alias: () => undefined,
  remove_actor_alias: () => undefined,
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
  create_tag: (args) => ({ id: 1, name: args.name as string, description: null, scope: (args.scope as string) ?? "movie" }),
  delete_tag: () => undefined,
  get_tag_groups: () => [],
  create_tag_group: (args) => ({
    id: 1,
    name: args.name as string,
    description: null,
    sort_order: 0,
  }),
  delete_tag_group: () => undefined,
  get_genres: () => [],
  create_genre: (args) => ({
    id: 1,
    name: args.name as string,
    description: null,
  }),
  delete_genre: () => undefined,
  get_movie_genres: () => [],
  add_movie_genre: () => undefined,
  remove_movie_genre: () => undefined,
  get_tag_group_items: () => [],
  add_tag_to_group: () => undefined,
  remove_tag_from_group: () => undefined,
  get_actor_tags: () => [],
  add_actor_tag: () => undefined,
  remove_actor_tag: () => undefined,
  get_movie_actors: () => [],
  add_movie_actor: () => undefined,
  remove_movie_actor: () => undefined,
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
  write_json_file: () => undefined,
  clear_database: () => 0,
  list_workspaces: () => listMockWorkspaces(),
  switch_workspace: (args) => {
    switchMockWorkspace(String(args.name ?? "default"));
    return undefined;
  },
  get_movie_covers: () => [],
  add_movie_cover: (args) => {
    const cover = mockImageStore.addCover(args.code as string, args.filePath as string, !!(args.setPrimary as boolean));
    return cover;
  },
  add_movie_cover_from_url: (args) => {
    const cover = mockImageStore.addCover(args.code as string, args.url as string, !!(args.setPrimary as boolean));
    cover.source = "url";
    return cover;
  },
  remove_movie_cover: (args) => mockImageStore.removeCover(args.code as string, args.coverId as number),
  set_movie_primary_cover: (args) => mockImageStore.setPrimary(args.code as string, args.coverId as number),
  get_movie_screenshots: (args) => mockImageStore.getScreenshots(args.code as string),
  add_movie_screenshot: (args) => mockImageStore.addScreenshot(args.code as string, args.filePath as string),
  add_movie_screenshot_from_url: (args) => mockImageStore.addScreenshot(args.code as string, args.url as string),
  remove_movie_screenshot: (args) => mockImageStore.removeScreenshot(args.screenshotId as number),
  set_actor_avatar: (args) => {
    mockImageStore.actorAvatars[args.actorId as number] = args.filePath as string;
    return args.filePath as string;
  },
  set_actor_avatar_from_url: (args) => {
    mockImageStore.actorAvatars[args.actorId as number] = args.url as string;
    return args.url as string;
  },
  remove_actor_avatar: (args) => { delete mockImageStore.actorAvatars[args.actorId as number]; },
  get_actor_images: (args) => mockImageStore.getActorImages(args.actorId as number),
  add_actor_image: (args) => mockImageStore.addActorImage(args.actorId as number, args.filePath as string),
  add_actor_image_from_url: (args) => mockImageStore.addActorImage(args.actorId as number, args.url as string),
  remove_actor_image: (args) => mockImageStore.removeActorImage(args.imageId as number),
  save_image_bytes: (args) => {
    const imageType = args.imageType as string;
    const owner = args.owner as string;
    const filename = args.filename as string;
    const bytesArr = args.bytes as number[];
    // Convert raw bytes to blob URL for mock display
    const uint8 = new Uint8Array(bytesArr);
    const ext = filename.split(".").pop()?.toLowerCase() ?? "png";
    const mime = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", bmp: "image/bmp" }[ext] ?? "image/png";
    const blob = new Blob([uint8], { type: mime });
    const blobUrl = URL.createObjectURL(blob);

    if (imageType === "movie_screenshot") {
      const s = mockImageStore.addScreenshot(owner, blobUrl);
      return { id: s.id, image_path: s.image_path };
    }
    if (imageType === "actor_image") {
      const actorId = Number(owner);
      const img = mockImageStore.addActorImage(actorId, blobUrl);
      return { id: img.id, image_path: img.image_path };
    }
    if (imageType === "movie_cover") {
      const cover = mockImageStore.addCover(owner, blobUrl, true);
      return { id: cover.id, image_path: cover.image_path };
    }
    if (imageType === "actor_avatar") {
      const actorId = Number(owner);
      mockImageStore.actorAvatars[actorId] = blobUrl;
      return { id: 0, image_path: blobUrl };
    }
    throw new Error(`Unsupported image type: ${imageType}`);
  },
  scraper_download_images: () => undefined,
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

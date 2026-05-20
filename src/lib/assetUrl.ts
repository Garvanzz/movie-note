let _convertFn: ((path: string) => string) | null = null;

function hasTauriRuntime() {
  return !!(globalThis as Record<string, unknown>).__TAURI_INTERNALS__;
}

// Eager preload that returns a promise so main.tsx can await it before rendering
export function preloadAssetUrl(): Promise<void> {
  if (!hasTauriRuntime()) return Promise.resolve();
  return import("@tauri-apps/api/core")
    .then((m) => {
      _convertFn = m.convertFileSrc;
      console.log("[assetUrl] convertFileSrc ready");
    })
    .catch((e) => {
      console.error("[assetUrl] Failed to load convertFileSrc:", e);
    });
}

export function assetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (
    path.startsWith("data:") ||
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("blob:") ||
    path.startsWith("asset://") ||
    path.startsWith("tauri://")
  ) {
    return path;
  }

  if (_convertFn) {
    return _convertFn(path.replace(/\\/g, "/"));
  }

  // fallback: raw path (won't display in webview, but log for diagnosis)
  console.warn("[assetUrl] convertFileSrc unavailable, raw path:", path);
  return path.replace(/\\/g, "/");
}

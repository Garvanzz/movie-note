let _convertFn: ((path: string) => string) | null = null;

type TauriInternals = {
  convertFileSrc?: (path: string, protocol?: string) => string;
};

function resolveConvertFn() {
  if (_convertFn) {
    return _convertFn;
  }

  const internals = (globalThis as Record<string, unknown>).__TAURI_INTERNALS__ as TauriInternals | undefined;
  if (typeof internals?.convertFileSrc === "function") {
    _convertFn = (path: string) => internals.convertFileSrc!(path, "asset");
  }

  return _convertFn;
}

// Eager preload that returns a promise so main.tsx can await it before rendering
export function preloadAssetUrl(): Promise<void> {
  resolveConvertFn();
  return Promise.resolve();
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

  const convertFn = resolveConvertFn();
  if (convertFn) {
    return convertFn(path.replace(/\\/g, "/"));
  }

  // fallback: raw path (won't display in webview, but log for diagnosis)
  console.warn("[assetUrl] convertFileSrc unavailable, raw path:", path);
  return path.replace(/\\/g, "/");
}

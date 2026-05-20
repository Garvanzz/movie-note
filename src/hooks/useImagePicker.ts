import { useRef, useCallback } from "react";

export function useImagePicker() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pickImage = useCallback(async (): Promise<string | null> => {
    // Try Tauri dialog first
    const hasTauri = !!(globalThis as Record<string, unknown>).__TAURI_INTERNALS__;
    if (hasTauri) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          multiple: false,
          filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "bmp", "gif"] }],
        });
        return typeof selected === "string" ? selected : null;
      } catch {
        // Fall through to browser fallback
      }
    }

    // Browser fallback: hidden file input
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) { resolve(null); return; }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      };
      input.click();
    });
  }, []);

  return { pickImage, inputRef };
}

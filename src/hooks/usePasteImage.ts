import { useEffect, type MutableRefObject } from "react";
import { saveImageBytes, type SavedImage } from "@/services/imageService";
import { toast } from "sonner";

type ImageType = "movie_screenshot" | "actor_image" | "movie_cover" | "actor_avatar";

interface UsePasteImageOptions {
  imageType: ImageType;
  owner: string;
  enabled?: boolean;
  /** Ref to a boolean tracking whether paste target is hovered. If omitted, paste works anywhere. */
  isTargetHovering?: MutableRefObject<boolean>;
  onSuccess: (savedImages: SavedImage[]) => void | Promise<void>;
}

export function usePasteImage({ imageType, owner, enabled = true, isTargetHovering, onSuccess }: UsePasteImageOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handlePaste = async (e: ClipboardEvent) => {
      // If target hover ref is set, only accept paste when hovering the target element
      if (isTargetHovering && !isTargetHovering.current) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      let pasted = 0;
      const savedImages: SavedImage[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.type.startsWith("image/")) continue;

        const blob = item.getAsFile();
        if (!blob) continue;

        e.preventDefault();

        try {
          const buf = await blob.arrayBuffer();
          const bytes = Array.from(new Uint8Array(buf));
          console.log(`[usePasteImage] saving ${imageType}, ${bytes.length} bytes, filename:`, blob.name || "clipboard.png");
          const result = await saveImageBytes(imageType, owner, bytes, blob.name || "clipboard.png");
          console.log("[usePasteImage] saved:", result);
          savedImages.push(result);
          pasted++;
        } catch (err) {
          console.error("[usePasteImage] save failed:", err);
          toast.error(`粘贴失败: ${err}`);
        }
      }

      if (pasted > 0) {
        const labels: Record<ImageType, string> = {
          movie_screenshot: "截图",
          actor_image: "图片",
          movie_cover: "封面",
          actor_avatar: "头像",
        };
        toast.success(`已粘贴 ${pasted} 张${labels[imageType]}`);
        await onSuccess(savedImages);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [enabled, imageType, owner, isTargetHovering, onSuccess]);
}

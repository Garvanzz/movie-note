import { Image, Star, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assetUrl } from "@/lib/assetUrl";
import type { LightboxItem } from "@/components/ui/image-lightbox";
import type { ActorImage } from "@/types/image";

interface ActorAssetsSectionProps {
  actorName: string;
  actorImages: ActorImage[];
  previewImageSrc: string | null;
  previewLightboxItems: LightboxItem[];
  previewLightboxIndex: number;
  selectedImageId: number | null;
  avatarImageId: number | null;
  onOpenLightbox: (items: LightboxItem[], index?: number) => void;
  onAvatarHoverChange: (hovering: boolean) => void;
  onGalleryHoverChange: (hovering: boolean) => void;
  onReplaceAvatarFile: () => void;
  onAddImageFile: () => void;
  onRemoveCurrent: () => void;
  onSelectImage: (imageId: number) => void;
  isAvatarBusy: boolean;
  isImageBusy: boolean;
}

export function ActorAssetsSection({
  actorName,
  actorImages,
  previewImageSrc,
  previewLightboxItems,
  previewLightboxIndex,
  selectedImageId,
  avatarImageId,
  onOpenLightbox,
  onAvatarHoverChange,
  onGalleryHoverChange,
  onReplaceAvatarFile,
  onAddImageFile,
  onRemoveCurrent,
  onSelectImage,
  isAvatarBusy,
  isImageBusy,
}: ActorAssetsSectionProps) {
  const activeImageId = selectedImageId ?? avatarImageId;

  return (
    <section className="space-y-6 rounded-2xl border border-border bg-card/40 p-6">
      <div className="space-y-3" onMouseEnter={() => onAvatarHoverChange(true)} onMouseLeave={() => onAvatarHoverChange(false)}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">封面</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={onReplaceAvatarFile} disabled={isAvatarBusy || isImageBusy}>
              <Image className="size-3.5" /> 更换封面
            </Button>
            <Button size="sm" variant="outline" onClick={onAddImageFile} disabled={isImageBusy}>
              <Image className="size-3.5" /> 添加图片
            </Button>
          </div>
        </div>

        <div className="aspect-[3/4] overflow-hidden rounded-xl border border-border bg-muted">
          {previewImageSrc ? (
            <img
              src={previewImageSrc}
              alt={actorName}
              className="h-full w-full cursor-zoom-in object-cover"
              onClick={() => onOpenLightbox(previewLightboxItems, previewLightboxIndex)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <User className="size-16 text-muted-foreground/20" />
            </div>
          )}
        </div>

        {previewImageSrc ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full px-4 text-muted-foreground hover:text-destructive"
              onClick={onRemoveCurrent}
              disabled={isAvatarBusy || isImageBusy}
            >
              <Trash2 className="size-3.5" /> 删除
            </Button>
          </div>
        ) : null}
      </div>

      {actorImages.length > 0 ? (
        <div className="space-y-3" onMouseEnter={() => onGalleryHoverChange(true)} onMouseLeave={() => onGalleryHoverChange(false)}>
          <h2 className="text-sm font-medium">图片</h2>
          <div className="flex flex-wrap gap-2">
            {actorImages.map((image) => {
              const imageSrc = assetUrl(image.image_path);
              if (!imageSrc) return null;

              return (
                <button
                  key={image.id}
                  type="button"
                  className={`relative aspect-[3/4] w-14 overflow-hidden rounded-lg border ${image.id === activeImageId ? "border-primary" : "border-border"}`}
                  onClick={() => onSelectImage(image.id)}
                >
                  <img src={imageSrc} alt="" className="h-full w-full object-cover" />
                  {image.id === avatarImageId ? <Star className="absolute left-1 top-1 size-3 fill-yellow-400 text-yellow-400" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
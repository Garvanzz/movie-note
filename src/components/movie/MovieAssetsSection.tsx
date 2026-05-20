import { Film, Image, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assetUrl } from "@/lib/assetUrl";
import type { LightboxItem } from "@/components/ui/image-lightbox";
import type { Movie } from "@/types/movie";
import type { MovieCover, MovieScreenshot } from "@/types/image";

interface MovieAssetsSectionProps {
  movie: Movie;
  covers: MovieCover[];
  screenshots: MovieScreenshot[];
  coverItems: LightboxItem[];
  screenshotItems: LightboxItem[];
  previewCoverSrc: string | null;
  previewCoverIndex: number;
  selectedCoverId: number | null;
  onOpenLightbox: (items: LightboxItem[], index?: number) => void;
  onCoverHoverChange: (hovering: boolean) => void;
  onScreenshotHoverChange: (hovering: boolean) => void;
  onAddCoverFile: () => void;
  onRemoveCover: (coverId: number) => void;
  onSelectCover: (coverId: number) => void;
  onAddScreenshotFile: () => void;
  onRemoveScreenshot: (screenshotId: number) => void;
  isCoverBusy: boolean;
  isScreenshotBusy: boolean;
}

export function MovieAssetsSection({
  movie,
  covers,
  screenshots,
  coverItems,
  screenshotItems,
  previewCoverSrc,
  previewCoverIndex,
  selectedCoverId,
  onOpenLightbox,
  onCoverHoverChange,
  onScreenshotHoverChange,
  onAddCoverFile,
  onRemoveCover,
  onSelectCover,
  onAddScreenshotFile,
  onRemoveScreenshot,
  isCoverBusy,
  isScreenshotBusy,
}: MovieAssetsSectionProps) {
  const primaryCoverId = covers.find((cover) => cover.is_primary || cover.image_path === movie.cover_path)?.id;

  return (
    <section className="space-y-6 rounded-2xl border border-border bg-card/40 p-6">
      <div className="space-y-3" onMouseEnter={() => onCoverHoverChange(true)} onMouseLeave={() => onCoverHoverChange(false)}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">封面</h2>
          <Button size="sm" variant="secondary" onClick={onAddCoverFile} disabled={isCoverBusy}>
            <Image className="size-3.5" /> 更换封面
          </Button>
        </div>

        <div className="aspect-[3/4] overflow-hidden rounded-xl border border-border bg-muted">
          {previewCoverSrc ? (
            <img
              src={previewCoverSrc}
              alt={movie.title ?? ""}
              className="h-full w-full cursor-zoom-in object-cover"
              onClick={() => onOpenLightbox(coverItems, previewCoverIndex)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Film className="size-16 text-muted-foreground/20" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {primaryCoverId != null ? (
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full px-4 text-muted-foreground hover:text-destructive"
              onClick={() => onRemoveCover(selectedCoverId ?? primaryCoverId)}
              disabled={isCoverBusy}
            >
              <Trash2 className="size-3.5" /> 删除封面
            </Button>
          ) : null}
        </div>

        {covers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {covers.map((cover) => {
              const coverSrc = assetUrl(cover.image_path);
              if (!coverSrc) return null;

              return (
                <button
                  key={cover.id}
                  type="button"
                  className={`relative aspect-[3/4] w-14 overflow-hidden rounded-lg border ${cover.id === selectedCoverId || (selectedCoverId == null && cover.is_primary) ? "border-primary" : "border-border"}`}
                  onClick={() => onSelectCover(cover.id)}
                >
                  <img src={coverSrc} alt="" className="h-full w-full object-cover" />
                  {cover.is_primary ? <Star className="absolute left-1 top-1 size-3 fill-yellow-400 text-yellow-400" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="space-y-4" onMouseEnter={() => onScreenshotHoverChange(true)} onMouseLeave={() => onScreenshotHoverChange(false)}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">截图</h2>
          <Button size="sm" variant="secondary" onClick={onAddScreenshotFile} disabled={isScreenshotBusy}>
            <Plus className="size-3.5" /> 添加截图
          </Button>
        </div>

        {screenshots.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
            {screenshots.map((screenshot, index) => {
              const screenshotSrc = assetUrl(screenshot.image_path);
              if (!screenshotSrc) return null;

              return (
                <div key={screenshot.id} className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-muted">
                  <img
                    src={screenshotSrc}
                    alt=""
                    className="h-full w-full cursor-zoom-in object-cover"
                    onClick={() => onOpenLightbox(screenshotItems, index)}
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveScreenshot(screenshot.id)}
                    disabled={isScreenshotBusy}
                    className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-100"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-background/40 px-4 py-6 text-sm text-muted-foreground">
            暂无截图
          </div>
        )}
      </div>
    </section>
  );
}


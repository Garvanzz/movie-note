import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Trash2, X } from "lucide-react";
import { ActorAssetsSection } from "@/components/actor/ActorAssetsSection";
import { ActorMoviePreviewSection } from "@/components/actor/ActorMoviePreviewSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageLightbox, type LightboxItem } from "@/components/ui/image-lightbox";
import { useDebounce } from "@/hooks/useDebounce";
import { useImagePicker } from "@/hooks/useImagePicker";
import { useMovieFilterNavigation } from "@/hooks/useMovieFilterNavigation";
import { usePasteImage } from "@/hooks/usePasteImage";
import { assetUrl } from "@/lib/assetUrl";
import {
  addActorToCategory,
  deleteActor,
  getActor,
  getActorCategories,
  getCategoriesForActor,
  removeActorFromCategory,
  updateActor,
} from "@/services/actorService";
import {
  addActorImage,
  getActorImages,
  removeActorAvatar,
  removeActorImage,
  setActorAvatarFromImage,
} from "@/services/imageService";
import { useRecentVisitsStore } from "@/stores/recentVisitsStore";
import { toast } from "sonner";

const RATING_OPTIONS = [1, 2, 3, 4, 5] as const;

export function ActorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const actorId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openMoviesWithFilter = useMovieFilterNavigation();
  const addRecentVisit = useRecentVisitsStore((state) => state.addVisit);
  const { pickImage } = useImagePicker();

  const [rating, setRating] = useState<number | undefined>();
  const [comment, setComment] = useState("");
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [selectedActorImageId, setSelectedActorImageId] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const [typeBusy, setTypeBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const avatarHoverRef = useRef(false);
  const galleryHoverRef = useRef(false);

  const { data: actor, isLoading } = useQuery({
    queryKey: ["actor", id],
    queryFn: () => getActor(actorId),
    enabled: !!id,
  });

  const { data: allTypes } = useQuery({
    queryKey: ["actorCategories"],
    queryFn: () => getActorCategories(),
  });

  const { data: assignedTypes } = useQuery({
    queryKey: ["actorAssignedCategories", id],
    queryFn: () => getCategoriesForActor(actorId),
    enabled: !!id,
  });

  const { data: actorImages } = useQuery({
    queryKey: ["actorImages", id],
    queryFn: () => getActorImages(actorId),
    enabled: !!id,
  });

  const types = assignedTypes ?? [];
  const images = actorImages ?? [];
  const assignedTypeIds = new Set(types.map((item) => item.id));
  const availableTypes = (allTypes ?? []).filter((item) => !assignedTypeIds.has(item.id));

  const debouncedComment = useDebounce(comment, 500);
  const debouncedRating = useDebounce(rating, 180);
  const initialComment = actor?.comment ?? "";
  const initialRating = actor?.rating ?? undefined;

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/actors");
  };

  const invalidateActorAssets = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["actor", id] }),
      queryClient.invalidateQueries({ queryKey: ["actorImages", id] }),
      queryClient.invalidateQueries({ queryKey: ["actors"] }),
    ]);
  };

  const invalidateActorTypes = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["actorAssignedCategories", id] }),
      queryClient.invalidateQueries({ queryKey: ["actorCategories"] }),
      queryClient.invalidateQueries({ queryKey: ["actors"] }),
    ]);
  };

  usePasteImage({
    imageType: "actor_image",
    owner: id ?? "",
    enabled: !!id,
    isTargetHovering: avatarHoverRef,
    onSuccess: (savedImages) => {
      const latestImage = savedImages[savedImages.length - 1];
      if (latestImage) {
        setSelectedActorImageId(latestImage.id);
      }
      void invalidateActorAssets();
    },
  });

  usePasteImage({
    imageType: "actor_image",
    owner: id ?? "",
    enabled: !!id,
    isTargetHovering: galleryHoverRef,
    onSuccess: () => {
      void invalidateActorAssets();
    },
  });

  useEffect(() => {
    if (!actor) return;

    setRating(actor.rating ?? undefined);
    setComment(actor.comment ?? "");
    setTypeMenuOpen(false);
  }, [actor]);

  useEffect(() => {
    if (!actor) return;

    addRecentVisit({
      key: `actor:${actor.id}`,
      type: "actor",
      title: actor.name,
      subtitle: actor.name_jp ?? "演员",
      href: `/actors/${actor.id}`,
    });
  }, [actor, addRecentVisit]);

  const updateMutation = useMutation({
    mutationFn: (payload: { rating: number | undefined; comment: string }) =>
      updateActor({
        id: actorId,
        rating: payload.rating,
        comment: payload.comment.trim() || undefined,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["actor", id] }),
        queryClient.invalidateQueries({ queryKey: ["actors"] }),
      ]);
    },
    onError: (error) => toast.error(`保存失败: ${error}`),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteActor(actorId),
    onSuccess: () => navigate("/actors"),
    onError: (error) => toast.error(`删除失败: ${error}`),
  });

  useEffect(() => {
    if (!actor) return;
    if (debouncedComment === initialComment && debouncedRating === initialRating) return;

    updateMutation.mutate({
      rating: debouncedRating,
      comment: debouncedComment,
    });
  }, [actor, debouncedComment, debouncedRating, initialComment, initialRating]);

  useEffect(() => {
    if (images.length === 0) {
      setSelectedActorImageId(null);
      return;
    }

    if (selectedActorImageId != null && images.some((image) => image.id === selectedActorImageId)) {
      return;
    }

    const avatarMatch = actor?.avatar_path ? images.find((image) => image.image_path === actor.avatar_path) : null;
    setSelectedActorImageId(avatarMatch?.id ?? images[0]?.id ?? null);
  }, [actor?.avatar_path, images, selectedActorImageId]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 py-6">
        <div className="h-6 w-24 animate-pulse rounded bg-muted" />
        <div className="h-10 w-56 animate-pulse rounded bg-muted" />
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="h-[560px] animate-pulse rounded-2xl bg-muted" />
          <div className="h-[560px] animate-pulse rounded-3xl bg-muted" />
        </div>
      </div>
    );
  }

  if (!actor) {
    return <div className="py-10 text-center text-muted-foreground">演员不存在</div>;
  }

  const avatarImageId = images.find((image) => image.image_path === actor.avatar_path)?.id ?? null;
  const selectedActorImage = images.find((image) => image.id === selectedActorImageId) ?? null;
  const previewImagePath = selectedActorImage?.image_path ?? actor.avatar_path ?? null;
  const previewImageSrc = assetUrl(previewImagePath) ?? null;

  const avatarItems: LightboxItem[] = actor.avatar_path
    ? [
        {
          src: assetUrl(actor.avatar_path) ?? actor.avatar_path,
          alt: actor.name,
          label: "封面",
        },
      ]
    : [];

  const actorImageItems = images
    .map((image) => {
      const src = assetUrl(image.image_path);
      if (!src) return null;

      return {
        src,
        alt: actor.name,
        label: "图片",
      } satisfies LightboxItem;
    })
    .filter((item): item is LightboxItem => item !== null);

  const previewLightboxItems = selectedActorImage ? actorImageItems : avatarItems;
  const previewLightboxIndex = selectedActorImageId == null ? 0 : Math.max(0, images.findIndex((image) => image.id === selectedActorImageId));

  const openLightbox = (items: LightboxItem[], index = 0) => {
    if (items.length === 0) return;
    setLightbox({ items, index });
  };

  const handleAddType = async (typeId: number) => {
    setTypeBusy(true);
    try {
      await addActorToCategory(actorId, typeId);
      setTypeMenuOpen(false);
      await invalidateActorTypes();
    } catch (error) {
      toast.error(`添加类型失败: ${error}`);
    } finally {
      setTypeBusy(false);
    }
  };

  const handleRemoveType = async (typeId: number) => {
    setTypeBusy(true);
    try {
      await removeActorFromCategory(actorId, typeId);
      await invalidateActorTypes();
    } catch (error) {
      toast.error(`移除类型失败: ${error}`);
    } finally {
      setTypeBusy(false);
    }
  };

  const handleReplaceAvatarFile = async () => {
    const filePath = await pickImage();
    if (!filePath) return;

    setImageBusy(true);
    try {
      const created = await addActorImage(actorId, filePath);
      await setActorAvatarFromImage(actorId, created.id);
      setSelectedActorImageId(created.id);
      await invalidateActorAssets();
    } catch (error) {
      toast.error(`更换封面失败: ${error}`);
    } finally {
      setImageBusy(false);
    }
  };

  const handleAddImageFile = async () => {
    const filePath = await pickImage();
    if (!filePath) return;

    setImageBusy(true);
    try {
      const created = await addActorImage(actorId, filePath);
      if (!actor.avatar_path) {
        await setActorAvatarFromImage(actorId, created.id);
      }
      setSelectedActorImageId(created.id);
      await invalidateActorAssets();
    } catch (error) {
      toast.error(`添加图片失败: ${error}`);
    } finally {
      setImageBusy(false);
    }
  };

  const handleSelectImage = async (imageId: number) => {
    setSelectedActorImageId(imageId);

    const targetImage = images.find((image) => image.id === imageId);
    if (!targetImage || targetImage.image_path === actor.avatar_path) {
      return;
    }

    setImageBusy(true);
    try {
      await setActorAvatarFromImage(actorId, imageId);
      await invalidateActorAssets();
    } catch (error) {
      toast.error(`设置封面失败: ${error}`);
    } finally {
      setImageBusy(false);
    }
  };

  const handleRemoveCurrent = async () => {
    setImageBusy(true);
    try {
      if (selectedActorImageId != null) {
        await removeActorImage(selectedActorImageId);
        setSelectedActorImageId(null);
      } else if (actor.avatar_path) {
        await removeActorAvatar(actorId);
      }
      await invalidateActorAssets();
    } catch (error) {
      toast.error(`删除图片失败: ${error}`);
    } finally {
      setImageBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 py-6">
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-2 text-xs text-muted-foreground/80 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          返回
        </button>

        <Button variant="ghost" size="sm" onClick={() => { if (confirm("确定删除该演员？")) deleteMutation.mutate(); }}>
          <Trash2 className="size-3.5" /> 删除
        </Button>
      </div>

      <div className="min-w-0">
        <h1 className="text-3xl font-semibold tracking-tight">{actor.name}</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <ActorAssetsSection
          actorName={actor.name}
          actorImages={images}
          previewImageSrc={previewImageSrc}
          previewLightboxItems={previewLightboxItems}
          previewLightboxIndex={previewLightboxIndex}
          selectedImageId={selectedActorImageId}
          avatarImageId={avatarImageId}
          onOpenLightbox={openLightbox}
          onAvatarHoverChange={(hovering) => {
            avatarHoverRef.current = hovering;
          }}
          onGalleryHoverChange={(hovering) => {
            galleryHoverRef.current = hovering;
          }}
          onReplaceAvatarFile={() => {
            void handleReplaceAvatarFile();
          }}
          onAddImageFile={() => {
            void handleAddImageFile();
          }}
          onRemoveCurrent={() => {
            void handleRemoveCurrent();
          }}
          onSelectImage={(imageId) => {
            void handleSelectImage(imageId);
          }}
          isAvatarBusy={imageBusy}
          isImageBusy={imageBusy}
        />

        <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/30">
          <section className="space-y-4 px-6 py-5">
            <h2 className="text-sm font-medium">类型</h2>

            <div className="flex flex-wrap gap-2">
              {types.length > 0 ? (
                types.map((type) => (
                  <Badge key={type.id} variant="outline" className="gap-1 rounded-full px-3 py-1">
                    {type.name}
                    <button
                      type="button"
                      onClick={() => {
                        void handleRemoveType(type.id);
                      }}
                      disabled={typeBusy}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">暂无类型</p>
              )}
            </div>

            <InlineOptionMenu
              open={typeMenuOpen}
              onOpenChange={setTypeMenuOpen}
              disabled={typeBusy || availableTypes.length === 0}
              triggerLabel={availableTypes.length > 0 ? "添加类型" : "没有可添加的类型"}
              emptyLabel="没有可添加的类型"
              options={availableTypes.map((type) => ({ id: type.id, label: type.name }))}
              onSelect={(typeId) => {
                void handleAddType(typeId);
              }}
            />
          </section>

          <section className="space-y-4 border-t border-border/70 px-6 py-5">
            <h2 className="text-sm font-medium">评分</h2>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={rating == null ? "secondary" : "outline"}
                className="rounded-full px-4"
                onClick={() => setRating(undefined)}
              >
                未评分
              </Button>
              {RATING_OPTIONS.map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={rating === value ? "secondary" : "outline"}
                  className="rounded-full px-4"
                  onClick={() => setRating((current) => (current === value ? undefined : value))}
                >
                  {value}
                </Button>
              ))}
            </div>
          </section>

          <section className="space-y-4 border-t border-border/70 px-6 py-5">
            <h2 className="text-sm font-medium">评价</h2>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="评价"
              className="min-h-56 w-full resize-none rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm leading-6 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </section>
        </div>
      </div>

      <ActorMoviePreviewSection actorId={actorId} actorName={actor.name} onViewAll={() => openMoviesWithFilter({ actor_ids: [actorId] })} />

      <ImageLightbox
        items={lightbox?.items ?? []}
        initialIndex={lightbox?.index ?? 0}
        isOpen={!!lightbox}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}

interface InlineOptionMenuOption {
  id: number;
  label: string;
  secondaryLabel?: string;
}

function InlineOptionMenu({
  open,
  onOpenChange,
  triggerLabel,
  emptyLabel,
  options,
  disabled,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerLabel: string;
  emptyLabel: string;
  options: InlineOptionMenuOption[];
  disabled?: boolean;
  onSelect: (id: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && !containerRef.current?.contains(target)) {
        onOpenChange(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="flex h-10 w-full items-center justify-between rounded-2xl border border-input/80 bg-background/50 px-3 text-sm text-foreground transition-colors hover:bg-accent/40 disabled:opacity-50"
        onClick={() => onOpenChange(!open)}
        disabled={disabled}
      >
        <span>{triggerLabel}</span>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border border-border/80 bg-card/95 p-1.5 shadow-2xl backdrop-blur">
          {options.length > 0 ? (
            <div className="max-h-64 overflow-y-auto">
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-accent/60"
                  onClick={() => {
                    onSelect(option.id);
                    onOpenChange(false);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{option.label}</span>
                    {option.secondaryLabel ? <span className="block truncate text-xs text-muted-foreground">{option.secondaryLabel}</span> : null}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">{emptyLabel}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

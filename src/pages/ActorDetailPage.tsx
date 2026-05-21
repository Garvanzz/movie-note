import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { ActorAssetsSection } from "@/components/actor/ActorAssetsSection";
import { ActorMoviePreviewSection } from "@/components/actor/ActorMoviePreviewSection";
import { InlineOptionMenu } from "@/components/ui/inline-option-menu";
import { SearchSuggestionList } from "@/components/search/SearchSuggestionList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageLightbox, type LightboxItem } from "@/components/ui/image-lightbox";
import { useDebounce } from "@/hooks/useDebounce";
import { useImagePicker } from "@/hooks/useImagePicker";
import { useMovieFilterNavigation } from "@/hooks/useMovieFilterNavigation";
import { usePasteImage } from "@/hooks/usePasteImage";
import { useActorSuggestions } from "@/hooks/useSearchSuggestions";
import { assetUrl } from "@/lib/assetUrl";
import { describeActorMatch, parseActorNames } from "@/lib/utils";
import type { ActorName } from "@/types/actor";
import {
  addActorName,
  addActorToCategory,
  deleteActor,
  getActor,
  getActorNames,
  getActorCategories,
  getCategoriesForActor,
  mergeActors,
  removeActorName,
  removeActorFromCategory,
  updateActorName,
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
  const [mainName, setMainName] = useState("");
  const [newActorName, setNewActorName] = useState("");
  const [mergeQuery, setMergeQuery] = useState("");
  const [mergeFocused, setMergeFocused] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [selectedActorImageId, setSelectedActorImageId] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const [typeBusy, setTypeBusy] = useState(false);
  const [nameBusy, setNameBusy] = useState(false);
  const [mergeBusy, setMergeBusy] = useState(false);
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

  const { data: actorNameItems } = useQuery({
    queryKey: ["actorNames", id],
    queryFn: () => getActorNames(actorId),
    enabled: !!id,
  });

  const { data: mergeSuggestions = [], isFetching: isMergeSuggestionsFetching } = useActorSuggestions(mergeQuery, mergeFocused, 8);

  const types = assignedTypes ?? [];
  const images = actorImages ?? [];
  const actorNames = actorNameItems ?? [];
  const primaryActorName = actorNames.find((item) => item.is_primary) ?? actorNames[0] ?? null;
  const secondaryActorNames = actorNames.filter((item) => item.id !== primaryActorName?.id);
  const availableMergeTargets = mergeSuggestions.filter((item) => item.id !== actorId);
  const exactMergeTarget = availableMergeTargets.filter((item) => item.match_kind.endsWith("_exact"));
  const assignedTypeIds = new Set(types.map((item) => item.id));
  const availableTypes = (allTypes ?? []).filter((item) => !assignedTypeIds.has(item.id));

  const debouncedMainName = useDebounce(mainName, 350);
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
    setMainName(primaryActorName?.name ?? "");
  }, [primaryActorName?.id, primaryActorName?.name]);

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
        comment: payload.comment,
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
    if (debouncedComment === initialComment && debouncedRating === initialRating) {
      return;
    }

    updateMutation.mutate({
      rating: debouncedRating,
      comment: debouncedComment,
    });
  }, [actor, debouncedComment, debouncedRating, initialComment, initialRating]);

  useEffect(() => {
    if (!primaryActorName) {
      return;
    }

    const trimmed = debouncedMainName.trim();
    if (!trimmed || trimmed === primaryActorName.name) {
      return;
    }

    let cancelled = false;

    const syncPrimaryName = async () => {
      setNameBusy(true);
      try {
        await updateActorName(primaryActorName.id, trimmed, primaryActorName.kind, true);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["actor", id] }),
          queryClient.invalidateQueries({ queryKey: ["actorNames", id] }),
          queryClient.invalidateQueries({ queryKey: ["actors"] }),
          queryClient.invalidateQueries({ queryKey: ["actorSuggestions"] }),
        ]);
      } catch (error) {
        if (!cancelled) {
          toast.error(`更新姓名失败: ${error}`);
          setMainName(primaryActorName.name);
        }
      } finally {
        if (!cancelled) {
          setNameBusy(false);
        }
      }
    };

    void syncPrimaryName();

    return () => {
      cancelled = true;
    };
  }, [debouncedMainName, primaryActorName?.id, primaryActorName?.kind, primaryActorName?.name, id, queryClient]);

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

  const invalidateActorMeta = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["actor", id] }),
      queryClient.invalidateQueries({ queryKey: ["actorNames", id] }),
      queryClient.invalidateQueries({ queryKey: ["actors"] }),
      queryClient.invalidateQueries({ queryKey: ["actorSuggestions"] }),
    ]);
  };

  const handleAddActorName = async () => {
    const names = parseActorNames(newActorName);
    if (names.length === 0) {
      toast.error("请输入姓名");
      return;
    }

    setNameBusy(true);
    try {
      let addedCount = 0;
      for (const name of names) {
        if (actorNames.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
          continue;
        }
        await addActorName(actorId, name, "alias", false);
        addedCount += 1;
      }

      if (addedCount === 0) {
        toast.error("这些姓名都已存在");
        return;
      }

      setNewActorName("");
      await invalidateActorMeta();
    } catch (error) {
      toast.error(`添加姓名失败: ${error}`);
    } finally {
      setNameBusy(false);
    }
  };

  const handleSetPrimaryName = async (target: ActorName) => {
    if (target.is_primary) {
      return;
    }

    setNameBusy(true);
    try {
      await updateActorName(target.id, target.name, target.kind, true);
      await invalidateActorMeta();
    } catch (error) {
      toast.error(`设置主显示名失败: ${error}`);
    } finally {
      setNameBusy(false);
    }
  };

  const handleRemoveActorName = async (nameId: number) => {
    setNameBusy(true);
    try {
      await removeActorName(nameId);
      await invalidateActorMeta();
    } catch (error) {
      toast.error(`删除姓名失败: ${error}`);
    } finally {
      setNameBusy(false);
    }
  };

  const handleMergeIntoActor = async (targetActorId: number, targetActorName: string) => {
    if (!confirm(`确定将当前演员“${actor.name}”合并到“${targetActorName}”吗？\n\n当前演员会被删除，作品关联、类型、图片和姓名都会迁移到目标演员。`)) {
      return;
    }

    setMergeBusy(true);
    try {
      const merged = await mergeActors(actorId, targetActorId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["actors"] }),
        queryClient.invalidateQueries({ queryKey: ["actorSuggestions"] }),
        queryClient.invalidateQueries({ queryKey: ["movieActors"] }),
      ]);
      toast.success(`已将 ${actor.name} 合并到 ${merged.name}`);
      navigate(`/actors/${merged.id}`);
    } catch (error) {
      toast.error(`合并演员失败: ${error}`);
    } finally {
      setMergeBusy(false);
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
            <h2 className="text-sm font-medium">姓名</h2>
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">主显示名</label>
                <Input
                  value={mainName}
                  onChange={(event) => setMainName(event.target.value)}
                  placeholder="主显示名"
                  disabled={nameBusy || !primaryActorName}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>其他名字</span>
                  {secondaryActorNames.length > 0 ? <span>点击名字可设为主显示名</span> : null}
                </div>
                {secondaryActorNames.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {secondaryActorNames.map((item) => (
                      <div key={item.id} className="inline-flex items-center overflow-hidden rounded-full border border-border/80 bg-background/50">
                        <button
                          type="button"
                          className="px-3 py-1.5 text-sm transition-colors hover:bg-accent/60"
                          onClick={() => {
                            void handleSetPrimaryName(item);
                          }}
                          disabled={nameBusy}
                        >
                          {item.name}
                        </button>
                        <button
                          type="button"
                          className="border-l border-border/80 px-2 py-1.5 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                          onClick={() => {
                            void handleRemoveActorName(item.id);
                          }}
                          disabled={nameBusy}
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无其他名字</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 rounded-2xl border border-dashed border-border/70 bg-background/20 p-3">
              <Input
                value={newActorName}
                onChange={(event) => setNewActorName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleAddActorName();
                  }
                }}
                placeholder="添加其他名字，可直接粘贴多个名字"
                disabled={nameBusy}
              />
              <Button size="sm" variant="secondary" onClick={() => { void handleAddActorName(); }} disabled={nameBusy || !newActorName.trim()}>
                <Plus className="size-4" /> 添加
              </Button>
            </div>
          </section>

          <section className="space-y-4 border-t border-border/70 px-6 py-5">
            <h2 className="text-sm font-medium">合并演员</h2>

            <div className="space-y-2">
              <div className="relative">
                <Input
                  value={mergeQuery}
                  onFocus={() => setMergeFocused(true)}
                  onBlur={() => window.setTimeout(() => setMergeFocused(false), 100)}
                  onChange={(event) => setMergeQuery(event.target.value)}
                  placeholder="搜索要合并到的演员名、日文名或别名"
                  disabled={mergeBusy}
                />
                <SearchSuggestionList
                  open={mergeFocused && mergeQuery.trim().length > 0}
                  loading={isMergeSuggestionsFetching}
                  emptyLabel="没有匹配演员"
                  items={availableMergeTargets.map((item) => ({
                    key: String(item.id),
                    title: item.name,
                    subtitle: item.matched_name !== item.name ? `匹配: ${item.matched_name}` : item.name_jp || "演员",
                    badge: item.match_kind.startsWith("alias_") ? "别名" : item.match_kind.startsWith("name_jp") ? "日文名" : "姓名",
                    meta: describeActorMatch(item.match_kind),
                    onSelect: () => {
                      void handleMergeIntoActor(item.id, item.name);
                    },
                  }))}
                />
              </div>

              {mergeQuery.trim() ? (
                <div className="rounded-2xl border border-border/70 bg-background/50 px-3 py-3 text-xs text-muted-foreground">
                  {exactMergeTarget.length === 1 ? (
                    <p>检测到唯一精确匹配，可直接把当前演员合并到 <span className="font-medium text-foreground">{exactMergeTarget[0].name}</span>。</p>
                  ) : exactMergeTarget.length > 1 ? (
                    <p>存在多个精确匹配，请从候选列表里点选目标演员，避免误合并。</p>
                  ) : (
                    <p>请选择一个已有演员作为合并目标。合并后当前演员会被删除。</p>
                  )}
                </div>
              ) : null}

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (exactMergeTarget.length === 1) {
                    void handleMergeIntoActor(exactMergeTarget[0].id, exactMergeTarget[0].name);
                  }
                }}
                disabled={mergeBusy || exactMergeTarget.length !== 1}
              >
                合并到已匹配演员
              </Button>
            </div>
          </section>

          <section className="space-y-4 border-t border-border/70 px-6 py-5">
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

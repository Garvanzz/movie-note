import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Film, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageLightbox, type LightboxItem } from "@/components/ui/image-lightbox";
import { MovieAssetsSection } from "@/components/movie/MovieAssetsSection";
import { assetUrl } from "@/lib/assetUrl";
import { useDebounce } from "@/hooks/useDebounce";
import { useImagePicker } from "@/hooks/useImagePicker";
import { usePasteImage } from "@/hooks/usePasteImage";
import { Input } from "@/components/ui/input";
import { getActors } from "@/services/actorService";
import {
  addMovieCover,
  addMovieScreenshot,
  getMovieCovers,
  getMovieScreenshots,
  removeMovieCover,
  removeMovieScreenshot,
  setMoviePrimaryCover,
} from "@/services/imageService";
import {
  addMovieActor,
  addMovieGenre,
  addMovieTag,
  getMovieActors,
  getMovieByCode,
  getMovieGenres,
  getMovieTags,
  removeMovieActor,
  removeMovieGenre,
  removeMovieTag,
  updateMovie,
} from "@/services/movieService";
import { getGenres, getTags } from "@/services/tagService";
import { useRecentVisitsStore } from "@/stores/recentVisitsStore";
import { toast } from "sonner";

const RATING_OPTIONS = [1, 2, 3, 4, 5] as const;

export function MovieDetailPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pickImage } = useImagePicker();
  const addRecentVisit = useRecentVisitsStore((state) => state.addVisit);
  const isCoverHovering = useRef(false);
  const isScreenshotHovering = useRef(false);

  const [rating, setRating] = useState<number | undefined>(undefined);
  const [comment, setComment] = useState("");
  const [actorSearch, setActorSearch] = useState("");
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [genreMenuOpen, setGenreMenuOpen] = useState(false);
  const [actorMenuOpen, setActorMenuOpen] = useState(false);
  const [selectedCoverId, setSelectedCoverId] = useState<number | null>(null);
  const [lightboxItems, setLightboxItems] = useState<LightboxItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [tagBusy, setTagBusy] = useState(false);
  const [genreBusy, setGenreBusy] = useState(false);
  const [actorBusy, setActorBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [screenshotBusy, setScreenshotBusy] = useState(false);

  const { data: movie, isLoading } = useQuery({
    queryKey: ["movie", code],
    queryFn: () => getMovieByCode(code!),
    enabled: !!code,
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["movieTags", code],
    queryFn: () => getMovieTags(code!),
    enabled: !!code,
  });

  const { data: actors = [] } = useQuery({
    queryKey: ["movieActors", code],
    queryFn: () => getMovieActors(code!),
    enabled: !!code,
  });

  const { data: genres = [] } = useQuery({
    queryKey: ["movieGenres", code],
    queryFn: () => getMovieGenres(code!),
    enabled: !!code,
  });

  const { data: covers = [] } = useQuery({
    queryKey: ["movieCovers", code],
    queryFn: () => getMovieCovers(code!),
    enabled: !!code,
  });

  const { data: screenshots = [] } = useQuery({
    queryKey: ["movieScreenshots", code],
    queryFn: () => getMovieScreenshots(code!),
    enabled: !!code,
  });

  const { data: allTags = [] } = useQuery({
    queryKey: ["tags", "movie"],
    queryFn: () => getTags("movie"),
  });

  const { data: allGenres = [] } = useQuery({
    queryKey: ["genres"],
    queryFn: getGenres,
  });

  const debouncedActorSearch = useDebounce(actorSearch, 200).trim();
  const { data: actorPage } = useQuery({
    queryKey: ["movieDetailActors", debouncedActorSearch],
    queryFn: () => getActors({ search: debouncedActorSearch || undefined, page: 1, pageSize: 12 }),
  });

  const debouncedComment = useDebounce(comment, 500);
  const debouncedRating = useDebounce(rating, 180);

  const initialComment = movie?.comment ?? "";
  const initialRating = movie?.rating ?? undefined;

  const tagIds = useMemo(() => new Set(tags.map((tag) => tag.id)), [tags]);
  const availableTags = useMemo(() => allTags.filter((tag) => !tagIds.has(tag.id)), [allTags, tagIds]);
  const genreIds = useMemo(() => new Set(genres.map((genre) => genre.id)), [genres]);
  const availableGenres = useMemo(() => allGenres.filter((genre) => !genreIds.has(genre.id)), [allGenres, genreIds]);
  const actorIds = useMemo(() => new Set(actors.map((actor) => actor.id)), [actors]);
  const availableActors = useMemo(
    () => (actorPage?.items ?? []).filter((actor) => !actorIds.has(actor.id)),
    [actorIds, actorPage],
  );

  const coverItems = useMemo(
    () =>
      covers
        .map((cover, index) => ({
          src: assetUrl(cover.image_path) ?? "",
          alt: movie?.title ?? movie?.code ?? cover.code,
          label: cover.is_primary ? "主封面" : `封面 ${index + 1}`,
        }))
        .filter((item) => Boolean(item.src)),
    [covers, movie],
  );

  const screenshotItems = useMemo(
    () =>
      screenshots
        .map((screenshot, index) => ({
          src: assetUrl(screenshot.image_path) ?? "",
          alt: movie?.title ?? movie?.code ?? screenshot.code,
          label: `截图 ${index + 1}`,
        }))
        .filter((item) => Boolean(item.src)),
    [movie, screenshots],
  );

  const primaryCoverIndex = Math.max(0, covers.findIndex((cover) => cover.is_primary || cover.image_path === movie?.cover_path));
  const selectedCover = covers.find((cover) => cover.id === selectedCoverId) ?? covers[primaryCoverIndex] ?? covers[0] ?? null;
  const previewCoverSrc = assetUrl(selectedCover?.image_path ?? movie?.cover_path ?? null) ?? null;
  const previewCoverIndex = Math.max(0, covers.findIndex((cover) => cover.id === selectedCover?.id));

  const updateMutation = useMutation({
    mutationFn: (payload: { rating: number | undefined; comment: string }) =>
      updateMovie(code!, {
        rating: payload.rating,
        comment: payload.comment.trim(),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["movie", code] }),
        queryClient.invalidateQueries({ queryKey: ["movies"] }),
      ]);
    },
    onError: (error) => toast.error(`保存失败: ${error}`),
  });

  usePasteImage({
    imageType: "movie_cover",
    owner: code ?? "",
    enabled: Boolean(code),
    isTargetHovering: isCoverHovering,
    onSuccess: () => {
      void invalidateMedia();
    },
  });

  usePasteImage({
    imageType: "movie_screenshot",
    owner: code ?? "",
    enabled: Boolean(code),
    isTargetHovering: isScreenshotHovering,
    onSuccess: () => {
      void invalidateMedia();
    },
  });

  useEffect(() => {
    if (!movie) return;
    addRecentVisit({
      key: `movie:${movie.code}`,
      type: "movie",
      title: movie.code,
      subtitle: movie.title ?? "影片",
      href: `/movies/${encodeURIComponent(movie.code)}`,
    });
  }, [movie, addRecentVisit]);

  useEffect(() => {
    if (!movie) return;
    setRating(movie.rating ?? undefined);
    setComment(movie.comment ?? "");
    setTagMenuOpen(false);
    setGenreMenuOpen(false);
    setActorMenuOpen(false);
    setSelectedCoverId(null);
  }, [movie]);

  useEffect(() => {
    if (!movie) return;
    if (debouncedComment === initialComment && debouncedRating === initialRating) return;

    updateMutation.mutate({
      rating: debouncedRating,
      comment: debouncedComment,
    });
  }, [debouncedComment, debouncedRating, initialComment, initialRating, movie, updateMutation]);

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/");
  };

  const invalidateTags = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["movieTags", code] }),
      queryClient.invalidateQueries({ queryKey: ["movies"] }),
    ]);
  };

  const invalidateActors = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["movieActors", code] }),
      queryClient.invalidateQueries({ queryKey: ["movies"] }),
    ]);
  };

  const invalidateGenres = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["movieGenres", code] }),
      queryClient.invalidateQueries({ queryKey: ["movies"] }),
    ]);
  };

  const invalidateMedia = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["movieCovers", code] }),
      queryClient.invalidateQueries({ queryKey: ["movieScreenshots", code] }),
      queryClient.invalidateQueries({ queryKey: ["movie", code] }),
      queryClient.invalidateQueries({ queryKey: ["movies"] }),
    ]);
  };

  const handleAddTag = async (tagId: number) => {
    if (!code) return;
    setTagBusy(true);
    try {
      await addMovieTag(code, tagId);
      setTagMenuOpen(false);
      await invalidateTags();
    } catch (error) {
      toast.error(`添加标签失败: ${error}`);
    } finally {
      setTagBusy(false);
    }
  };

  const handleRemoveTag = async (tagId: number) => {
    if (!code) return;
    setTagBusy(true);
    try {
      await removeMovieTag(code, tagId);
      await invalidateTags();
    } catch (error) {
      toast.error(`移除标签失败: ${error}`);
    } finally {
      setTagBusy(false);
    }
  };

  const handleAddGenre = async (genreId: number) => {
    if (!code) return;
    setGenreBusy(true);
    try {
      await addMovieGenre(code, genreId);
      setGenreMenuOpen(false);
      await invalidateGenres();
    } catch (error) {
      toast.error(`添加类型失败: ${error}`);
    } finally {
      setGenreBusy(false);
    }
  };

  const handleRemoveGenre = async (genreId: number) => {
    if (!code) return;
    setGenreBusy(true);
    try {
      await removeMovieGenre(code, genreId);
      await invalidateGenres();
    } catch (error) {
      toast.error(`移除类型失败: ${error}`);
    } finally {
      setGenreBusy(false);
    }
  };

  const handleAddActor = async (actorId: number) => {
    if (!code) return;
    setActorBusy(true);
    try {
      await addMovieActor(code, actorId);
      setActorSearch("");
      setActorMenuOpen(false);
      await invalidateActors();
    } catch (error) {
      toast.error(`添加演员失败: ${error}`);
    } finally {
      setActorBusy(false);
    }
  };

  const handleRemoveActor = async (actorId: number) => {
    if (!code) return;
    setActorBusy(true);
    try {
      await removeMovieActor(code, actorId);
      await invalidateActors();
    } catch (error) {
      toast.error(`移除演员失败: ${error}`);
    } finally {
      setActorBusy(false);
    }
  };

  const handleAddCoverFile = async () => {
    if (!code) return;
    const filePath = await pickImage();
    if (!filePath) return;

    setCoverBusy(true);
    try {
      await addMovieCover(code, filePath, covers.length === 0);
      await invalidateMedia();
    } catch (error) {
      toast.error(`添加封面失败: ${error}`);
    } finally {
      setCoverBusy(false);
    }
  };

  const handleSetPrimaryCover = async (coverId: number) => {
    if (!code) return;
    setCoverBusy(true);
    try {
      await setMoviePrimaryCover(code, coverId);
      await invalidateMedia();
    } catch (error) {
      toast.error(`设置封面失败: ${error}`);
    } finally {
      setCoverBusy(false);
    }
  };

  const handleRemoveCover = async (coverId: number) => {
    if (!code) return;
    setCoverBusy(true);
    try {
      await removeMovieCover(code, coverId);
      if (selectedCoverId === coverId) {
        setSelectedCoverId(null);
      }
      await invalidateMedia();
    } catch (error) {
      toast.error(`删除封面失败: ${error}`);
    } finally {
      setCoverBusy(false);
    }
  };

  const handleAddScreenshotFile = async () => {
    if (!code) return;
    const filePath = await pickImage();
    if (!filePath) return;

    setScreenshotBusy(true);
    try {
      await addMovieScreenshot(code, filePath);
      await invalidateMedia();
    } catch (error) {
      toast.error(`添加截图失败: ${error}`);
    } finally {
      setScreenshotBusy(false);
    }
  };

  const handleRemoveScreenshot = async (screenshotId: number) => {
    setScreenshotBusy(true);
    try {
      await removeMovieScreenshot(screenshotId);
      await invalidateMedia();
    } catch (error) {
      toast.error(`删除截图失败: ${error}`);
    } finally {
      setScreenshotBusy(false);
    }
  };

  const openLightbox = (items: LightboxItem[], index = 0) => {
    setLightboxItems(items);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <Film className="size-16 text-muted-foreground/30" />
        <p className="text-muted-foreground">影片不存在</p>
        <Button variant="outline" onClick={() => navigate("/")}>返回列表</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 py-6">
      <button
        onClick={goBack}
        className="inline-flex items-center gap-2 text-xs text-muted-foreground/80 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        返回
      </button>

      <div className="min-w-0">
        <h1 className="text-3xl font-semibold tracking-tight">{movie.title?.trim() || movie.code}</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <MovieAssetsSection
          movie={movie}
          covers={covers}
          screenshots={screenshots}
          coverItems={coverItems}
          screenshotItems={screenshotItems}
          previewCoverSrc={previewCoverSrc}
          previewCoverIndex={previewCoverIndex}
          selectedCoverId={selectedCover?.id ?? null}
          onOpenLightbox={openLightbox}
          onCoverHoverChange={(hovering) => {
            isCoverHovering.current = hovering;
          }}
          onScreenshotHoverChange={(hovering) => {
            isScreenshotHovering.current = hovering;
          }}
          onAddCoverFile={() => {
            void handleAddCoverFile();
          }}
          onRemoveCover={(coverId) => {
            void handleRemoveCover(coverId);
          }}
          onSelectCover={(coverId) => {
            setSelectedCoverId(coverId);
            if (coverId !== covers[primaryCoverIndex]?.id) {
              void handleSetPrimaryCover(coverId);
            }
          }}
          onAddScreenshotFile={() => {
            void handleAddScreenshotFile();
          }}
          onRemoveScreenshot={(screenshotId) => {
            void handleRemoveScreenshot(screenshotId);
          }}
          isCoverBusy={coverBusy}
          isScreenshotBusy={screenshotBusy}
        />

        <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/30">
          <section className="space-y-4 px-6 py-5">
            <h2 className="text-sm font-medium">标签</h2>

            <div className="flex flex-wrap gap-2">
              {tags.length > 0 ? (
                tags.map((tag) => (
                  <Badge key={tag.id} variant="outline" className="gap-1 rounded-full px-3 py-1">
                    {tag.name}
                    <button
                      type="button"
                      onClick={() => {
                        void handleRemoveTag(tag.id);
                      }}
                      disabled={tagBusy}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">暂无标签</p>
              )}
            </div>

            <InlineOptionMenu
              open={tagMenuOpen}
              onOpenChange={setTagMenuOpen}
              disabled={tagBusy || availableTags.length === 0}
              triggerLabel={availableTags.length > 0 ? "添加标签" : "没有可添加的标签"}
              emptyLabel="没有可添加的标签"
              options={availableTags.map((tag) => ({ id: tag.id, label: tag.name }))}
              onSelect={(id) => {
                void handleAddTag(id);
              }}
            />
          </section>

          <section className="space-y-4 border-t border-border/70 px-6 py-5">
            <h2 className="text-sm font-medium">类型</h2>

            <div className="flex flex-wrap gap-2">
              {genres.length > 0 ? (
                genres.map((genre) => (
                  <Badge key={genre.id} variant="outline" className="gap-1 rounded-full px-3 py-1">
                    {genre.name}
                    <button
                      type="button"
                      onClick={() => {
                        void handleRemoveGenre(genre.id);
                      }}
                      disabled={genreBusy}
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
              open={genreMenuOpen}
              onOpenChange={setGenreMenuOpen}
              disabled={genreBusy || availableGenres.length === 0}
              triggerLabel={availableGenres.length > 0 ? "添加类型" : "没有可添加的类型"}
              emptyLabel="没有可添加的类型"
              options={availableGenres.map((genre) => ({ id: genre.id, label: genre.name }))}
              onSelect={(id) => {
                void handleAddGenre(id);
              }}
            />
          </section>

          <section className="space-y-4 border-t border-border/70 px-6 py-5">
            <h2 className="text-sm font-medium">演员</h2>

            <div className="flex flex-wrap gap-2">
              {actors.length > 0 ? (
                actors.map((actor) => (
                  <Badge key={actor.id} variant="outline" className="gap-1 rounded-full px-3 py-1">
                    {actor.name}
                    <button
                      type="button"
                      onClick={() => {
                        void handleRemoveActor(actor.id);
                      }}
                      disabled={actorBusy}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">暂无演员</p>
              )}
            </div>

            <div className="space-y-2">
              <Input
                placeholder="搜索演员..."
                value={actorSearch}
                onChange={(event) => setActorSearch(event.target.value)}
                disabled={actorBusy}
              />
              {availableActors.length > 0 ? (
                <InlineOptionMenu
                  open={actorMenuOpen}
                  onOpenChange={setActorMenuOpen}
                  disabled={actorBusy}
                  triggerLabel="选择演员"
                  emptyLabel="没有匹配演员"
                  options={availableActors.map((actor) => ({
                    id: actor.id,
                    label: actor.name,
                    secondaryLabel: actor.name_jp ?? undefined,
                  }))}
                  onSelect={(id) => {
                    void handleAddActor(id);
                  }}
                />
              ) : actorSearch ? (
                <p className="text-xs text-muted-foreground">没有匹配演员</p>
              ) : null}
            </div>
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
              placeholder="写下你的评价..."
              className="min-h-56 w-full resize-none rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm leading-6 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </section>
        </div>
      </div>

      <ImageLightbox
        items={lightboxItems}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
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

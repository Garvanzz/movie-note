import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Cloud, Copy, Film, HardDrive, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageLightbox, type LightboxItem } from "@/components/ui/image-lightbox";
import { MovieAssetsSection } from "@/components/movie/MovieAssetsSection";
import { SearchSuggestionList } from "@/components/search/SearchSuggestionList";
import { assetUrl } from "@/lib/assetUrl";
import { useDebounce } from "@/hooks/useDebounce";
import { useImagePicker } from "@/hooks/useImagePicker";
import { usePasteImage } from "@/hooks/usePasteImage";
import { useActorSuggestions } from "@/hooks/useSearchSuggestions";
import { createActor, suggestActors } from "@/services/actorService";
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
import { getMovieFiles, addMovieFile, removeMovieFile } from "@/services/fileService";
import { FileBrowserDialog, type SelectedFileEntry } from "@/components/movie/FileBrowserDialog";
import { describeActorMatch, formatFileSize, getFileDisplayName, parseActorNames, parseFilePaths } from "@/lib/utils";
import { InlineOptionMenu } from "@/components/ui/inline-option-menu";
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
  const [actorSearchFocused, setActorSearchFocused] = useState(false);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [genreMenuOpen, setGenreMenuOpen] = useState(false);
  const [selectedCoverId, setSelectedCoverId] = useState<number | null>(null);
  const [lightboxItems, setLightboxItems] = useState<LightboxItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [tagBusy, setTagBusy] = useState(false);
  const [genreBusy, setGenreBusy] = useState(false);
  const [actorBusy, setActorBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [screenshotBusy, setScreenshotBusy] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [newFilePath, setNewFilePath] = useState("");
  const [fileBrowserOpen, setFileBrowserOpen] = useState(false);
  const parsedActorNames = useMemo(() => parseActorNames(actorSearch), [actorSearch]);
  const singleActorQuery = parsedActorNames.length === 1 ? parsedActorNames[0] : "";

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

  const { data: files = [] } = useQuery({
    queryKey: ["movieFiles", code],
    queryFn: () => getMovieFiles(code!),
    enabled: !!code,
  });

  const { data: actorSuggestions = [], isFetching: isActorSuggestionsFetching } = useActorSuggestions(singleActorQuery, actorSearchFocused && singleActorQuery.length > 0, 12);

  const debouncedComment = useDebounce(comment, 500);
  const debouncedRating = useDebounce(rating, 180);

  const initialComment = movie?.comment ?? "";
  const initialRating = movie?.rating ?? undefined;

  const tagIds = useMemo(() => new Set(tags.map((tag) => tag.id)), [tags]);
  const availableTags = useMemo(() => allTags.filter((tag) => !tagIds.has(tag.id)), [allTags, tagIds]);
  const genreIds = useMemo(() => new Set(genres.map((genre) => genre.id)), [genres]);
  const availableGenres = useMemo(() => allGenres.filter((genre) => !genreIds.has(genre.id)), [allGenres, genreIds]);
  const actorIds = useMemo(() => new Set(actors.map((actor) => actor.id)), [actors]);
  const availableActorSuggestions = useMemo(
    () => actorSuggestions.filter((actor) => !actorIds.has(actor.id)),
    [actorIds, actorSuggestions],
  );
  const exactMatchedActors = useMemo(
    () => actorSuggestions.filter((actor) => actor.match_kind.endsWith("_exact")),
    [actorSuggestions],
  );
  const autoMatchedActor = exactMatchedActors.length === 1 ? exactMatchedActors[0] : null;

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

  const invalidateFiles = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["movieFiles", code] }),
      queryClient.invalidateQueries({ queryKey: ["movies"] }),
    ]);
  };

  const handleAddFiles = async (paths: string[]) => {
    if (!code) return;
    setFileBusy(true);
    try {
      for (const filePath of paths) {
        await addMovieFile(code, filePath);
      }
      setNewFilePath("");
      await invalidateFiles();
      toast.success(`已添加 ${paths.length} 个文件`);
    } catch (error) {
      toast.error(`添加文件失败: ${error}`);
    } finally {
      setFileBusy(false);
    }
  };

  const handleRemoveFile = async (fileId: number) => {
    setFileBusy(true);
    try {
      await removeMovieFile(fileId);
      await invalidateFiles();
    } catch (error) {
      toast.error(`删除文件失败: ${error}`);
    } finally {
      setFileBusy(false);
    }
  };

  const handleFilesSelected = async (selected: SelectedFileEntry[]) => {
    if (!code) return;
    setFileBusy(true);
    try {
      for (const f of selected) {
        await addMovieFile(
          code,
          f.file_path,
          f.file_name,
          f.file_size ?? undefined,
          f.provider,
          f.provider_file_id,
          f.provider_url ?? undefined,
          undefined,
        );
      }
      await invalidateFiles();
      toast.success(`已关联 ${selected.length} 个文件`);
    } catch (error) {
      toast.error(`关联文件失败: ${error}`);
    } finally {
      setFileBusy(false);
    }
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
      setActorSearchFocused(false);
      await invalidateActors();
    } catch (error) {
      toast.error(`添加演员失败: ${error}`);
    } finally {
      setActorBusy(false);
    }
  };

  const handleSubmitActorSearch = async () => {
    if (!code) return;

    const names = parseActorNames(actorSearch);
    if (names.length === 0) return;

    setActorBusy(true);
    try {
      const linkedActorIds = new Set(actorIds);
      const unresolvedNames: string[] = [];
      let linkedExistingCount = 0;
      let createdCount = 0;
      let alreadyLinkedCount = 0;

      for (const name of names) {
        const suggestions = await suggestActors(name, 12);
        const exactMatches = suggestions.filter((actor) => actor.match_kind.endsWith("_exact"));

        if (exactMatches.length > 1) {
          unresolvedNames.push(name);
          continue;
        }

        if (exactMatches.length === 1) {
          const matched = exactMatches[0];
          if (linkedActorIds.has(matched.id)) {
            alreadyLinkedCount += 1;
            continue;
          }

          await addMovieActor(code, matched.id);
          linkedActorIds.add(matched.id);
          linkedExistingCount += 1;
          continue;
        }

        const created = await createActor(name);
        await addMovieActor(code, created.id);
        linkedActorIds.add(created.id);
        createdCount += 1;
      }

      if (linkedExistingCount > 0 || createdCount > 0) {
        await Promise.all([
          invalidateActors(),
          queryClient.invalidateQueries({ queryKey: ["actors"] }),
          queryClient.invalidateQueries({ queryKey: ["actorSuggestions"] }),
        ]);
      }

      const summaryParts = [
        linkedExistingCount > 0 ? `关联已有 ${linkedExistingCount} 位` : null,
        createdCount > 0 ? `新建 ${createdCount} 位` : null,
        alreadyLinkedCount > 0 ? `跳过已关联 ${alreadyLinkedCount} 位` : null,
      ].filter(Boolean);

      if (summaryParts.length > 0) {
        toast.success(summaryParts.join("，"));
      }
      if (unresolvedNames.length > 0) {
        toast.error(`这些名字存在多个精确匹配，请手动选择: ${unresolvedNames.slice(0, 4).join("、")}${unresolvedNames.length > 4 ? " 等" : ""}`);
      }

      setActorSearch(unresolvedNames.join("\n"));
      setActorSearchFocused(unresolvedNames.length > 0 && unresolvedNames.length === 1);
    } catch (error) {
      toast.error(`处理演员失败: ${error}`);
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
              <div className="relative">
                <textarea
                  placeholder="支持批量粘贴演员名。每行一个，也支持逗号、顿号、分号分隔。"
                  value={actorSearch}
                  onFocus={() => setActorSearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setActorSearchFocused(false), 100)}
                  onChange={(event) => setActorSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                      event.preventDefault();
                      void handleSubmitActorSearch();
                    }
                  }}
                  disabled={actorBusy}
                  className="min-h-24 w-full resize-y rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm leading-6 focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <SearchSuggestionList
                  open={actorSearchFocused && singleActorQuery.length > 0}
                  loading={isActorSuggestionsFetching}
                  emptyLabel="没有匹配演员，将按当前输入新建"
                  items={availableActorSuggestions.map((actor) => ({
                    key: String(actor.id),
                    title: actor.name,
                    subtitle: actor.matched_name !== actor.name ? `匹配: ${actor.matched_name}` : actor.name_jp || "演员",
                    badge: actor.match_kind.startsWith("alias_") ? "别名" : actor.match_kind.startsWith("name_jp") ? "日文名" : "姓名",
                    meta: describeActorMatch(actor.match_kind),
                    onSelect: () => {
                      void handleAddActor(actor.id);
                    },
                  }))}
                />
              </div>

              {actorSearch.trim() ? (
                <div className="rounded-2xl border border-border/70 bg-background/50 px-3 py-3 text-xs text-muted-foreground">
                  {parsedActorNames.length > 1 ? (
                    <p>已识别 {parsedActorNames.length} 个名字。处理时会逐个执行：唯一精确匹配则自动关联，没有精确匹配则新建，存在多个精确匹配则保留给你手动处理。</p>
                  ) : autoMatchedActor ? (
                    <p>
                      检测到精确匹配，将自动关联到 <span className="font-medium text-foreground">{autoMatchedActor.name}</span>
                      {autoMatchedActor.matched_name !== autoMatchedActor.name ? `（匹配名: ${autoMatchedActor.matched_name}）` : ""}。
                    </p>
                  ) : exactMatchedActors.length > 1 ? (
                    <p>存在多个精确匹配，请先从下方候选里手动选择，避免误关联到错误演员。</p>
                  ) : (
                    <p>没有精确匹配时，会按当前输入新建演员档案并立即关联到这部影片。</p>
                  )}
                </div>
              ) : null}

              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void handleSubmitActorSearch();
                }}
                disabled={actorBusy || parsedActorNames.length === 0 || (parsedActorNames.length === 1 && exactMatchedActors.length > 1)}
              >
                <Plus className="size-4" />
                {parsedActorNames.length > 1
                  ? `批量处理 ${parsedActorNames.length} 位演员`
                  : autoMatchedActor
                    ? "关联已匹配演员"
                    : "新建并关联演员"}
              </Button>
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

          <section className="space-y-4 border-t border-border/70 px-6 py-5">
            <div className="flex items-center gap-2">
              <HardDrive className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">关联文件</h2>
              {files.length > 0 && (
                <span className="text-xs text-muted-foreground">{files.length} 个</span>
              )}
            </div>

            {files.length > 0 ? (
              <div className="space-y-2">
                {files.map((file) => (
                  <div key={file.id} className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{getFileDisplayName(file)}</span>
                        <ProviderBadge provider={file.provider} />
                      </div>
                      <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{file.file_path}</div>
                      <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                        {file.file_size != null && <span>{formatFileSize(file.file_size)}</span>}
                        {file.provider_url && (
                          <span className="truncate">{file.provider_url}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        title="复制路径"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(file.provider_url || file.file_path);
                            toast.success("已复制路径");
                          } catch {
                            toast.error("复制失败");
                          }
                        }}
                      >
                        <Copy className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        title="删除"
                        onClick={() => {
                          void handleRemoveFile(file.id);
                        }}
                        disabled={fileBusy}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">暂无关联文件</p>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">手动输入路径，或从已配置的网盘浏览：</span>
              </div>
              <textarea
                placeholder="粘贴一个或多个文件路径，每行一个..."
                value={newFilePath}
                onChange={(event) => setNewFilePath(event.target.value)}
                className="min-h-20 w-full rounded-xl border border-border bg-background/70 px-3 py-2 font-mono text-xs leading-5 focus:outline-none focus:ring-1 focus:ring-ring"
                disabled={fileBusy}
                onKeyDown={(event) => {
                  const paths = parseFilePaths(newFilePath);
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && paths.length > 0) {
                    void handleAddFiles(paths);
                  }
                }}
              />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const paths = parseFilePaths(newFilePath);
                      if (paths.length > 0) void handleAddFiles(paths);
                    }}
                    disabled={fileBusy || parseFilePaths(newFilePath).length === 0}
                    className="rounded-xl"
                  >
                    <Plus className="size-3.5" />
                    添加 {parseFilePaths(newFilePath).length > 1 ? `${parseFilePaths(newFilePath).length} 个` : ""}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFileBrowserOpen(true)}
                    disabled={fileBusy}
                    className="rounded-xl"
                  >
                    <Cloud className="size-3.5" />
                    从网盘添加
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ctrl+Enter 快速添加
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <ImageLightbox
        items={lightboxItems}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

      <FileBrowserDialog
        open={fileBrowserOpen}
        onClose={() => setFileBrowserOpen(false)}
        onSelect={(selected) => {
          void handleFilesSelected(selected);
        }}
        code={code}
      />
    </div>
  );
}

// ── File helpers ───────────────────────────────────────────────────────────

function ProviderBadge({ provider }: { provider: string }) {
  if (provider === "local") {
    return (
      <span className="inline-flex items-center rounded-full border border-border/60 bg-background px-2 py-px text-[10px] text-muted-foreground">
        本地
      </span>
    );
  }
  if (provider === "webdav") {
    return (
      <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-px text-[10px] text-blue-600 dark:text-blue-400">
        WebDAV
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border/60 bg-background px-2 py-px text-[10px] text-muted-foreground">
      {provider}
    </span>
  );
}




import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, ExternalLink, Film, FolderTree, Tag, User, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SummaryCard } from "@/components/ui/summary-card";
import { assetUrl } from "@/lib/assetUrl";
import { useMovieFilterNavigation } from "@/hooks/useMovieFilterNavigation";
import { getMovieActors, getMovieByCode, getMovieGenres, getMovieTags } from "@/services/movieService";
import { getMovieFiles } from "@/services/fileService";

interface MovieQuickPreviewPanelProps {
  code: string;
  onClose: () => void;
}

export function MovieQuickPreviewPanel({ code, onClose }: MovieQuickPreviewPanelProps) {
  const navigate = useNavigate();
  const openMoviesWithFilter = useMovieFilterNavigation();
  const { data: movie, isLoading } = useQuery({
    queryKey: ["moviePreview", code],
    queryFn: () => getMovieByCode(code),
    enabled: !!code,
  });
  const { data: actors = [] } = useQuery({
    queryKey: ["moviePreviewActors", code],
    queryFn: () => getMovieActors(code),
    enabled: !!code,
  });
  const { data: tags = [] } = useQuery({
    queryKey: ["moviePreviewTags", code],
    queryFn: () => getMovieTags(code),
    enabled: !!code,
  });
  const { data: genres = [] } = useQuery({
    queryKey: ["moviePreviewGenres", code],
    queryFn: () => getMovieGenres(code),
    enabled: !!code,
  });
  const { data: files = [] } = useQuery({
    queryKey: ["moviePreviewFiles", code],
    queryFn: () => getMovieFiles(code),
    enabled: !!code,
  });

  if (!code) return null;

  return (
    <aside className="w-[360px] shrink-0 border-l border-border bg-card/60">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-medium">快速预览</p>
          <p className="text-xs text-muted-foreground">不离开列表快速查看影片关系</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="h-[calc(100vh-73px)] overflow-y-auto p-4">
        {isLoading || !movie ? (
          <div className="space-y-3">
            <div className="aspect-[3/4] animate-pulse rounded-xl bg-muted" />
            <div className="h-6 animate-pulse rounded bg-muted" />
            <div className="h-20 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-border bg-background/50">
              <div className="aspect-[3/4] bg-muted">
                {assetUrl(movie.cover_path) ? (
                  <img
                    src={assetUrl(movie.cover_path)}
                    alt={movie.title ?? movie.code}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Film className="size-12 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <div className="space-y-2 p-4">
                <div>
                  <p className="font-mono text-lg font-semibold text-primary">{movie.code}</p>
                  <p className="mt-1 text-sm font-medium">{movie.title || "未命名影片"}</p>
                  {movie.title_jp && <p className="text-xs text-muted-foreground">{movie.title_jp}</p>}
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {movie.release_date && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="size-3.5" /> {movie.release_date}
                    </span>
                  )}
                  {movie.runtime && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" /> {movie.runtime} min
                    </span>
                  )}
                </div>

                <div className="grid gap-3 grid-cols-2">
                  <SummaryCard label="演员" value={actors.length} />
                  <SummaryCard label="标签" value={tags.length} />
                  <SummaryCard label="类型" value={genres.length} />
                  <SummaryCard label="文件" value={files.length} />
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => navigate(`/movies/${encodeURIComponent(movie.code)}`)}>
                    <ExternalLink className="size-4" />
                    打开详情
                  </Button>
                  {movie.series && (
                    <Button variant="outline" onClick={() => openMoviesWithFilter({ series: movie.series ?? undefined }, { title: movie.series ?? undefined, subtitle: "系列" })}>
                      系列作品
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <RelationBlock title="演员" icon={User}>
              {actors.length > 0 ? actors.map((actor) => (
                <div key={actor.id} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs">
                  <Link to={`/actors/${actor.id}`} className="font-medium hover:text-primary">{actor.name}</Link>
                  <button
                    type="button"
                    onClick={() => openMoviesWithFilter({ actor_ids: [actor.id] }, { title: actor.name, subtitle: "演员作品" })}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    作品
                  </button>
                </div>
              )) : <EmptyRelation label="暂无演员" />}
            </RelationBlock>

            <RelationBlock title="标签" icon={Tag}>
              {tags.length > 0 ? tags.map((tag) => (
                <button key={tag.id} type="button" onClick={() => openMoviesWithFilter({ tag_ids: [tag.id] }, { title: tag.name, subtitle: "标签筛选" })}>
                  <Badge variant="outline" className="cursor-pointer transition-colors hover:bg-accent">{tag.name}</Badge>
                </button>
              )) : <EmptyRelation label="暂无标签" />}
            </RelationBlock>

            <RelationBlock title="类型" icon={FolderTree}>
              {genres.length > 0 ? genres.map((genre) => (
                <button key={genre.id} type="button" onClick={() => openMoviesWithFilter({ genre_ids: [genre.id] }, { title: genre.name, subtitle: "类型筛选" })}>
                  <Badge variant="outline" className="cursor-pointer transition-colors hover:bg-accent">{genre.name}</Badge>
                </button>
              )) : <EmptyRelation label="暂无类型" />}
            </RelationBlock>

            <div className="rounded-xl border border-border/70 bg-background/40 p-4">
              <h3 className="text-sm font-medium">评论</h3>
              <p className="mt-2 text-sm text-muted-foreground">{movie.comment || movie.notes || "暂无备注"}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function RelationBlock({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4 text-muted-foreground" />
        <span>{title}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </section>
  );
}

function EmptyRelation({ label }: { label: string }) {
  return <p className="text-xs text-muted-foreground">{label}</p>;
}
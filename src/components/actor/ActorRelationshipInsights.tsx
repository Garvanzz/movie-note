import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { FolderTree, Sparkles, Tag, User } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useMovieFilterNavigation } from "@/hooks/useMovieFilterNavigation";
import { getMovies, getMovieActors, getMovieGenres, getMovieTags } from "@/services/movieService";

interface ActorRelationshipInsightsProps {
  actorId: number;
}

export function ActorRelationshipInsights({ actorId }: ActorRelationshipInsightsProps) {
  const openMoviesWithFilter = useMovieFilterNavigation();
  const { data: movieData, isLoading } = useQuery({
    queryKey: ["actorRelationshipMovies", actorId],
    queryFn: () => getMovies({ actor_ids: [actorId], sort_by: "updated_at", sort_dir: "desc" }, 1, 30),
    enabled: actorId > 0,
  });

  const movieCodes = (movieData?.items ?? []).map((movie) => movie.code);
  const tagQueries = useQueries({
    queries: movieCodes.map((code) => ({
      queryKey: ["actorRelationshipTags", actorId, code] as const,
      queryFn: () => getMovieTags(code),
      enabled: movieCodes.length > 0,
      staleTime: 60_000,
    })),
  });
  const genreQueries = useQueries({
    queries: movieCodes.map((code) => ({
      queryKey: ["actorRelationshipGenres", actorId, code] as const,
      queryFn: () => getMovieGenres(code),
      enabled: movieCodes.length > 0,
      staleTime: 60_000,
    })),
  });
  const actorQueries = useQueries({
    queries: movieCodes.map((code) => ({
      queryKey: ["actorRelationshipActors", actorId, code] as const,
      queryFn: () => getMovieActors(code),
      enabled: movieCodes.length > 0,
      staleTime: 60_000,
    })),
  });

  const relatedTags = useMemo(
    () => aggregateRelations(tagQueries.map((query) => query.data ?? []), 6),
    [tagQueries],
  );
  const relatedGenres = useMemo(
    () => aggregateRelations(genreQueries.map((query) => query.data ?? []), 6),
    [genreQueries],
  );
  const coActors = useMemo(
    () => aggregateRelations(actorQueries.map((query) => (query.data ?? []).filter((actor) => actor.id !== actorId)), 6),
    [actorId, actorQueries],
  );

  if (isLoading || movieCodes.length === 0) return null;

  return (
    <section className="space-y-4 border-t border-border pt-6">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">关系洞察</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <InsightBlock title="常见标签" icon={Tag}>
          {relatedTags.length > 0 ? relatedTags.map((tag) => (
            <button
              key={`tag-${tag.id}`}
              type="button"
              onClick={() => openMoviesWithFilter({ actor_ids: [actorId], tag_ids: [tag.id] }, { title: tag.name, subtitle: "常见标签" })}
            >
              <Badge variant="outline" className="cursor-pointer gap-1 transition-colors hover:bg-accent">
                {tag.name}
                <span className="text-[10px] text-muted-foreground">{tag.count}</span>
              </Badge>
            </button>
          )) : <EmptyInsight label="暂无标签洞察" />}
        </InsightBlock>

        <InsightBlock title="常见类型" icon={FolderTree}>
          {relatedGenres.length > 0 ? relatedGenres.map((genre) => (
            <button
              key={`genre-${genre.id}`}
              type="button"
              onClick={() => openMoviesWithFilter({ actor_ids: [actorId], genre_ids: [genre.id] }, { title: genre.name, subtitle: "常见类型" })}
            >
              <Badge variant="outline" className="cursor-pointer gap-1 transition-colors hover:bg-accent">
                {genre.name}
                <span className="text-[10px] text-muted-foreground">{genre.count}</span>
              </Badge>
            </button>
          )) : <EmptyInsight label="暂无类型洞察" />}
        </InsightBlock>

        <InsightBlock title="合作演员" icon={User}>
          {coActors.length > 0 ? coActors.map((actor) => (
            <div key={`actor-${actor.id}`} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs">
              <Link to={`/actors/${actor.id}`} className="font-medium transition-colors hover:text-primary">{actor.name}</Link>
              <button
                type="button"
                onClick={() => openMoviesWithFilter({ actor_ids: [actor.id] }, { title: actor.name, subtitle: "合作演员作品" })}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                作品
              </button>
              <span className="text-[10px] text-muted-foreground">{actor.count}</span>
            </div>
          )) : <EmptyInsight label="暂无合作演员洞察" />}
        </InsightBlock>
      </div>
    </section>
  );
}

function aggregateRelations<T extends { id: number; name: string }>(groups: T[][], limit: number) {
  const map = new Map<number, { id: number; name: string; count: number }>();
  groups.forEach((items) => {
    items.forEach((item) => {
      const current = map.get(item.id);
      if (current) {
        current.count += 1;
        return;
      }
      map.set(item.id, { id: item.id, name: item.name, count: 1 });
    });
  });

  return Array.from(map.values())
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "zh-CN"))
    .slice(0, limit);
}

function InsightBlock({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Sparkles;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/40 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4 text-muted-foreground" />
        <span>{title}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function EmptyInsight({ label }: { label: string }) {
  return <p className="text-xs text-muted-foreground">{label}</p>;
}
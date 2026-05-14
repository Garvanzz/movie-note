import { useNavigate } from "react-router-dom";
import type { Movie } from "@/types/movie";
import { cn } from "@/lib/utils";
import { Star, Film, Eye, EyeOff, Play, Pause } from "lucide-react";

const statusIcons: Record<string, React.ReactNode> = {
  unwatched: <EyeOff className="size-3" />,
  watched: <Eye className="size-3" />,
  watching: <Play className="size-3" />,
  paused: <Pause className="size-3" />,
};

interface MovieCardProps {
  movie: Movie;
}

export function MovieCard({ movie }: MovieCardProps) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/movies/${encodeURIComponent(movie.code)}`)}
      className={cn(
        "group cursor-pointer rounded-lg border border-border bg-card overflow-hidden",
        "hover:border-primary/50 hover:shadow-lg transition-all duration-200",
      )}
    >
      {/* Cover image */}
      <div className="aspect-[3/4] bg-muted relative overflow-hidden">
        {movie.cover_path ? (
          <img
            src={movie.cover_path}
            alt={movie.title ?? movie.code}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="size-12 text-muted-foreground/30" />
          </div>
        )}

        {/* Watch status badge */}
        <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5">
          {statusIcons[movie.watch_status] ?? statusIcons.unwatched}
        </div>

        {/* Rating */}
        {movie.rating != null && (
          <div className="absolute bottom-2 left-2 bg-black/60 rounded-md px-1.5 py-0.5 flex items-center gap-1 text-xs text-yellow-400">
            <Star className="size-3 fill-yellow-400" />
            {movie.rating.toFixed(1)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 space-y-1">
        <div className="text-xs font-mono text-primary font-semibold truncate">
          {movie.code}
        </div>
        <div className="text-xs text-muted-foreground line-clamp-2 leading-tight">
          {movie.title || " "}
        </div>
      </div>
    </div>
  );
}

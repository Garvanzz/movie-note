import { useNavigate } from "react-router-dom";
import type { Movie } from "@/types/movie";
import { cn } from "@/lib/utils";
import { assetUrl } from "@/lib/assetUrl";
import { Eye, Film, Star, Trash2 } from "lucide-react";
import { getMovieWatchStatusMeta } from "@/lib/movieWatchStatus";

interface MovieCardProps {
  movie: Movie;
  onDelete?: (code: string) => void;
  onOpenPreview?: (code: string) => void;
  selected?: boolean;
  focused?: boolean;
  onToggleSelect?: (code: string, checked: boolean) => void;
}

export function MovieCard({ movie, onDelete, onOpenPreview, selected = false, focused = false, onToggleSelect }: MovieCardProps) {
  const navigate = useNavigate();
  const watchStatus = getMovieWatchStatusMeta(movie.watch_status);

  return (
    <div
      onClick={() => navigate(`/movies/${encodeURIComponent(movie.code)}`)}
      className={cn(
        "group cursor-pointer rounded-lg border border-border bg-card overflow-hidden",
        "hover:border-primary/50 hover:shadow-lg transition-all duration-200",
        selected && "border-primary ring-1 ring-primary/40",
        focused && "border-amber-400 ring-2 ring-amber-300/40",
      )}
    >
      {/* Cover image */}
      <div className="aspect-[3/4] bg-muted relative overflow-hidden">
        {assetUrl(movie.cover_path) ? (
          <img
            src={assetUrl(movie.cover_path)}
            alt={movie.title ?? movie.code}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="size-12 text-muted-foreground/30" />
          </div>
        )}

        {onToggleSelect && (
          <label className="absolute top-2 left-2 flex size-6 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white">
            <input
              type="checkbox"
              checked={selected}
              onChange={(event) => onToggleSelect(movie.code, event.target.checked)}
              onClick={(event) => event.stopPropagation()}
              className="size-3.5"
            />
          </label>
        )}

        {/* Delete button */}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(movie.code);
            }}
            className={cn(
              "absolute bg-black/60 rounded-full p-1.5 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100",
              onToggleSelect ? "top-10 left-2" : "top-2 left-2",
            )}
          >
            <Trash2 className="size-3" />
          </button>
        )}
        {onOpenPreview && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onOpenPreview(movie.code);
            }}
            className="absolute top-10 right-2 rounded-full bg-black/60 p-1.5 opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
            title="快速预览"
          >
            <Eye className="size-3" />
          </button>
        )}

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
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-mono text-primary font-semibold truncate">{movie.code}</div>
          <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <watchStatus.icon className="size-3" />
            <span>{watchStatus.label}</span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground line-clamp-2 leading-tight">
          {movie.title || " "}
        </div>
      </div>
    </div>
  );
}

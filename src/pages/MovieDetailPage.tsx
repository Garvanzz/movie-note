import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Star, Clock, Calendar, Film, Plus, Trash2, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getMovieByCode, updateMovie, getMovieTags } from "@/services/movieService";
import { getMovieFiles, addMovieFile, removeMovieFile } from "@/services/fileService";
import { useState } from "react";

export function MovieDetailPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState<number | undefined>();
  const [newFilePath, setNewFilePath] = useState("");

  const { data: movie, isLoading } = useQuery({
    queryKey: ["movie", code],
    queryFn: () => getMovieByCode(code!),
    enabled: !!code,
  });

  const { data: tags } = useQuery({
    queryKey: ["movieTags", code],
    queryFn: () => getMovieTags(code!),
    enabled: !!code,
  });

  const { data: files } = useQuery({
    queryKey: ["movieFiles", code],
    queryFn: () => getMovieFiles(code!),
    enabled: !!code,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { comment?: string; rating?: number }) =>
      updateMovie(code!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movie", code] });
      setEditing(false);
    },
  });

  const addFileMutation = useMutation({
    mutationFn: (path: string) => addMovieFile(code!, path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movieFiles", code] });
      setNewFilePath("");
    },
  });

  const removeFileMutation = useMutation({
    mutationFn: (fileId: number) => removeMovieFile(fileId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["movieFiles", code] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin size-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Film className="size-16 text-muted-foreground/30" />
        <p className="text-muted-foreground">影片不存在</p>
        <Button variant="outline" onClick={() => navigate("/")}>返回列表</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-8">
      {/* Header */}
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        返回列表
      </button>

      {/* Hero section */}
      <div className="flex gap-8">
        {/* Cover */}
        <div className="w-56 shrink-0">
          <div className="aspect-[3/4] bg-muted rounded-xl overflow-hidden border border-border">
            {movie.cover_path ? (
              <img src={movie.cover_path} alt={movie.title ?? ""} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Film className="size-16 text-muted-foreground/20" />
              </div>
            )}
          </div>

          {movie.rating != null && (
            <div className="mt-3 flex items-center justify-center gap-1 text-yellow-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={i < Math.round(movie.rating!) ? "fill-yellow-400" : ""}
                />
              ))}
              <span className="text-sm ml-1">{movie.rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-2xl font-bold font-mono text-primary">{movie.code}</h1>
            <h2 className="text-lg mt-1">{movie.title || " "}</h2>
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            {movie.release_date && (
              <span className="flex items-center gap-1">
                <Calendar className="size-3.5" /> {movie.release_date}
              </span>
            )}
            {movie.runtime && (
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" /> {movie.runtime} min
              </span>
            )}
            {movie.series && (
              <Badge variant="secondary">{movie.series}</Badge>
            )}
          </div>

          {/* Tags */}
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge key={tag.id} variant="outline">{tag.name}</Badge>
              ))}
            </div>
          )}

          {/* Comment */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">评论</h3>
              <Button variant="ghost" size="sm" onClick={() => {
                setComment(movie.comment ?? "");
                setRating(movie.rating ?? undefined);
                setEditing(!editing);
              }}>
                <Edit3 className="size-3.5" />
              </Button>
            </div>

            {editing ? (
              <div className="space-y-3">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button key={v} onClick={() => setRating(v)}>
                      <Star className={rating && v <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"} />
                    </button>
                  ))}
                </div>
                <textarea
                  className="w-full h-24 bg-muted rounded-md p-3 text-sm border border-border focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="写下你的评论..."
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => updateMutation.mutate({ comment, rating })}>
                    保存
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                    取消
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {movie.comment || "暂无评论"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Files section */}
      <div className="border-t border-border pt-6">
        <h3 className="text-sm font-medium mb-3">网盘文件</h3>
        {files && files.length > 0 ? (
          <div className="space-y-2">
            {files.map((f) => (
              <div key={f.id} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="truncate font-mono text-xs">{f.file_path}</div>
                  <div className="flex gap-4 text-xs text-muted-foreground mt-0.5">
                    {f.file_name && <span>{f.file_name}</span>}
                    {f.file_size && <span>{formatSize(f.file_size)}</span>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeFileMutation.mutate(f.id)}>
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">暂无关联文件</p>
        )}

        <div className="flex gap-2 mt-3">
          <Input
            placeholder="输入网盘文件路径..."
            value={newFilePath}
            onChange={(e) => setNewFilePath(e.target.value)}
            className="flex-1 font-mono text-xs"
          />
          <Button size="sm" onClick={() => newFilePath && addFileMutation.mutate(newFilePath)}>
            <Plus className="size-4" />
            添加
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

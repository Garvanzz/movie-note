import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createMovie } from "@/services/movieService";
import { toast } from "sonner";

interface Props {
  onClose: () => void;
}

export function AddMovieDialog({ onClose }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!code.trim()) return;
    setSubmitting(true);
    try {
      const movie = await createMovie(code.trim());
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      toast.success(`已添加 ${movie.code}`);
      onClose();
      navigate(`/movies/${encodeURIComponent(movie.code)}`);
    } catch (e) {
      const message = String(e);
      const isDuplicate = /UNIQUE constraint failed|unique constraint|重复|already exists/i.test(message);
      toast.error(isDuplicate ? "添加失败：该影片已存在" : `添加失败: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="m-4 w-full max-w-sm overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border/80 bg-background p-2.5 text-foreground">
              <Plus className="size-5" />
            </div>
            <h2 className="text-base font-semibold">添加影片</h2>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="text-sm font-medium mb-1.5 block">番号</label>
            <Input
              ref={inputRef}
              placeholder="例如 IPX-123"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="h-11 rounded-xl border-border/80 bg-background/70 shadow-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border/80 px-5 py-4">
          <Button variant="outline" className="h-10 rounded-xl" onClick={onClose}>取消</Button>
          <Button variant="secondary" className="h-10 rounded-xl" onClick={handleSubmit} disabled={submitting || !code.trim()}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            添加
          </Button>
        </div>
      </div>
    </div>
  );
}

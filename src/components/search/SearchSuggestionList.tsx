import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchSuggestionItem {
  key: string;
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: string;
  onSelect: () => void;
}

interface SearchSuggestionListProps {
  open: boolean;
  loading?: boolean;
  emptyLabel?: string;
  items: SearchSuggestionItem[];
  className?: string;
}

export function SearchSuggestionList({
  open,
  loading = false,
  emptyLabel = "没有匹配结果",
  items,
  className,
}: SearchSuggestionListProps) {
  if (!open) return null;

  return (
    <div
      className={cn(
        "absolute left-0 top-full z-40 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl",
        className,
      )}
    >
      {loading && items.length === 0 ? (
        <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          正在匹配...
        </div>
      ) : items.length > 0 ? (
        <div className="max-h-72 overflow-y-auto p-2">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={item.onSelect}
              className="flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-accent"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
                  {item.badge ? (
                    <span className="rounded-full border border-border/80 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
                {item.subtitle ? <div className="truncate text-xs text-muted-foreground">{item.subtitle}</div> : null}
              </div>
              {item.meta ? <div className="shrink-0 text-[11px] text-muted-foreground">{item.meta}</div> : null}
            </button>
          ))}
        </div>
      ) : (
        <div className="px-3 py-3 text-sm text-muted-foreground">{emptyLabel}</div>
      )}
    </div>
  );
}

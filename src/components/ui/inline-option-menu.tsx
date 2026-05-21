import { useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

export interface InlineOptionMenuOption {
  id: number;
  label: string;
  secondaryLabel?: string;
}

interface InlineOptionMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerLabel: string;
  emptyLabel: string;
  options: InlineOptionMenuOption[];
  disabled?: boolean;
  onSelect: (id: number) => void;
}

export function InlineOptionMenu({
  open,
  onOpenChange,
  triggerLabel,
  emptyLabel,
  options,
  disabled,
  onSelect,
}: InlineOptionMenuProps) {
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

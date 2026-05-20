import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeftRight, Check, Loader2, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listWorkspaces, switchWorkspace } from "@/services/workspaceService";
import { useMovieFilterStore } from "@/stores/movieFilterStore";
import { useRecentVisitsStore } from "@/stores/recentVisitsStore";
import { toast } from "sonner";

interface WorkspaceSwitchDialogProps {
  open: boolean;
  onClose: () => void;
}

const STORAGE_KEYS = ["movie-filter-store", "recent-visits", "interaction-stats", "movie-list-scroll-top"];

export function WorkspaceSwitchDialog({ open, onClose }: WorkspaceSwitchDialogProps) {
  const queryClient = useQueryClient();
  const resetMovieFilters = useMovieFilterStore((state) => state.resetFilter);
  const clearVisits = useRecentVisitsStore((state) => state.clearVisits);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [pendingWorkspaceName, setPendingWorkspaceName] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  const { data: workspaces, isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: listWorkspaces,
    enabled: open,
  });

  const activeWorkspace = useMemo(() => workspaces?.find((workspace) => workspace.is_active), [workspaces]);

  if (!open) return null;

  const closeAll = () => {
    if (switching) return;
    setPendingWorkspaceName(null);
    onClose();
  };

  const clearClientState = () => {
    resetMovieFilters();
    clearVisits();
    queryClient.clear();
    STORAGE_KEYS.forEach((key) => {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    });
  };

  const requestSwitch = (workspaceName: string) => {
    const normalized = workspaceName.trim();
    if (!normalized) {
      toast.error("请输入工作区名称");
      return;
    }

    if (normalized === activeWorkspace?.name) {
      toast.error("已经是当前用户");
      return;
    }

    setPendingWorkspaceName(normalized);
  };

  const handleSwitch = async () => {
    if (!pendingWorkspaceName) return;

    try {
      setSwitching(true);
      clearClientState();
      await switchWorkspace(pendingWorkspaceName);
      window.location.reload();
    } catch (error) {
      toast.error(`切换工作区失败: ${error}`);
      setSwitching(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeAll();
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl">
        <div className="border-b border-border/80 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border/80 bg-background p-2.5 text-foreground">
              <ArrowLeftRight className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold">切换用户</h2>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>当前</span>
                <span className="rounded-full border border-border/80 bg-background px-2 py-0.5 text-foreground">
                  {activeWorkspace?.name ?? "default"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="rounded-2xl border border-border/80 bg-background/70 p-3">
            <div className="flex gap-2">
              <Input
                placeholder="输入新用户名"
                value={newWorkspaceName}
                onChange={(event) => setNewWorkspaceName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    requestSwitch(newWorkspaceName);
                  }
                }}
                disabled={switching}
                className="h-11 border-border/80 bg-card"
              />
              <Button
                variant="secondary"
                className="h-11 min-w-24 rounded-xl whitespace-nowrap"
                onClick={() => requestSwitch(newWorkspaceName)}
                disabled={switching}
              >
                <Plus className="size-4" />
                新建
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <UserRound className="size-4 text-muted-foreground" />
              <span>已有用户</span>
            </div>

            {isLoading ? (
              <div className="flex items-center gap-2 rounded-2xl border border-border/80 bg-background/60 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                读取中...
              </div>
            ) : workspaces && workspaces.length > 0 ? (
              <div className="grid gap-2">
                {workspaces.map((workspace) => (
                  <button
                    key={workspace.name}
                    type="button"
                    onClick={() => requestSwitch(workspace.name)}
                    disabled={switching || workspace.is_active}
                    className={[
                      "flex items-center justify-between rounded-2xl border px-3 py-3 text-left transition-colors",
                      workspace.is_active
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : "border-border/80 bg-background/60 hover:border-primary/40 hover:bg-accent/40",
                    ].join(" ")}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{workspace.name}</div>
                    </div>
                    {workspace.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        <Check className="size-3" />
                        当前
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">切换</span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/80 px-3 py-6 text-center text-sm text-muted-foreground">
                还没有其他用户
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-border/80 px-5 py-4">
          <Button variant="outline" className="h-10 rounded-xl" onClick={closeAll} disabled={switching}>
            取消
          </Button>
        </div>

        {pendingWorkspaceName && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/60 px-4"
            onClick={(event) => {
              if (event.target === event.currentTarget && !switching) {
                setPendingWorkspaceName(null);
              }
            }}
          >
            <div className="w-full max-w-sm rounded-3xl border border-border/80 bg-card p-5 shadow-2xl">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-destructive/10 p-2.5 text-destructive">
                  <AlertTriangle className="size-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold">确认切换</h3>
                  <p className="text-sm text-muted-foreground">
                    切换到 <span className="text-foreground">{pendingWorkspaceName}</span>
                  </p>
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" className="h-10 rounded-xl" onClick={() => setPendingWorkspaceName(null)} disabled={switching}>
                  返回
                </Button>
                <Button variant="secondary" className="h-10 rounded-xl" onClick={handleSwitch} disabled={switching}>
                  {switching ? "切换中..." : "切换"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
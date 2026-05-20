import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, Search } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlobalSearchDialog } from "@/components/layout/GlobalSearchDialog";
import { WorkspaceSwitchDialog } from "@/components/layout/WorkspaceSwitchDialog";
import { listWorkspaces } from "@/services/workspaceService";

const ROUTE_META: Array<{ match: RegExp; title: string }> = [
  { match: /^\/$/, title: "影片工作台" },
  { match: /^\/movies\//, title: "影片详情" },
  { match: /^\/actors$/, title: "演员目录" },
  { match: /^\/actors\//, title: "演员详情" },
  { match: /^\/actor-categories$/, title: "演员类型" },
  { match: /^\/tags$/, title: "标签管理" },
  { match: /^\/genres$/, title: "类型管理" },
];

export function AppTopBar() {
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [workspaceSwitchOpen, setWorkspaceSwitchOpen] = useState(false);
  const { data: workspaces } = useQuery({ queryKey: ["workspaces"], queryFn: listWorkspaces });
  const activeWorkspace = workspaces?.find((workspace) => workspace.is_active);

  const routeMeta = useMemo(() => {
    return ROUTE_META.find((item) => item.match.test(location.pathname)) ?? {
      title: "Movie Note",
    };
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <header className="border-b border-border bg-card/70 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-card/55">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Movie Note
              </Badge>
              <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-xs">
                当前用户: {activeWorkspace?.name ?? "default"}
              </Badge>
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{routeMeta.title}</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setSearchOpen(true)}>
              <Search className="size-4" />
              搜索
              <span className="rounded border border-border/80 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                Ctrl+K
              </span>
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setWorkspaceSwitchOpen(true)}>
              <ArrowLeftRight className="size-4" />
              切换用户
            </Button>
          </div>
        </div>
      </header>

      <GlobalSearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <WorkspaceSwitchDialog open={workspaceSwitchOpen} onClose={() => setWorkspaceSwitchOpen(false)} />
    </>
  );
}
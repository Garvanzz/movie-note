import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Cloud, DatabaseZap, Download, Film, FolderTree, Tag, Upload, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { assetUrl } from "@/lib/assetUrl";
import { clearDatabase, exportAllData, importAllData, writeJsonFile } from "@/services/dataService";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { useMovieFilterStore } from "@/stores/movieFilterStore";

const navItems = [
  { to: "/", label: "影片", icon: Film },
  { to: "/actors", label: "演员", icon: Users },
  { to: "/tags", label: "标签", icon: Tag },
  { to: "/genres", label: "类型", icon: FolderTree },
  { to: "/cloud", label: "网盘", icon: Cloud },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const resetMovieFilters = useMovieFilterStore((state) => state.resetFilter);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleExport = async () => {
    try {
      const filePath = await save({
        defaultPath: `movie-note-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!filePath) return;
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
      await writeJsonFile(filePath, json);
      toast.success("数据导出成功");
    } catch (e) {
      toast.error(`导出失败: ${e}`);
    }
  };

  const handleImport = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!selected || Array.isArray(selected)) return;

      const importUrl = assetUrl(selected) ?? selected;
      const text = await fetch(importUrl).then((response) => response.text());
      const data = JSON.parse(text);
      const count = await importAllData(data);
      await queryClient.invalidateQueries();
      toast.success(`导入 ${count} 条数据成功`);
    } catch (e) {
      toast.error(`导入失败: ${e}`);
    }
  };

  const handleClearDatabase = async () => {
    setClearing(true);
    try {
      const removedCount = await clearDatabase();
      resetMovieFilters();
      await queryClient.invalidateQueries();
      await queryClient.refetchQueries({ type: "active" });
      setClearDialogOpen(false);
      toast.success(`数据库已清空，共删除 ${removedCount} 条记录`);
    } catch (e) {
      toast.error(`清空数据库失败: ${e}`);
    } finally {
      setClearing(false);
    }
  };

  return (
    <aside className="w-[88px] shrink-0 border-r border-border bg-card/95">
      <div className="flex h-full flex-col px-3 py-4">
        <div className="mb-4 flex items-center justify-center">
          <div className="flex size-11 items-center justify-center rounded-2xl border border-border/80 bg-background text-sm font-semibold tracking-[0.18em] text-foreground shadow-sm">
            MN
          </div>
        </div>

        <div className="space-y-1.5">
          {navItems.map((item) => (
            <button
              key={item.to}
              type="button"
              onClick={() => navigate(item.to)}
              className={cn(
                "flex w-full cursor-pointer flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[11px] transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                isNavItemActive(location.pathname, item.to)
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
              aria-current={isNavItemActive(location.pathname, item.to) ? "page" : undefined}
            >
              <item.icon className="size-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-auto rounded-2xl border border-border/70 bg-background/60 p-2 shadow-sm">
          <div className="space-y-1">
            <button
              onClick={handleExport}
              title="导出数据"
              className="flex w-full flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Download className="size-4" />
              <span>导出</span>
            </button>
            <button
              onClick={handleImport}
              title="导入数据"
              className="flex w-full flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Upload className="size-4" />
              <span>导入</span>
            </button>
            <button
              onClick={() => setClearDialogOpen(true)}
              title="清空数据库"
              className="flex w-full flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
            >
              <DatabaseZap className="size-4" />
              <span>清空</span>
            </button>
          </div>
        </div>
      </div>

      {clearDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(event) => {
            if (event.target === event.currentTarget && !clearing) {
              setClearDialogOpen(false);
            }
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl">
            <div className="flex items-start gap-3 border-b border-border/80 px-5 py-4">
              <div className="rounded-2xl bg-destructive/10 p-2.5 text-destructive">
                <AlertTriangle className="size-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold">确认清空数据库</h2>
                <p className="text-sm text-muted-foreground">
                  此操作会删除所有影片、演员、标签和关联数据，且无法撤销。建议先执行导出备份。
                </p>
              </div>
            </div>

            <div className="space-y-2 px-5 py-5 text-sm text-muted-foreground">
              <p>确认后会立即执行清空。</p>
              <p>当前用户工作区下的图片和关联数据都会被清空，请先导出备份。</p>
            </div>

            <div className="flex justify-end gap-2 border-t border-border/80 p-5">
              <Button variant="outline" className="h-10 rounded-xl" onClick={() => setClearDialogOpen(false)} disabled={clearing}>
                取消
              </Button>
              <Button onClick={handleClearDatabase} disabled={clearing} className="h-10 rounded-xl bg-destructive text-white hover:bg-destructive/90">
                {clearing ? "清空中..." : "确认清空"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function isNavItemActive(pathname: string, targetPath: string) {
  if (targetPath === "/") {
    return pathname === "/";
  }

  return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
}

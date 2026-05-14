import { NavLink } from "react-router-dom";
import { Film, Users, Tag, FolderTree, Download, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { exportAllData, importAllData } from "@/services/dataService";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const navItems = [
  { to: "/", label: "影片", icon: Film },
  { to: "/actors", label: "演员", icon: Users },
  { to: "/tags", label: "标签", icon: Tag },
  { to: "/genres", label: "类型", icon: FolderTree },
];

export function Sidebar() {
  const queryClient = useQueryClient();

  const handleExport = async () => {
    try {
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `movie-note-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("数据导出成功");
    } catch (e) {
      toast.error(`导出失败: ${e}`);
    }
  };

  const handleImport = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const count = await importAllData(data);
        queryClient.invalidateQueries();
        toast.success(`导入 ${count} 条数据成功`);
      } catch (e) {
        toast.error(`导入失败: ${e}`);
      }
    };
    input.click();
  };

  return (
    <aside className="w-16 flex flex-col items-center gap-1 py-4 border-r border-border bg-card shrink-0">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-0.5 p-2 rounded-lg text-xs transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground"
            )
          }
        >
          <item.icon className="size-5" />
          <span>{item.label}</span>
        </NavLink>
      ))}

      <div className="mt-auto flex flex-col items-center gap-1 pb-2">
        <button
          onClick={handleExport}
          title="导出数据"
          className="flex flex-col items-center gap-0.5 p-2 rounded-lg text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Download className="size-4" />
          <span>导出</span>
        </button>
        <button
          onClick={handleImport}
          title="导入数据"
          className="flex flex-col items-center gap-0.5 p-2 rounded-lg text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Upload className="size-4" />
          <span>导入</span>
        </button>
      </div>
    </aside>
  );
}

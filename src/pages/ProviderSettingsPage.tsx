import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Cloud, Edit, Globe, HardDrive, Plus, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  listProviderConfigs,
  saveProviderConfig,
  deleteProviderConfig,
} from "@/services/fileService";
import type { ProviderConfigData } from "@/types/file";

export function ProviderSettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["providerConfigs"],
    queryFn: listProviderConfigs,
  });

  const [editing, setEditing] = useState<ProviderConfigData | null>(null);
  const [form, setForm] = useState<ProviderConfigData>(emptyForm());
  const [saving, setSaving] = useState(false);

  const handleNew = () => {
    const fresh = emptyForm();
    setForm(fresh);
    setEditing(fresh);
  };

  const handleEdit = (config: ProviderConfigData) => {
    setForm({ ...config });
    setEditing({ ...config });
  };

  const handleCancel = () => {
    setEditing(null);
    setForm(emptyForm());
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("请输入连接名称");
      return;
    }
    if (form.provider_type === "webdav" && !form.endpoint?.trim()) {
      toast.error("WebDAV 连接需要填写端点地址");
      return;
    }
    setSaving(true);
    try {
      await saveProviderConfig(form);
      await queryClient.invalidateQueries({ queryKey: ["providerConfigs"] });
      toast.success(editing?.id === form.id ? "已更新" : "已添加");
      setEditing(null);
      setForm(emptyForm());
    } catch (e) {
      toast.error(`保存失败: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProviderConfig(id);
      await queryClient.invalidateQueries({ queryKey: ["providerConfigs"] });
      toast.success("已删除");
    } catch (e) {
      toast.error(`删除失败: ${e}`);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 py-6">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-xs text-muted-foreground/80 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        返回
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">网盘连接</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            配置 WebDAV 或本地目录，用于浏览和关联影片文件。
          </p>
        </div>
        {!editing && (
          <Button size="sm" variant="secondary" onClick={handleNew}>
            <Plus className="size-4" /> 添加连接
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : configs.length === 0 && !editing ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-12 text-muted-foreground">
          <Cloud className="size-10" />
          <p className="text-sm">尚未配置任何网盘连接</p>
          <Button variant="outline" size="sm" onClick={handleNew} className="rounded-xl">
            <Plus className="size-3.5" /> 添加第一个连接
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((config) => (
            <div
              key={config.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 rounded-xl border border-border/60 bg-background p-2">
                  {config.provider_type === "local" ? (
                    <HardDrive className="size-4 text-muted-foreground" />
                  ) : (
                    <Globe className="size-4 text-blue-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{config.name}</span>
                    <span className="shrink-0 rounded-full border border-border/60 px-2 py-px text-[10px] text-muted-foreground">
                      {config.provider_type === "local" ? "本地" : "WebDAV"}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {config.provider_type === "local"
                      ? config.root ?? "未设置根目录"
                      : config.endpoint ?? "未设置端点"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleEdit(config)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  title="编辑"
                >
                  <Edit className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(config.id)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  title="删除"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="rounded-2xl border border-border bg-card/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">{editing.id ? "编辑连接" : "新建连接"}</h2>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">连接名称</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例如：115 网盘、AList、本地影视盘"
                className="h-10 rounded-xl"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">类型</label>
              <div className="flex gap-2">
                {(["webdav", "local"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm({ ...form, provider_type: type })}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-colors ${
                      form.provider_type === type
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border/60 text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {type === "local" ? <HardDrive className="size-3.5" /> : <Globe className="size-3.5" />}
                    {type === "local" ? "本地目录" : "WebDAV"}
                  </button>
                ))}
              </div>
            </div>

            {form.provider_type === "webdav" ? (
              <>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">端点地址</label>
                  <Input
                    value={form.endpoint ?? ""}
                    onChange={(e) => setForm({ ...form, endpoint: e.target.value || null })}
                    placeholder="https://your-alist.example.com/dav"
                    className="h-10 rounded-xl font-mono text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">用户名</label>
                    <Input
                      value={form.username ?? ""}
                      onChange={(e) => setForm({ ...form, username: e.target.value || null })}
                      placeholder="可选"
                      className="h-10 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">密码</label>
                    <Input
                      type="password"
                      value={form.password ?? ""}
                      onChange={(e) => setForm({ ...form, password: e.target.value || null })}
                      placeholder="可选"
                      className="h-10 rounded-xl"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">根目录路径</label>
                <Input
                  value={form.root ?? ""}
                  onChange={(e) => setForm({ ...form, root: e.target.value || null })}
                  placeholder="D:\movies 或 /mnt/nas/movies"
                  className="h-10 rounded-xl font-mono text-xs"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel} className="rounded-xl">
              取消
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="rounded-xl">
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function emptyForm(): ProviderConfigData {
  return {
    id: crypto.randomUUID(),
    name: "",
    provider_type: "webdav",
    endpoint: null,
    username: null,
    password: null,
    root: null,
  };
}

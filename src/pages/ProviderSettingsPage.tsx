import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Cloud, Edit, Globe, HardDrive, Link, Plus, Trash2, X, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  listProviderConfigs,
  saveProviderConfig,
  deleteProviderConfig,
  open115CheckAuth,
  open115GetUserInfo,
  open115Logout,
  type UserInfo,
} from "@/services/fileService";
import { QrCodeLogin } from "@/components/provider/QrCodeLogin";
import type { ProviderConfigData } from "@/types/file";

const PROVIDER_TYPES = ["webdav", "local", "open115"] as const;

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
  const [showQrCode, setShowQrCode] = useState(false);
  const [open115Users, setOpen115Users] = useState<Record<string, UserInfo | null>>({});

  // Check auth status for open115 configs
  useEffect(() => {
    configs.forEach((config) => {
      if (config.provider_type === "open115" && config.endpoint) {
        open115CheckAuth(config.endpoint).then((authed) => {
          if (authed) {
            open115GetUserInfo(config.endpoint!).then((info) => {
              setOpen115Users((prev) => ({ ...prev, [config.id]: info }));
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    });
  }, [configs]);

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
    setShowQrCode(false);
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
    if (form.provider_type === "open115" && !form.endpoint?.trim()) {
      toast.error("115 网盘需要填写 Client ID");
      return;
    }
    setSaving(true);
    try {
      await saveProviderConfig(form);
      await queryClient.invalidateQueries({ queryKey: ["providerConfigs"] });
      toast.success(editing?.id === form.id ? "已更新" : "已添加");
      setEditing(null);
      setForm(emptyForm());
      setShowQrCode(false);
    } catch (e) {
      toast.error(`保存失败: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // Also logout if open115
      const config = configs.find((c) => c.id === id);
      if (config?.provider_type === "open115") {
        await open115Logout().catch(() => {});
      }
      await deleteProviderConfig(id);
      await queryClient.invalidateQueries({ queryKey: ["providerConfigs"] });
      toast.success("已删除");
    } catch (e) {
      toast.error(`删除失败: ${e}`);
    }
  };

  const handleQrCodeSuccess = useCallback(() => {
    setShowQrCode(false);
    queryClient.invalidateQueries({ queryKey: ["providerConfigs"] });
    toast.success("115 网盘授权成功");
  }, [queryClient]);

  const handleLogout115 = async (config: ProviderConfigData) => {
    try {
      await open115Logout();
      setOpen115Users((prev) => ({ ...prev, [config.id]: null }));
      toast.success("已登出 115 网盘");
    } catch (e) {
      toast.error(`登出失败: ${e}`);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "local": return <HardDrive className="size-4 text-muted-foreground" />;
      case "webdav": return <Globe className="size-4 text-blue-500" />;
      case "open115": return <Link className="size-4 text-emerald-500" />;
      default: return <Globe className="size-4 text-blue-500" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "local": return "本地";
      case "webdav": return "WebDAV";
      case "open115": return "115 网盘";
      default: return type;
    }
  };

  const getTypeDetail = (config: ProviderConfigData) => {
    if (config.provider_type === "local") {
      return config.root ?? "未设置根目录";
    }
    if (config.provider_type === "open115") {
      const user = open115Users[config.id];
      return user ? `已连接 · ${user.user_name}` : "未连接 · 需扫码登录";
    }
    return config.endpoint ?? "未设置端点";
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
            配置 115 网盘、WebDAV 或本地目录，用于浏览和关联影片文件。
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
                  {getTypeIcon(config.provider_type)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{config.name}</span>
                    <span className={`shrink-0 rounded-full border px-2 py-px text-[10px] ${
                      config.provider_type === "open115"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-border/60 text-muted-foreground"
                    }`}>
                      {getTypeLabel(config.provider_type)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {getTypeDetail(config)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {config.provider_type === "open115" && !open115Users[config.id] && config.endpoint && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...config });
                      setEditing({ ...config });
                      setShowQrCode(true);
                    }}
                    className="rounded-lg px-2 py-1.5 text-[11px] text-emerald-400 transition-colors hover:bg-emerald-500/10"
                    title="扫码登录"
                  >
                    登录
                  </button>
                )}
                {config.provider_type === "open115" && open115Users[config.id] && (
                  <button
                    type="button"
                    onClick={() => handleLogout115(config)}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    title="登出"
                  >
                    <LogOut className="size-3.5" />
                  </button>
                )}
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
                placeholder="例如：我的 115 网盘、AList、本地影视盘"
                className="h-10 rounded-xl"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">类型</label>
              <div className="flex gap-2">
                {PROVIDER_TYPES.map((type) => (
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
                    {type === "local" ? <HardDrive className="size-3.5" />
                      : type === "webdav" ? <Globe className="size-3.5" />
                      : <Link className="size-3.5" />}
                    {type === "local" ? "本地目录"
                      : type === "webdav" ? "WebDAV"
                      : "115 网盘"}
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
            ) : form.provider_type === "open115" ? (
              <>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Client ID</label>
                  <Input
                    value={form.endpoint ?? ""}
                    onChange={(e) => setForm({ ...form, endpoint: e.target.value || null })}
                    placeholder="从 open.115.com 获取的 Client ID"
                    className="h-10 rounded-xl font-mono text-xs"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    在 open.115.com 创建应用后获得
                  </p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`size-2 rounded-full ${
                        form.endpoint && open115Users[form.id]
                          ? "bg-emerald-500"
                          : "bg-muted-foreground/40"
                      }`} />
                      <span className="text-xs text-muted-foreground">
                        {form.endpoint && open115Users[form.id]
                          ? `已连接 · ${open115Users[form.id]?.user_name ?? ""}`
                          : "扫码登录后即可浏览网盘文件"}
                      </span>
                    </div>
                    {form.endpoint && open115Users[form.id] ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setShowQrCode(true)}
                        className="rounded-xl text-xs"
                      >
                        重新登录
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setShowQrCode(true)}
                        disabled={!form.endpoint?.trim()}
                        className="rounded-xl text-xs"
                      >
                        <Link className="size-3" /> 扫码登录
                      </Button>
                    )}
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

      {showQrCode && form.endpoint && (
        <QrCodeLogin
          clientId={form.endpoint}
          onSuccess={handleQrCodeSuccess}
          onCancel={() => setShowQrCode(false)}
        />
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

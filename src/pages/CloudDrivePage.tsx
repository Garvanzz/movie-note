import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Archive, Check, ChevronRight, CloudOff, Copy, Folder, FolderOpen, FolderPlus,
  Globe, HardDrive, Info, Link, Loader2, MoreVertical, MoveRight, Pencil, Play,
  RotateCcw, Search, Settings, Trash2, ExternalLink, Wifi, WifiOff, X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatFileSize, cn as utilCn } from "@/lib/utils";
import {
  listProviderConfigs, providerList, providerSearch,
  open115Mkdir, open115Rename, open115Delete, open115Move, open115Copy as open115CopyFile,
  open115Stat, open115RbList, open115RbRevert, open115RbDelete,
} from "@/services/fileService";
import type { ProviderConfigData, ProviderFileEntry } from "@/types/file";

export function CloudDrivePage() {
  const nav = useNavigate();
  const { data: configs = [], isLoading: cfgsLoading } = useQuery({ queryKey: ["providerConfigs"], queryFn: listProviderConfigs });
  const [pid, setPid] = useState<string | null>(null);
  const [cid, setCid] = useState("0");
  const [bread, setBread] = useState<{ cid: string; name: string }[]>([]);
  const [entries, setEntries] = useState<ProviderFileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sq, setSq] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [menuId, setMenuId] = useState<string | null>(null);
  const [rnm, setRnm] = useState<{ id: string; name: string } | null>(null);
  const [mkd, setMkd] = useState(false); const [mkdn, setMkdn] = useState("");
  const [cst, setCst] = useState<"idle"|"testing"|"ok"|"failed">("idle");
  const [detail, setDetail] = useState<{ entry: ProviderFileEntry; json: any } | null>(null);
  const [mvcp, setMvcp] = useState<{ type:"move"|"copy"; ids: string; tgt: string; bread: {cid:string;name:string}[]; ents: ProviderFileEntry[] } | null>(null);
  const [rb, setRb] = useState<{ open: boolean; data: any; loading: boolean }>({ open: false, data: null, loading: false });
  const menuRef = useRef<HTMLDivElement>(null);
  const acfg = configs.find(c => c.id === pid) ?? null;

  useEffect(() => { if (configs.length > 0 && !pid) setPid(configs[0].id); }, [configs, pid]);
  useEffect(() => { const fn = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null); }; document.addEventListener("mousedown", fn); return () => document.removeEventListener("mousedown", fn); }, []);

  const tpc = useCallback((c: ProviderConfigData) => ({ providerName: c.provider_type, root: c.root ?? undefined, endpoint: c.endpoint ?? undefined, username: c.username ?? undefined, password: c.password ?? undefined }), []);
  const tc = async (c: ProviderConfigData) => { setCst("testing"); try { await providerList(tpc(c), ""); setCst("ok"); toast.success(`${c.name} — 连接成功`); } catch (e) { setCst("failed"); toast.error(`连接失败: ${String(e).slice(0, 120)}`); } };
  const ld = useCallback(async (cidx: string) => { if (!acfg) return; setLoading(true); setError(null); try { const r = await providerList(tpc(acfg), cidx === "0" ? "" : cidx); setEntries(r); setCid(cidx); setCst("ok"); } catch (e) { setError(String(e)); setCst("failed"); } finally { setLoading(false); } }, [acfg, tpc]);
  useEffect(() => { if (acfg) ld(cid); }, [pid]); // eslint-disable-line

  const navDir = (nc: string, nm: string) => { setBread(p => [...p, { cid, name: nm }]); setCid(nc); ld(nc); setSel(new Set()); };
  const bc = (i: number) => { if (i < 0) { setBread([]); setCid("0"); ld("0"); } else { const t = bread[i]; setBread(bread.slice(0, i)); setCid(t.cid); ld(t.cid); } setSel(new Set()); };
  const search = async () => { if (!acfg || !sq.trim()) return; setLoading(true); setError(null); try { setEntries(await providerSearch(tpc(acfg), sq.trim())); } catch (e) { setError(String(e)); } finally { setLoading(false); } };
  const ts = (e: ProviderFileEntry) => { const n = new Set(sel); n.has(e.file_id) ? n.delete(e.file_id) : n.add(e.file_id); setSel(n); };
  const sf = () => entries.filter(e => sel.has(e.file_id));
  const sids = () => sf().map(f => f.file_id).join(",");

  const op = () => { for (const f of sf()) { if (f.file_url?.startsWith("http")) window.open(f.file_url, "_blank"); } };
  const cpl = async () => { try { await navigator.clipboard.writeText(sf().map(f => f.file_url ?? f.file_name).join("\n")); toast.success("已复制"); } catch { toast.error("失败"); } };
  const del = async () => { if (!acfg?.endpoint) return; try { await open115Delete(acfg.endpoint, sids(), cid); toast.success("已删除"); ld(cid); setSel(new Set()); } catch (e) { toast.error(`失败: ${e}`); } };
  const mkdir = async () => { if (!acfg?.endpoint || !mkdn.trim()) { toast.error("请输入名称"); return; } try { await open115Mkdir(acfg.endpoint, cid, mkdn.trim()); toast.success("已创建"); setMkd(false); setMkdn(""); ld(cid); } catch (e) { toast.error(`失败: ${e}`); } };
  const rename = async () => { if (!acfg?.endpoint || !rnm) return; try { await open115Rename(acfg.endpoint, rnm.id, rnm.name.trim()); toast.success("已重命名"); setRnm(null); ld(cid); } catch (e) { toast.error(`失败: ${e}`); } };
  const showDetail = async (e: ProviderFileEntry) => { setDetail({ entry: e, json: null }); if (!acfg?.endpoint) return; try { setDetail({ entry: e, json: await open115Stat(acfg.endpoint, e.file_id) }); } catch (_) {} };

  const openMc = (type: "move"|"copy") => { const ids = sids(); if (!ids) { toast.error("请先选择"); return; } setMvcp({ type, ids, tgt: "0", bread: [], ents: [] }); loadMcDir("0"); };
  const loadMcDir = async (tgtCid: string) => { if (!acfg) return; try { const ents = await providerList(tpc(acfg), tgtCid === "0" ? "" : tgtCid); setMvcp(p => p ? { ...p, tgt: tgtCid, ents } : null); } catch (e) { toast.error(String(e)); } };
  const mcNav = (nc: string, nm: string) => { setMvcp(p => p ? { ...p, bread: [...p.bread, { cid: p.tgt, name: nm }] } : null); loadMcDir(nc); };
  const mcBc = (i: number) => { if (i < 0) { setMvcp(p => p ? { ...p, bread: [] } : null); loadMcDir("0"); } else { const t = mvcp!.bread[i]; setMvcp(p => p ? { ...p, bread: p.bread.slice(0, i) } : null); loadMcDir(t.cid); } };
  const mcConfirm = async () => { if (!acfg?.endpoint || !mvcp) return; try { if (mvcp.type === "move") await open115Move(acfg.endpoint, mvcp.ids, mvcp.tgt); else await open115CopyFile(acfg.endpoint, mvcp.ids, mvcp.tgt); toast.success(mvcp.type === "move" ? "已移动" : "已复制"); setMvcp(null); ld(cid); } catch (e) { toast.error(`失败: ${e}`); } };

  const loadRb = async () => { if (!acfg?.endpoint) return; setRb({ open: true, data: null, loading: true }); try { setRb({ open: true, data: await open115RbList(acfg.endpoint, 200, 0), loading: false }); } catch (e) { toast.error(String(e)); setRb({ open: true, data: null, loading: false }); } };
  const rbRevert = async (tid: string) => { if (!acfg?.endpoint) return; try { await open115RbRevert(acfg.endpoint, tid); toast.success("已恢复"); loadRb(); ld(cid); } catch (e) { toast.error(`失败: ${e}`); } };
  const rbDel = async (tid: string) => { if (!acfg?.endpoint) return; try { await open115RbDelete(acfg.endpoint, tid); toast.success("已彻底删除"); loadRb(); } catch (e) { toast.error(`失败: ${e}`); } };

  const pi = (t: string) => { switch (t) { case "local": return <HardDrive className="size-3.5" />; case "open115": return <Link className="size-3.5" />; default: return <Globe className="size-3.5" />; } };
  const di = entries.filter(e => e.is_directory); const fi = entries.filter(e => !e.is_directory); const sorted = [...di, ...fi];
  const ops = acfg?.provider_type === "open115";

  if (!cfgsLoading && configs.length === 0) return (
    <div className="-m-6 flex h-[calc(100%+3rem)] flex-col items-center justify-center gap-4">
      <CloudOff className="size-12 text-muted-foreground/40" />
      <div className="text-center"><p className="text-sm font-medium text-muted-foreground">尚未配置网盘连接</p><p className="mt-1 text-xs text-muted-foreground/60">添加 WebDAV、115 网盘或本地目录后即可浏览文件</p></div>
      <Button variant="outline" size="sm" onClick={() => nav("/providers")} className="rounded-xl"><Settings className="size-3.5" />去配置连接</Button>
    </div>
  );

  return (
    <div className="-m-6 flex h-[calc(100%+3rem)] flex-col">
      {/* Top */}
      <div className="flex items-center justify-between border-b border-border/70 px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5"><div className="rounded-xl border border-border/60 bg-background p-2"><FolderOpen className="size-4 text-foreground" /></div><h1 className="text-lg font-semibold">网盘文件</h1></div>
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-2 py-1.5">
            {configs.map(c => <button key={c.id} onClick={() => { setPid(c.id); setBread([]); setCid("0"); setSel(new Set()); setCst("idle"); }} className={utilCn("flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-colors", c.id === pid ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent")}>{pi(c.provider_type)}{c.name}</button>)}
          </div>
          {acfg && <button onClick={() => tc(acfg)} disabled={cst === "testing"} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground">{cst === "testing" ? <Loader2 className="size-3 animate-spin" /> : cst === "ok" ? <Wifi className="size-3 text-emerald-400" /> : cst === "failed" ? <WifiOff className="size-3 text-destructive" /> : <Play className="size-3" />}{cst === "testing" ? "测试中..." : "测试连接"}</button>}
          {ops && <button onClick={loadRb} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"><Archive className="size-3" />回收站</button>}
        </div>
        <button onClick={() => nav("/providers")} className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"><Settings className="size-3.5" />管理连接</button>
      </div>
      {/* Toolbar */}
      <div className="flex flex-1 overflow-hidden"><div className="flex flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border/40 px-4 py-2">
          <div className="flex items-center gap-1 overflow-x-auto text-xs">
            <button onClick={() => bc(-1)} className="shrink-0 rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground">根目录</button>
            {bread.map((it, i) => <span key={i} className="flex items-center gap-0.5"><ChevronRight className="size-3 text-muted-foreground/40" /><button onClick={() => bc(i)} className="truncate rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground max-w-[140px]">{it.name || "..."}</button></span>)}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative"><Search className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" /><Input value={sq} onChange={e => setSq(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} placeholder="搜索..." className="h-8 w-48 rounded-xl pl-7 text-xs" /></div>
            {ops && <Button size="sm" variant="secondary" onClick={() => setMkd(true)} className="h-8 rounded-xl text-xs"><FolderPlus className="size-3" />新建文件夹</Button>}
          </div>
        </div>
        {mkd && <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2"><Input value={mkdn} onChange={e => setMkdn(e.target.value)} onKeyDown={e => e.key === "Enter" && mkdir()} placeholder="文件夹名称" autoFocus className="h-8 w-48 rounded-xl text-xs" /><Button size="sm" onClick={mkdir} className="h-8 rounded-xl text-xs">创建</Button><Button size="sm" variant="ghost" onClick={() => { setMkd(false); setMkdn(""); }} className="h-8 rounded-xl text-xs"><X className="size-3" /></Button></div>}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading ? <div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          : error ? <div className="flex flex-col items-center gap-3 py-12"><WifiOff className="size-8 text-destructive/50" /><p className="text-sm text-destructive">{error}</p><Button size="sm" variant="secondary" onClick={() => acfg && tc(acfg)} className="rounded-xl text-xs">重试连接</Button></div>
          : sorted.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">{sq ? "未找到匹配文件" : "此目录为空"}</div>
          : <div className="space-y-0.5">
              <div className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-[11px] text-muted-foreground"><div className="w-5" /><div className="flex-1">名称</div><div className="w-20 text-right">大小</div><div className="w-6" /></div>
              {sorted.map(e => <FR key={e.file_id} entry={e} selected={sel.has(e.file_id)} onToggle={() => ts(e)} onNavigate={() => navDir(e.file_id, e.file_name)} menuOpen={menuId === e.file_id} onMenuToggle={() => setMenuId(menuId === e.file_id ? null : e.file_id)} showOps={ops}
                onDetail={() => { showDetail(e); setMenuId(null); }} onRename={() => { setRnm({ id: e.file_id, name: e.file_name }); setMenuId(null); }}
                onCopyLink={async () => { setMenuId(null); if (e.file_url) try { await navigator.clipboard.writeText(e.file_url); toast.success("已复制"); } catch { } }}
                onDelete={async () => { setMenuId(null); if (acfg?.endpoint) try { await open115Delete(acfg.endpoint, e.file_id, cid); toast.success("已删除"); ld(cid); } catch (ex) { toast.error(`失败: ${ex}`); } }}
                onMoveCopy={(t) => { setMenuId(null); if (acfg?.endpoint) { setMvcp({ type: t, ids: e.file_id, tgt: "0", bread: [], ents: [] }); loadMcDir("0"); } }}
              />)}
            </div>}
        </div>
        {sel.size > 0 && <div className="flex items-center gap-2 border-t border-border/70 px-4 py-2.5"><span className="text-xs text-muted-foreground">已选 {sel.size} 项</span><div className="flex gap-1.5"><Button size="sm" variant="secondary" onClick={op} className="h-8 rounded-xl text-xs"><ExternalLink className="size-3" />打开</Button><Button size="sm" variant="secondary" onClick={cpl} className="h-8 rounded-xl text-xs"><Copy className="size-3" />复制链接</Button>{ops && <><Button size="sm" variant="secondary" onClick={() => openMc("move")} className="h-8 rounded-xl text-xs"><MoveRight className="size-3" />移动</Button><Button size="sm" variant="secondary" onClick={() => openMc("copy")} className="h-8 rounded-xl text-xs"><Copy className="size-3" />复制</Button><Button size="sm" variant="secondary" onClick={del} className="h-8 rounded-xl text-xs text-destructive hover:bg-destructive/10"><Trash2 className="size-3" />删除</Button></>}</div></div>}
      </div></div>

      {/* Rename */}
      {rnm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setRnm(null)}><div className="w-80 rounded-2xl border border-border/80 bg-card p-5 shadow-xl" onClick={e => e.stopPropagation()}><h3 className="mb-3 text-sm font-medium">重命名</h3><Input value={rnm.name} onChange={e => setRnm({ ...rnm, name: e.target.value })} onKeyDown={e => e.key === "Enter" && rename()} autoFocus className="h-9 rounded-xl text-sm" /><div className="mt-3 flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setRnm(null)} className="rounded-xl">取消</Button><Button size="sm" onClick={rename} className="rounded-xl">确定</Button></div></div></div>}

      {/* Detail */}
      {detail && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDetail(null)}><div className="w-96 max-h-[80vh] overflow-y-auto rounded-2xl border border-border/80 bg-card p-5 shadow-xl" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between mb-4"><h3 className="text-sm font-medium">文件详情</h3><button onClick={() => setDetail(null)} className="rounded-lg p-1 text-muted-foreground hover:bg-accent"><X className="size-4" /></button></div><div className="space-y-2 text-xs"><div className="flex justify-between"><span className="text-muted-foreground">名称</span><span className="truncate max-w-[200px]">{detail.entry.file_name}</span></div><div className="flex justify-between"><span className="text-muted-foreground">大小</span><span>{detail.entry.file_size != null ? formatFileSize(detail.entry.file_size) : "-"}</span></div><div className="flex justify-between"><span className="text-muted-foreground">类型</span><span>{detail.entry.is_directory ? "文件夹" : "文件"}</span></div>{detail.json && <><hr className="border-border/40" />{detail.json.sha1 && <div className="flex justify-between"><span className="text-muted-foreground">SHA1</span><span className="font-mono text-[10px] truncate max-w-[180px]">{detail.json.sha1}</span></div>}{detail.json.pick_code && <div className="flex justify-between"><span className="text-muted-foreground">提取码</span><span className="font-mono text-[10px]">{detail.json.pick_code}</span></div>}{detail.json.upt && <div className="flex justify-between"><span className="text-muted-foreground">修改时间</span><span>{new Date((detail.json.upt as number) * 1000).toLocaleString()}</span></div>}</>}</div></div></div>}

      {/* Move/Copy */}
      {mvcp && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setMvcp(null)}><div className="flex max-h-[70vh] w-96 flex-col rounded-2xl border border-border/80 bg-card shadow-xl" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between border-b border-border/70 px-4 py-3"><h3 className="text-sm font-medium">{mvcp.type === "move" ? "移动到..." : "复制到..."}</h3><button onClick={() => setMvcp(null)} className="rounded-lg p-1 text-muted-foreground hover:bg-accent"><X className="size-4" /></button></div><div className="flex items-center gap-1 overflow-x-auto border-b border-border/40 px-3 py-1.5 text-xs"><button onClick={() => mcBc(-1)} className="shrink-0 rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground">根</button>{mvcp.bread.map((it, i) => <span key={i} className="flex items-center gap-0.5"><ChevronRight className="size-3 text-muted-foreground/40" /><button onClick={() => mcBc(i)} className="truncate rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground max-w-[100px]">{it.name}</button></span>)}</div><div className="flex-1 overflow-y-auto p-2 space-y-0.5">{mvcp.ents.filter(e => e.is_directory).map(e => <button key={e.file_id} onClick={() => mcNav(e.file_id, e.file_name)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"><Folder className="size-3.5 text-amber-500" />{e.file_name}</button>)}</div><div className="flex justify-end gap-2 border-t border-border/70 px-4 py-2.5"><Button variant="outline" size="sm" onClick={() => setMvcp(null)} className="rounded-xl">取消</Button><Button size="sm" onClick={mcConfirm} className="rounded-xl">{mvcp.type === "move" ? "移动到此" : "复制到此"}</Button></div></div></div>}

      {/* Recycle Bin */}
      {rb.open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setRb({ open: false, data: null, loading: false })}><div className="flex max-h-[70vh] w-[500px] flex-col rounded-2xl border border-border/80 bg-card shadow-xl" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between border-b border-border/70 px-4 py-3"><div className="flex items-center gap-2"><Archive className="size-4 text-muted-foreground" /><h3 className="text-sm font-medium">回收站</h3></div><div className="flex items-center gap-1"><button onClick={loadRb} disabled={rb.loading} className="rounded-lg p-1 text-muted-foreground hover:bg-accent"><RotateCcw className="size-3.5" /></button><button onClick={() => setRb({ open: false, data: null, loading: false })} className="rounded-lg p-1 text-muted-foreground hover:bg-accent"><X className="size-4" /></button></div></div><div className="flex-1 overflow-y-auto p-2 space-y-0.5">{rb.loading ? <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div> : !rb.data ? <p className="py-8 text-center text-xs text-muted-foreground">暂无数据</p> : (() => { const items = Object.entries(rb.data).filter(([k]) => !["offset","limit","count","rb_pass"].includes(k)); return items.length === 0 ? <p className="py-8 text-center text-xs text-muted-foreground">回收站为空</p> : items.map(([tid, info]: [string, any]) => <div key={tid} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-accent/60"><div className="min-w-0 flex-1"><div className="truncate text-sm">{info.file_name || tid}</div><div className="text-xs text-muted-foreground">{info.file_size ? formatFileSize(Number(info.file_size)) : "-"}</div></div><Button size="sm" variant="secondary" onClick={() => rbRevert(tid)} className="h-7 rounded-lg text-[10px]"><RotateCcw className="size-3" />恢复</Button><Button size="sm" variant="secondary" onClick={() => rbDel(tid)} className="h-7 rounded-lg text-[10px] text-destructive hover:bg-destructive/10"><Trash2 className="size-3" />彻底删除</Button></div>); })()}</div><div className="flex justify-end border-t border-border/70 px-4 py-2.5"><Button variant="outline" size="sm" onClick={() => setRb({ open: false, data: null, loading: false })} className="rounded-xl">关闭</Button></div></div></div>}
    </div>
  );
}

function FR({ entry, selected, onToggle, onNavigate, menuOpen, onMenuToggle, showOps, onDetail, onRename, onCopyLink, onDelete, onMoveCopy }: {
  entry: ProviderFileEntry; selected: boolean; onToggle: () => void; onNavigate: () => void; menuOpen: boolean; onMenuToggle: () => void; showOps: boolean;
  onDetail: () => void; onRename: () => void; onCopyLink: () => void; onDelete: () => void; onMoveCopy: (t: "move" | "copy") => void;
}) {
  return (
    <div className={utilCn("group flex items-center gap-3 rounded-xl px-3 py-2 transition-colors cursor-pointer relative", selected ? "bg-primary/10 border border-primary/20" : "hover:bg-accent/60 border border-transparent")} onClick={() => (entry.is_directory ? onNavigate() : onToggle())}>
      <div className="w-5 shrink-0">{entry.is_directory ? <Folder className="size-4 text-amber-500" /> : <div className={utilCn("flex size-4 items-center justify-center rounded border", selected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30")}>{selected && <Check className="size-3" />}</div>}</div>
      <div className="min-w-0 flex-1"><div className="truncate text-sm">{entry.file_name}</div></div>
      <div className="w-20 shrink-0 text-right text-xs text-muted-foreground">{entry.file_size != null && !entry.is_directory ? formatFileSize(entry.file_size) : "-"}</div>
      <div className="w-6 shrink-0">{showOps && <button onClick={e => { e.stopPropagation(); onMenuToggle(); }} className="invisible rounded-lg p-0.5 text-muted-foreground hover:bg-accent group-hover:visible"><MoreVertical className="size-3.5" /></button>}</div>
      {menuOpen && <div className="absolute right-8 top-8 z-50 w-40 rounded-xl border border-border/80 bg-card py-1 shadow-xl" onClick={e => e.stopPropagation()}>
        <button onClick={onDetail} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"><Info className="size-3" />详情</button>
        <button onClick={onRename} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"><Pencil className="size-3" />重命名</button>
        {!entry.is_directory && <button onClick={onCopyLink} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"><Copy className="size-3" />复制链接</button>}
        <button onClick={() => onMoveCopy("move")} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"><MoveRight className="size-3" />移动到...</button>
        <button onClick={() => onMoveCopy("copy")} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"><Copy className="size-3" />复制到...</button>
        <hr className="border-border/40 my-0.5" />
        <button onClick={onDelete} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"><Trash2 className="size-3" />删除</button>
      </div>}
    </div>
  );
}

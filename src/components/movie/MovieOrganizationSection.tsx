import { Link } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Actor } from "@/types/actor";
import type { CloudFile } from "@/types/file";
import type { Genre, Tag } from "@/types/tag";
import { toast } from "sonner";

interface MovieOrganizationSectionProps {
  tags: Tag[];
  actors: Actor[];
  genres: Genre[];
  files: CloudFile[];
  availableTags: Tag[];
  availableActors: Actor[];
  availableGenres: Genre[];
  tagSelect: string;
  actorSearch: string;
  genreSelect: string;
  newFilePath: string;
  onTagSelectChange: (value: string) => void;
  onActorSearchChange: (value: string) => void;
  onGenreSelectChange: (value: string) => void;
  onNewFilePathChange: (value: string) => void;
  onAddTag: (tagId: number) => void;
  onRemoveTag: (tagId: number) => void;
  onAddActor: (actorId: number) => void;
  onRemoveActor: (actorId: number) => void;
  onAddGenre: (genreId: number) => void;
  onRemoveGenre: (genreId: number) => void;
  onAddFiles: (paths: string[]) => void;
  onRemoveFile: (fileId: number) => void;
  isTagBusy: boolean;
  isActorBusy: boolean;
  isGenreBusy: boolean;
  isFileBusy: boolean;
}

export function MovieOrganizationSection({
  tags,
  actors,
  genres,
  files,
  availableTags,
  availableActors,
  availableGenres,
  tagSelect,
  actorSearch,
  genreSelect,
  newFilePath,
  onTagSelectChange,
  onActorSearchChange,
  onGenreSelectChange,
  onNewFilePathChange,
  onAddTag,
  onRemoveTag,
  onAddActor,
  onRemoveActor,
  onAddGenre,
  onRemoveGenre,
  onAddFiles,
  onRemoveFile,
  isTagBusy,
  isActorBusy,
  isGenreBusy,
  isFileBusy,
}: MovieOrganizationSectionProps) {
  const filePaths = parseFilePaths(newFilePath);

  return (
    <section className="space-y-6 rounded-2xl border border-border bg-card/40 p-6">
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">整理信息</p>

      <div className="grid gap-6 xl:grid-cols-2">
        <TaxonomyBlock title="标签" emptyText="暂无标签">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {tags.length > 0 ? (
              tags.map((tag) => (
                <Badge key={tag.id} variant="outline" className="group gap-1 pr-1">
                  {tag.name}
                  <button type="button" onClick={() => onRemoveTag(tag.id)} disabled={isTagBusy} className="opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-100">
                    <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">暂无标签</p>
            )}
          </div>

          {availableTags.length > 0 && (
            <select
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-muted-foreground"
              value={tagSelect}
              disabled={isTagBusy}
              onChange={(event) => {
                onTagSelectChange(event.target.value);
                if (event.target.value) {
                  onAddTag(Number(event.target.value));
                }
              }}
            >
              <option value="">添加标签...</option>
              {availableTags.map((tag) => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
          )}
        </TaxonomyBlock>

        <TaxonomyBlock title="演员" emptyText="暂无演员">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {actors.length > 0 ? (
              actors.map((actor) => (
                <Badge key={actor.id} variant="outline" className="group gap-1 pr-1">
                  <Link to={`/actors/${actor.id}`} className="hover:underline">{actor.name}</Link>
                  <button type="button" onClick={() => onRemoveActor(actor.id)} disabled={isActorBusy} className="opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-100">
                    <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">暂无演员</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="搜索演员..."
              value={actorSearch}
              onChange={(event) => onActorSearchChange(event.target.value)}
              className="h-7 max-w-[200px] text-xs"
              disabled={isActorBusy}
            />
            {availableActors.length > 0 && (
              <select
                className="h-7 rounded-md border border-input bg-transparent px-2 text-xs text-muted-foreground"
                value=""
                disabled={isActorBusy}
                onChange={(event) => {
                  if (event.target.value) onAddActor(Number(event.target.value));
                }}
              >
                <option value="">选择演员...</option>
                {availableActors.map((actor) => (
                  <option key={actor.id} value={actor.id}>{actor.name}</option>
                ))}
              </select>
            )}
          </div>
        </TaxonomyBlock>

        <TaxonomyBlock title="类型" emptyText="暂无类型">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {genres.length > 0 ? (
              genres.map((genre) => (
                <Badge key={genre.id} variant="outline" className="group gap-1 pr-1">
                  {genre.name}
                  <button type="button" onClick={() => onRemoveGenre(genre.id)} disabled={isGenreBusy} className="opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-100">
                    <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">暂无类型</p>
            )}
          </div>

          {availableGenres.length > 0 && (
            <select
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-muted-foreground"
              value={genreSelect}
              disabled={isGenreBusy}
              onChange={(event) => {
                onGenreSelectChange(event.target.value);
                if (event.target.value) {
                  onAddGenre(Number(event.target.value));
                }
              }}
            >
              <option value="">添加类型...</option>
              {availableGenres.map((genre) => (
                <option key={genre.id} value={genre.id}>{genre.name}</option>
              ))}
            </select>
          )}
        </TaxonomyBlock>

        <div className="space-y-3 rounded-xl border border-border/70 bg-background/30 p-4 xl:col-span-2">
          <div>
            <h3 className="text-sm font-medium">网盘文件</h3>
            <p className="text-xs text-muted-foreground">当前仍支持直接录入路径，后续可以在这里继续增强文件选择和快捷操作。</p>
          </div>

          {files.length > 0 ? (
            <div className="space-y-2">
              {files.map((file) => (
                <div key={file.id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{getFileDisplayName(file)}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground">{file.file_path}</div>
                    <div className="mt-0.5 flex gap-4 text-xs text-muted-foreground">
                      {file.file_size && <span>{formatSize(file.file_size)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      disabled={isFileBusy}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(file.file_path);
                          toast.success("已复制文件路径");
                        } catch (error) {
                          toast.error(`复制失败: ${error}`);
                        }
                      }}
                    >
                      复制路径
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onRemoveFile(file.id)} disabled={isFileBusy}>
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无关联文件</p>
          )}

          <div className="space-y-2">
            <textarea
              placeholder="粘贴一个或多个网盘文件路径，每行一个..."
              value={newFilePath}
              onChange={(event) => onNewFilePathChange(event.target.value)}
              className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs leading-5 focus:outline-none focus:ring-1 focus:ring-ring"
              disabled={isFileBusy}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && filePaths.length > 0) {
                  onAddFiles(filePaths);
                }
              }}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                支持批量粘贴。每行一个路径，按 Ctrl+Enter 或点按钮添加。
              </p>
              <Button size="sm" variant="secondary" onClick={() => onAddFiles(filePaths)} disabled={isFileBusy || filePaths.length === 0}>
                <Plus className="size-4" /> 添加 {filePaths.length > 1 ? `${filePaths.length} 个文件` : "文件"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function parseFilePaths(rawValue: string): string[] {
  return Array.from(new Set(rawValue.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)));
}

function getFileDisplayName(file: CloudFile): string {
  if (file.file_name) return file.file_name;
  const segments = file.file_path.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? file.file_path;
}

function TaxonomyBlock({ title, emptyText, children }: { title: string; emptyText: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground">{emptyText}</span>
      </div>
      {children}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

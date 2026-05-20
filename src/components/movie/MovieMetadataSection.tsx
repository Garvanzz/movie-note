import { Calendar, Clock, Globe, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Movie } from "@/types/movie";
import { getMovieWatchStatusMeta, MOVIE_WATCH_STATUS_OPTIONS } from "@/lib/movieWatchStatus";

export interface MovieMetadataFormValues {
  title: string;
  titleJp: string;
  runtime: string;
  releaseDate: string;
  rating: number | undefined;
  comment: string;
  notes: string;
  watchStatus: string;
  series: string;
  sourceUrl: string;
  sourceSite: string;
}

interface MovieMetadataSectionProps {
  movie: Movie;
  editing: boolean;
  values: MovieMetadataFormValues;
  onChange: {
    title: (value: string) => void;
    titleJp: (value: string) => void;
    runtime: (value: string) => void;
    releaseDate: (value: string) => void;
    rating: (value: number | undefined) => void;
    comment: (value: string) => void;
    notes: (value: string) => void;
    watchStatus: (value: string) => void;
    series: (value: string) => void;
    sourceUrl: (value: string) => void;
    sourceSite: (value: string) => void;
  };
}

export function MovieMetadataSection({ movie, editing, values, onChange }: MovieMetadataSectionProps) {
  const displayRating = editing ? values.rating : movie.rating;

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card/40 p-6">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">核心信息</p>
        <p className="text-sm text-muted-foreground">
          {editing ? "当前页直接保存核心信息、评分、评论备注和来源字段。" : "影片识别信息、来源信息和文字说明。"}
        </p>
      </div>

      {editing ? (
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">番号</p>
            <p className="font-mono text-xl font-bold text-primary">{movie.code}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="标题">
              <Input value={values.title} onChange={(event) => onChange.title(event.target.value)} />
            </Field>
            <Field label="日文标题">
              <Input value={values.titleJp} onChange={(event) => onChange.titleJp(event.target.value)} />
            </Field>
            <Field label="片长 (分钟)">
              <Input value={values.runtime} type="number" onChange={(event) => onChange.runtime(event.target.value)} />
            </Field>
            <Field label="发行日期">
              <Input value={values.releaseDate} onChange={(event) => onChange.releaseDate(event.target.value)} />
            </Field>
            <Field label="系列">
              <Input value={values.series} onChange={(event) => onChange.series(event.target.value)} />
            </Field>
            <Field label="来源站点">
              <Input value={values.sourceSite} onChange={(event) => onChange.sourceSite(event.target.value)} />
            </Field>
          </div>

          <Field label="来源 URL">
            <Input
              value={values.sourceUrl}
              onChange={(event) => onChange.sourceUrl(event.target.value)}
              className="font-mono text-xs"
            />
          </Field>

          <div>
            <label className="mb-2 block text-xs text-muted-foreground">观看状态</label>
            <div className="flex flex-wrap gap-1.5">
              {MOVIE_WATCH_STATUS_OPTIONS.map((status) => (
                <Badge
                  key={status.value}
                  variant={values.watchStatus === status.value ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => onChange.watchStatus(status.value)}
                >
                  <status.icon className="size-3" />
                  {status.label}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs text-muted-foreground">评分</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button key={value} type="button" onClick={() => onChange.rating(value)}>
                  <Star className={values.rating && value <= values.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"} />
                </button>
              ))}
              {values.rating != null && <span className="ml-1 text-sm text-muted-foreground">{values.rating}.0</span>}
            </div>
          </div>

          <Field label="评论">
            <textarea
              className="h-20 w-full resize-none rounded-md border border-border bg-muted p-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={values.comment}
              onChange={(event) => onChange.comment(event.target.value)}
            />
          </Field>

          <Field label="备注">
            <textarea
              className="h-20 w-full resize-none rounded-md border border-border bg-muted p-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={values.notes}
              onChange={(event) => onChange.notes(event.target.value)}
            />
          </Field>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <h1 className="font-mono text-2xl font-bold text-primary">{movie.code}</h1>
            <h2 className="mt-1 text-lg">{movie.title || " "}</h2>
            {movie.title_jp && <p className="mt-0.5 text-sm text-muted-foreground">{movie.title_jp}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {displayRating != null && (
              <div className="flex items-center gap-1 text-yellow-400">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star
                    key={index}
                    className={index < Math.round(displayRating) ? "fill-yellow-400" : "text-muted-foreground/30"}
                  />
                ))}
                <span className="ml-1 text-sm">{displayRating.toFixed(1)}</span>
              </div>
            )}
            {(() => {
              const watchStatus = getMovieWatchStatusMeta(movie.watch_status);
              return (
                <Badge variant="secondary" className="gap-1">
                  <watchStatus.icon className="size-3" />
                  {watchStatus.label}
                </Badge>
              );
            })()}
          </div>

          <div className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
            {movie.release_date && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="size-3.5" /> 发行: {movie.release_date}
              </div>
            )}
            {movie.runtime && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="size-3.5" /> 片长: {movie.runtime} min
              </div>
            )}
            {movie.series && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">系列:</span>
                <Badge variant="secondary">{movie.series}</Badge>
              </div>
            )}
          </div>

          {(movie.source_url || movie.source_site) && (
            <div className="flex items-center gap-1.5 text-sm">
              <Globe className="size-3.5 text-muted-foreground" />
              {movie.source_site && <span className="text-muted-foreground">{movie.source_site}</span>}
              {movie.source_url && (
                <a
                  href={movie.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate font-mono text-xs text-primary hover:underline"
                >
                  {movie.source_url}
                </a>
              )}
            </div>
          )}

          {(movie.comment || movie.notes) && (
            <div className="grid gap-4 md:grid-cols-2">
              <TextBlock title="评论" value={movie.comment} emptyText="暂无评论" />
              <TextBlock title="备注" value={movie.notes} emptyText="暂无备注" />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function TextBlock({ title, value, emptyText }: { title: string; value: string | null; emptyText: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/40 p-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{value || emptyText}</p>
    </div>
  );
}
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Star, User, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getActor, updateActor, deleteActor } from "@/services/actorService";
import { useState, useEffect } from "react";

export function ActorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const [name, setName] = useState("");
  const [nameJp, setNameJp] = useState("");
  const [measurements, setMeasurements] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [debutYear, setDebutYear] = useState("");
  const [rating, setRating] = useState<number | undefined>();
  const [comment, setComment] = useState("");

  const { data: actor, isLoading } = useQuery({
    queryKey: ["actor", id],
    queryFn: () => getActor(Number(id)),
    enabled: !!id,
  });

  useEffect(() => {
    if (actor) {
      setName(actor.name);
      setNameJp(actor.name_jp ?? "");
      setMeasurements(actor.measurements ?? "");
      setBirthDate(actor.birth_date ?? "");
      setDebutYear(actor.debut_year?.toString() ?? "");
      setRating(actor.rating ?? undefined);
      setComment(actor.comment ?? "");
    }
  }, [actor]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateActor({
        id: Number(id),
        name,
        nameJp: nameJp || undefined,
        measurements: measurements || undefined,
        birthDate: birthDate || undefined,
        debutYear: debutYear ? Number(debutYear) : undefined,
        rating,
        comment: comment || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actor", id] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteActor(Number(id)),
    onSuccess: () => navigate("/actors"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin size-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!actor) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <User className="size-16 text-muted-foreground/30" />
        <p className="text-muted-foreground">演员不存在</p>
        <Button variant="outline" onClick={() => navigate("/actors")}>返回列表</Button>
      </div>
    );
  }

  const displayRating = editing ? rating : actor.rating;

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/actors")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" /> 返回列表
        </button>
        <div className="flex gap-2">
          <Button variant={editing ? "default" : "outline"} size="sm" onClick={() => setEditing(!editing)}>
            {editing ? "取消" : "编辑"}
          </Button>
          {editing && (
            <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              <Save className="size-3.5" /> 保存
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => { if (confirm("确定删除该演员？")) deleteMutation.mutate(); }}>
            删除
          </Button>
        </div>
      </div>

      <div className="flex gap-8">
        <div className="w-48 shrink-0">
          <div className="aspect-[3/4] bg-muted rounded-xl border border-border overflow-hidden flex items-center justify-center">
            {actor.avatar_path ? (
              <img src={actor.avatar_path} alt={actor.name} className="w-full h-full object-cover" />
            ) : (
              <User className="size-16 text-muted-foreground/20" />
            )}
          </div>
        </div>

        <div className="flex-1 space-y-4">
          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">姓名</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">日文名</label>
                  <Input value={nameJp} onChange={(e) => setNameJp(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">三围</label>
                  <Input value={measurements} onChange={(e) => setMeasurements(e.target.value)} placeholder="B/W/H" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">出生日期</label>
                  <Input value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">出道年份</label>
                  <Input value={debutYear} onChange={(e) => setDebutYear(e.target.value)} type="number" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">评分</label>
                  <div className="flex items-center gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <button key={v} onClick={() => setRating(v)}>
                        <Star className={rating && v <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">评论</label>
                <textarea
                  className="w-full h-24 bg-muted rounded-md p-3 text-sm border border-border focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-2xl font-bold">{actor.name}</h1>
                {actor.name_jp && <p className="text-sm text-muted-foreground mt-0.5">{actor.name_jp}</p>}
              </div>

              {displayRating != null && (
                <div className="flex items-center gap-1 text-yellow-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={i < Math.round(displayRating) ? "fill-yellow-400" : "text-muted-foreground/30"} />
                  ))}
                  <span className="text-sm ml-1">{displayRating.toFixed(1)}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-sm">
                {actor.measurements && (
                  <div><span className="text-muted-foreground">三围:</span> {actor.measurements}</div>
                )}
                {actor.birth_date && (
                  <div><span className="text-muted-foreground">出生:</span> {actor.birth_date}</div>
                )}
                {actor.debut_year && (
                  <div><span className="text-muted-foreground">出道:</span> {actor.debut_year}</div>
                )}
              </div>

              <div className="pt-4 border-t border-border">
                <h3 className="text-sm font-medium mb-2">评论</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {actor.comment || "暂无评论"}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

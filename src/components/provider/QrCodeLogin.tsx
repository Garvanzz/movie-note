import { useEffect, useRef, useState } from "react";
import { X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  open115StartAuth,
  open115PollStatus,
  open115ExchangeToken,
  type DeviceCodeData,
} from "@/services/fileService";
import QRCode from "qrcode";

type AuthStatus = "loading" | "waiting" | "scanned" | "confirmed" | "error";

interface QrCodeLoginProps {
  clientId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function QrCodeLogin({ clientId, onSuccess, onCancel }: QrCodeLoginProps) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const deviceDataRef = useRef<DeviceCodeData | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAuth = async () => {
    setStatus("loading");
    setErrorMsg(null);
    setQrDataUrl(null);

    try {
      const data = await open115StartAuth(clientId);
      deviceDataRef.current = data;

      // Generate QR code image
      const dataUrl = await QRCode.toDataURL(data.qrcode, {
        width: 280,
        margin: 2,
        color: { dark: "#ffffff", light: "#1a1a1a" },
      });
      setQrDataUrl(dataUrl);
      setStatus("waiting");

      // Start polling
      pollTimerRef.current = setInterval(() => pollStatus(data), 2000);
    } catch (e) {
      setErrorMsg(String(e));
      setStatus("error");
    }
  };

  const pollStatus = async (data: DeviceCodeData) => {
    try {
      const result = await open115PollStatus(data.uid, data.time, data.sign);
      if (result.status === 1) {
        setStatus("scanned");
      } else if (result.status === 2) {
        setStatus("confirmed");
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        // Exchange for token
        try {
          await open115ExchangeToken(clientId, data.uid);
          onSuccess();
        } catch (e) {
          setErrorMsg("兑换 token 失败: " + String(e));
          setStatus("error");
        }
      }
    } catch (_e) {
      // Polling errors are expected during auth flow
    }
  };

  useEffect(() => {
    startAuth();
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const statusConfig: Record<AuthStatus, { label: string; color: string }> = {
    loading: { label: "正在生成二维码...", color: "text-muted-foreground" },
    waiting: { label: "请使用 115 生活 App 扫码授权", color: "text-blue-400" },
    scanned: { label: "已扫码，请在 App 中确认登录", color: "text-amber-400" },
    confirmed: { label: "登录成功！", color: "text-emerald-400" },
    error: { label: "出错了", color: "text-destructive" },
  };

  const steps = [
    { num: 1, text: "打开 115 生活 App" },
    { num: 2, text: "点击首页右上角「+」→「扫一扫」" },
    { num: 3, text: "扫描二维码并确认登录" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget && status !== "loading") onCancel(); }}
    >
      <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">扫码登录 115 网盘</h2>
            <p className="text-xs text-muted-foreground">使用 115 生活 App 安全授权</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={status === "loading"}
            className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* QR Code area */}
        <div className="flex flex-col items-center gap-4 px-5 py-6">
          <div className="relative rounded-2xl border border-border/60 bg-background p-3">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="115 QR Code"
                className="size-[200px] rounded-xl"
              />
            ) : status === "error" ? (
              <div className="flex size-[200px] items-center justify-center text-muted-foreground">
                <button
                  type="button"
                  onClick={startAuth}
                  className="flex flex-col items-center gap-2 rounded-xl p-4 text-sm transition-colors hover:bg-accent"
                >
                  <RefreshCw className="size-8" />
                  重新获取
                </button>
              </div>
            ) : (
              <div className="flex size-[200px] items-center justify-center">
                <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs",
              status === "waiting" && "bg-blue-500/10 text-blue-400",
              status === "scanned" && "bg-amber-500/10 text-amber-400",
              status === "confirmed" && "bg-emerald-500/10 text-emerald-400",
              status === "error" && "bg-destructive/10 text-destructive",
              status === "loading" && "bg-accent text-muted-foreground",
            )}>
              {status === "loading" && <div className="size-2 animate-spin rounded-full border border-current border-t-transparent" />}
              <span>{statusConfig[status].label}</span>
            </div>
          </div>

          {errorMsg && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{errorMsg}</p>
          )}

          {/* Steps */}
          <div className="w-full space-y-2 rounded-2xl border border-border/40 bg-background/50 p-4">
            {steps.map((step) => (
              <div key={step.num} className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border/60 text-[10px]">
                  {step.num}
                </span>
                {step.text}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/70 px-5 py-3">
          <p className="text-[11px] text-muted-foreground">
            {status === "error" ? "请重试或联系支持" : "二维码有效期约 5 分钟"}
          </p>
          {status === "error" && (
            <Button size="sm" variant="secondary" onClick={startAuth} className="rounded-xl text-xs">
              <RefreshCw className="size-3" /> 重试
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

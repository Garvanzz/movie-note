import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Shared helpers ─────────────────────────────────────────────────────────

/** Parse raw user input into a deduplicated list of actor names. */
export function parseActorNames(rawValue: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const part of rawValue.split(/[\r\n,，、;；|]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(trimmed);
  }

  return names;
}

/** Human-readable label for an actor match kind. */
export function describeActorMatch(matchKind: string) {
  if (matchKind.startsWith("alias_")) return "别名匹配";
  if (matchKind.startsWith("name_jp")) return "日文名匹配";
  if (matchKind.startsWith("name_")) return "姓名匹配";
  return "演员匹配";
}

/** Format byte count for display. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Extract a display name from a CloudFile. */
export function getFileDisplayName(file: { file_name: string | null; file_path: string }): string {
  if (file.file_name) return file.file_name;
  const segments = file.file_path.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? file.file_path;
}

/** Parse newline-separated file paths into a deduplicated list. */
export function parseFilePaths(rawValue: string): string[] {
  return Array.from(
    new Set(
      rawValue
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

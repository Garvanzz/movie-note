import { invoke } from "./invoke";
import type { CloudFile, ProviderConfigData, ProviderFileEntry } from "@/types/file";

export function getMovieFiles(code: string): Promise<CloudFile[]> {
  return invoke("get_movie_files", { code });
}

export function addMovieFile(
  code: string,
  filePath: string,
  fileName?: string,
  fileSize?: number,
  provider?: string,
  providerFileId?: string,
  providerUrl?: string,
  providerMeta?: string,
): Promise<void> {
  return invoke("add_movie_file", {
    code,
    filePath,
    fileName,
    fileSize,
    provider,
    providerFileId,
    providerUrl,
    providerMeta,
  });
}

export function removeMovieFile(fileId: number): Promise<void> {
  return invoke("remove_movie_file", { fileId });
}

// ── Provider dispatch ─────────────────────────────────────────────────────

export interface ProviderConfig {
  providerName: string;
  root?: string;
  endpoint?: string;
  username?: string;
  password?: string;
}

export function providerList(
  config: ProviderConfig,
  path: string,
): Promise<ProviderFileEntry[]> {
  return invoke("provider_list", {
    providerName: config.providerName,
    path,
    root: config.root ?? null,
    endpoint: config.endpoint ?? null,
    username: config.username ?? null,
    password: config.password ?? null,
  });
}

export function providerSearch(
  config: ProviderConfig,
  code: string,
): Promise<ProviderFileEntry[]> {
  return invoke("provider_search", {
    providerName: config.providerName,
    code,
    root: config.root ?? null,
    endpoint: config.endpoint ?? null,
    username: config.username ?? null,
    password: config.password ?? null,
  });
}

export function providerResolveUrl(
  config: ProviderConfig,
  fileId: string,
): Promise<string> {
  return invoke("provider_resolve_url", {
    providerName: config.providerName,
    fileId,
    root: config.root ?? null,
    endpoint: config.endpoint ?? null,
    username: config.username ?? null,
    password: config.password ?? null,
  });
}

// ── Provider config CRUD ──────────────────────────────────────────────────

export function listProviderConfigs(): Promise<ProviderConfigData[]> {
  return invoke("list_provider_configs");
}

export function saveProviderConfig(
  config: ProviderConfigData,
): Promise<void> {
  return invoke("save_provider_config", { config });
}

export function deleteProviderConfig(id: string): Promise<void> {
  return invoke("delete_provider_config", { id });
}

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

// ── 115Open OAuth ────────────────────────────────────────────────────────

export interface DeviceCodeData {
  uid: string;
  qrcode: string;
  time: number;
  sign: string;
}

export interface QrCodeStatusData {
  status: number; // 0=waiting, 1=scanned, 2=confirmed
  msg: string;
  version?: string;
}

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface UserInfo {
  user_id: string;
  user_name: string;
}

export function open115StartAuth(clientId: string): Promise<DeviceCodeData> {
  return invoke("open115_start_auth", { clientId });
}

export function open115PollStatus(uid: string, time: number, sign: string): Promise<QrCodeStatusData> {
  return invoke("open115_poll_status", { uid, time, sign });
}

export function open115ExchangeToken(clientId: string, uid: string): Promise<TokenData> {
  return invoke("open115_exchange_token", { clientId, uid });
}

export function open115GetUserInfo(clientId: string): Promise<UserInfo> {
  return invoke("open115_get_user_info", { clientId });
}

export function open115CheckAuth(clientId: string): Promise<boolean> {
  return invoke("open115_check_auth", { clientId });
}

export function open115Logout(): Promise<void> {
  return invoke("open115_logout");
}

// ── 115 Open file operations ─────────────────────────────────────────────

export function open115Mkdir(clientId: string, pid: string, name: string): Promise<string> {
  return invoke("open115_mkdir", { clientId, pid, name });
}

export function open115Rename(clientId: string, fileId: string, newName: string): Promise<void> {
  return invoke("open115_rename", { clientId, fileId, newName });
}

export function open115Delete(clientId: string, fileIds: string, parentId: string): Promise<void> {
  return invoke("open115_delete", { clientId, fileIds, parentId });
}

export function open115Move(clientId: string, fileIds: string, toCid: string): Promise<void> {
  return invoke("open115_move", { clientId, fileIds, toCid });
}

export function open115Copy(clientId: string, fileIds: string, pid: string): Promise<void> {
  return invoke("open115_copy", { clientId, fileIds, pid });
}

// ── 115 Open stat / recycle ───────────────────────────────────────────────

export function open115Stat(clientId: string, fileId: string): Promise<any> {
  return invoke("open115_stat", { clientId, fileId });
}

export function open115RbList(clientId: string, limit: number, offset: number): Promise<any> {
  return invoke("open115_rb_list", { clientId, limit, offset });
}

export function open115RbRevert(clientId: string, tid: string): Promise<void> {
  return invoke("open115_rb_revert", { clientId, tid });
}

export function open115RbDelete(clientId: string, tid: string): Promise<void> {
  return invoke("open115_rb_delete", { clientId, tid });
}

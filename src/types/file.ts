export interface CloudFile {
  id: number;
  code: string;
  file_path: string;
  file_name: string | null;
  file_size: number | null;
  provider: string;
  provider_file_id: string | null;
  provider_url: string | null;
  provider_meta: string | null;
}

export interface ProviderFileEntry {
  file_id: string;
  file_name: string;
  file_size: number | null;
  file_url: string | null;
  is_directory: boolean;
}

export interface ProviderConfigData {
  id: string;
  name: string;
  provider_type: string; // "local" | "webdav" | "open115"
  endpoint: string | null;
  username: string | null;
  password: string | null;
  root: string | null;
}

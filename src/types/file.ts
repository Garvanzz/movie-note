export interface CloudFile {
  id: number;
  code: string;
  file_path: string;
  file_name: string | null;
  file_size: number | null;
}

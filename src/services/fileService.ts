import { invoke } from "@tauri-apps/api/core";
import type { CloudFile } from "@/types/file";

export function getMovieFiles(code: string): Promise<CloudFile[]> {
  return invoke("get_movie_files", { code });
}

export function addMovieFile(
  code: string,
  filePath: string,
  fileName?: string,
  fileSize?: number,
): Promise<void> {
  return invoke("add_movie_file", { code, filePath, fileName, fileSize });
}

export function removeMovieFile(fileId: number): Promise<void> {
  return invoke("remove_movie_file", { fileId });
}

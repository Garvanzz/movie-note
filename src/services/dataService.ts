import { invoke } from "./invoke";

export function exportAllData(): Promise<Record<string, unknown[]>> {
  return invoke("export_all_data");
}

export function importAllData(data: Record<string, unknown[]>): Promise<number> {
  return invoke("import_all_data", { data });
}

export function writeJsonFile(path: string, content: string): Promise<void> {
  return invoke("write_json_file", { path, content });
}

export function clearDatabase(): Promise<number> {
  return invoke("clear_database");
}

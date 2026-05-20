import { invoke } from "./invoke";
import type { WorkspaceInfo } from "@/types/common";

export function listWorkspaces(): Promise<WorkspaceInfo[]> {
  return invoke("list_workspaces");
}

export function switchWorkspace(name: string): Promise<void> {
  return invoke("switch_workspace", { name });
}
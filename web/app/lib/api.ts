export type TaskStatus = "Backlog" | "Todo" | "In Progress" | "Review" | "Done";
export type TaskPriority = "Low" | "Medium" | "High";

export type User = {
  id: number;
  email: string;
  name: string;
  is_site_admin: boolean;
};

export type Workspace = {
  id: number;
  name: string;
  role: string;
};

export type WorkspaceMember = {
  id: number;
  workspace_id: number;
  user_id: number;
  email: string;
  name: string;
  role: string;
  created_at: string;
};

export type Project = {
  id: number;
  workspace_id: number;
  name: string;
  description: string;
};

export type Task = {
  id: number;
  workspace_id: number;
  project_id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: number | null;
  created_by_id: number;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export type Comment = {
  id: number;
  task_id: number;
  author_id: number;
  body: string;
  created_at: string;
};

export type ActivityEvent = {
  id: number;
  task_id: number;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type Attachment = {
  id: number;
  filename: string;
  content_type: string;
  byte_size: number;
  checksum: string;
  created_at: string;
};

export type Notification = {
  id: number;
  workspace_id: number;
  user_id: number;
  task_id: number | null;
  event_type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
export const tokenKey = "ameo_token";
export const themeKey = "ameo_theme";
export const statusOrder: TaskStatus[] = ["Backlog", "Todo", "In Progress", "Review", "Done"];

export async function apiRequest<T>(
  path: string,
  token: string | null,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${apiBase}${path}`, { ...options, headers });
  const text = await response.text();
  if (!response.ok) {
    let detail = "";
    try {
      const parsed = JSON.parse(text) as { detail?: string };
      detail = parsed.detail ?? "";
    } catch {
      detail = "";
    }
    throw new Error(detail || text || `Request failed: ${response.status}`);
  }
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

export async function apiBlob(path: string, token: string | null): Promise<Blob> {
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${apiBase}${path}`, { headers });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }
  return response.blob();
}

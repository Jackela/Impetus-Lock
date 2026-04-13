/**
 * Template API Client
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface TemplateRecord {
  id: string;
  name: string;
  content: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export class TemplateAPIError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "TemplateAPIError";
  }
}

export async function fetchTemplates(): Promise<{ templates: TemplateRecord[]; total: number }> {
  const res = await fetch(`${API_BASE_URL}/templates/`, { credentials: "include" });
  if (!res.ok) throw new TemplateAPIError(res.status, "Failed to fetch templates");
  return res.json();
}

export async function fetchTemplate(id: string): Promise<TemplateRecord> {
  const res = await fetch(`${API_BASE_URL}/templates/${id}`, { credentials: "include" });
  if (!res.ok) throw new TemplateAPIError(res.status, "Failed to fetch template");
  return res.json();
}

export async function createTemplate(name: string, content: string): Promise<TemplateRecord> {
  const res = await fetch(`${API_BASE_URL}/templates/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, content }),
  });
  if (!res.ok) throw new TemplateAPIError(res.status, "Failed to create template");
  return res.json();
}

export async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/templates/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new TemplateAPIError(res.status, "Failed to delete template");
}

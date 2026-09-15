/**
 * Template API Client
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/** A reusable task template owned by a user. */
export interface TemplateRecord {
  id: string;
  name: string;
  content: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

/** Error thrown when a templates API request fails. */
export class TemplateAPIError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "TemplateAPIError";
  }
}

/**
 * Fetch all templates belonging to the current user.
 *
 * @returns The template records and total count
 */
export async function fetchTemplates(): Promise<{ templates: TemplateRecord[]; total: number }> {
  const res = await fetch(`${API_BASE_URL}/templates/`, { credentials: "include" });
  if (!res.ok) throw new TemplateAPIError(res.status, "Failed to fetch templates");
  return res.json();
}

/**
 * Fetch a single template by id.
 *
 * @param id - Identifier of the template to fetch
 * @returns The template record
 */
export async function fetchTemplate(id: string): Promise<TemplateRecord> {
  const res = await fetch(`${API_BASE_URL}/templates/${id}`, { credentials: "include" });
  if (!res.ok) throw new TemplateAPIError(res.status, "Failed to fetch template");
  return res.json();
}

/**
 * Create a new template.
 *
 * @param name - Display name of the template
 * @param content - Markdown content of the template
 * @returns The created template record
 */
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

/**
 * Delete a template by id.
 *
 * @param id - Identifier of the template to delete
 */
export async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/templates/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new TemplateAPIError(res.status, "Failed to delete template");
}

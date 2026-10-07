/** One atomic browser snapshot per account and local draft identity. */
export interface DraftSnapshot {
  draftId: string;
  content: string;
  lockIds: string[];
  taskId: string | null;
  version: number;
  versionKnown: boolean;
  dirty: boolean;
  updatedAt: number;
  /** Recovery backups remain available but are not selected automatically. */
  recoveryOf?: string;
}

const PREFIX = "impetus.draft.";
const prefix = (userId: string) => `${PREFIX}${encodeURIComponent(userId).replace(/\./g, "%2E")}.`;

function validSnapshot(value: unknown): value is DraftSnapshot {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<DraftSnapshot>;
  return (
    typeof draft.draftId === "string" &&
    typeof draft.content === "string" &&
    Array.isArray(draft.lockIds) &&
    draft.lockIds.every((id) => typeof id === "string") &&
    (draft.taskId === null || typeof draft.taskId === "string") &&
    typeof draft.version === "number" &&
    Number.isInteger(draft.version) &&
    draft.version >= 0 &&
    typeof draft.versionKnown === "boolean" &&
    typeof draft.dirty === "boolean" &&
    typeof draft.updatedAt === "number" &&
    Number.isFinite(draft.updatedAt) &&
    (draft.recoveryOf === undefined || typeof draft.recoveryOf === "string")
  );
}

/**
 * Generate an identity that remains stable when a server task is created.
 * @returns A fresh local draft identity
 */
export function newDraftId(): string {
  return crypto.randomUUID();
}

/**
 * Read all valid account snapshots without deleting malformed source data.
 * @param userId - Server-confirmed account ID
 * @returns Snapshots ordered from newest to oldest
 */
export function listOwnedDrafts(userId: string): DraftSnapshot[] {
  const result: DraftSnapshot[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix(userId))) continue;
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key)!);
      if (validSnapshot(value)) result.push(value);
    } catch {
      /* Retain malformed source data for explicit recovery. */
    }
  }
  return result.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Select the newest task snapshot, or the newest regular draft when omitted.
 * @param userId - Server-confirmed account ID
 * @param taskId - Optional task selection; null selects local drafts
 * @returns The newest matching snapshot, or null
 */
export function readOwnedDraft(userId: string, taskId?: string | null): DraftSnapshot | null {
  return (
    listOwnedDrafts(userId).find(
      (draft) => !draft.recoveryOf && (taskId === undefined || draft.taskId === taskId)
    ) ?? null
  );
}

/**
 * Save a complete snapshot atomically; callers must surface storage failures.
 * @param userId - Server-confirmed account ID
 * @param draft - Complete content, locks and version snapshot
 */
export function writeOwnedDraft(userId: string, draft: DraftSnapshot): void {
  localStorage.setItem(
    `${prefix(userId)}${encodeURIComponent(draft.draftId)}`,
    JSON.stringify(draft)
  );
}

/** Unassigned cache data and its original strings for lossless export. */
export interface LegacyDraft {
  contentRaw: string | null;
  metaRaw: string | null;
  payload: {
    content: string;
    lockIds: string[];
    taskId: string | null;
    version: number | null;
  } | null;
  error: string | null;
}

/**
 * Inspect old global keys without attributing them to any authenticated user.
 * @returns The original strings and validated basic payload, or null
 */
export function readLegacyDraft(): LegacyDraft | null {
  const contentRaw = localStorage.getItem("impetus.task.cache");
  const metaRaw = localStorage.getItem("impetus.task.meta");
  if (contentRaw === null && metaRaw === null) return null;
  const result: LegacyDraft = { contentRaw, metaRaw, payload: null, error: null };
  try {
    const meta: unknown = metaRaw === null ? {} : JSON.parse(metaRaw);
    if (!meta || typeof meta !== "object" || Array.isArray(meta) || contentRaw === null) {
      throw new Error("Legacy draft content or metadata could not be read.");
    }
    const fields = meta as Record<string, unknown>;
    const locks = fields.lockIds ?? fields.lock_ids ?? fields.pendingLockIds ?? [];
    if (!Array.isArray(locks) || !locks.every((id) => typeof id === "string")) {
      throw new Error("Legacy lock IDs could not be recovered. Export the original draft.");
    }
    result.payload = {
      content: contentRaw,
      lockIds: locks,
      taskId: typeof fields.taskId === "string" ? fields.taskId : null,
      version:
        typeof fields.version === "number" &&
        Number.isInteger(fields.version) &&
        fields.version >= 0
          ? fields.version
          : null,
    };
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Legacy draft could not be read.";
  }
  return result;
}

/**
 * Export both untouched legacy strings as a lossless JSON recovery envelope.
 * @returns A lossless JSON envelope, or null when legacy data is absent
 */
export function exportLegacyDraft(): string | null {
  const legacy = readLegacyDraft();
  return legacy ? JSON.stringify({ contentRaw: legacy.contentRaw, metaRaw: legacy.metaRaw }) : null;
}

/** Remove unassigned data only after the user explicitly chooses discard. */
export function discardLegacyDraft(): void {
  localStorage.removeItem("impetus.task.cache");
  localStorage.removeItem("impetus.task.meta");
}

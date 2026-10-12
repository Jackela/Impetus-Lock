import { inspectOwnedDrafts, newDraftId, writeOwnedDraft, type DraftSnapshot } from "./draftStore";

const MODAL_ATTEMPT_PREFIX = "modal-create:";

/**
 * Read preserved modal attempts without changing the editor's selected draft.
 * @param userId - Server-confirmed owner of the attempts
 * @returns Unconfirmed attempts from this modal, newest first
 */
export function readModalCreateAttempts(userId: string): DraftSnapshot[] {
  const inspected = inspectOwnedDrafts(userId);
  if (
    inspected.issues.some((issue) => decodeURIComponent(issue.key).includes(MODAL_ATTEMPT_PREFIX))
  ) {
    throw new Error(
      "A task creation record could not be read. Keep the original browser data and retry recovery."
    );
  }
  return inspected.drafts.filter(
    (draft) => draft.draftId.startsWith(MODAL_ATTEMPT_PREFIX) && draft.creationUncertain
  );
}

/**
 * Persist the entire attempted body before any request may be dispatched.
 * @param userId - Server-confirmed owner; standalone callers retain memory only
 * @param content - Complete attempted Markdown body
 * @param lockIds - Complete attempted lock identities
 * @returns An independent recovery record for this attempt
 */
export function retainModalCreateAttempt(
  userId: string | undefined,
  content: string,
  lockIds: string[]
): DraftSnapshot {
  const draftId = `${MODAL_ATTEMPT_PREFIX}${newDraftId()}`;
  const snapshot: DraftSnapshot = {
    draftId,
    content,
    lockIds: [...lockIds],
    taskId: null,
    version: 0,
    versionKnown: false,
    dirty: true,
    updatedAt: Date.now(),
    recoveryOf: "create-task-modal",
    creationUncertain: true,
    creationAttempt: { content, lockIds: [...lockIds] },
  };
  if (userId) writeOwnedDraft(userId, snapshot);
  return snapshot;
}

/**
 * Preserve unsent modal input as an owned recovery copy before an account transition.
 * @param userId - Server-confirmed owner of the input
 * @param draftId - Independent identity for this form instance
 * @param content - The latest unsubmitted title, without trimming
 * @param separateFrom - An earlier uncertain attempt for explicit separate creation
 * @returns The complete form recovery snapshot
 */
export function retainModalFormDraft(
  userId: string,
  draftId: string,
  content: string,
  separateFrom?: string
): DraftSnapshot {
  const snapshot: DraftSnapshot = {
    draftId,
    content,
    lockIds: [],
    taskId: null,
    version: 0,
    versionKnown: false,
    dirty: true,
    updatedAt: Date.now(),
    recoveryOf: "create-task-modal-form",
    ...(separateFrom ? { workingCopyOf: separateFrom } : {}),
  };
  writeOwnedDraft(userId, snapshot);
  return snapshot;
}

/**
 * List owned unsent form backups without assigning any one to the current form.
 * @param userId - Server-confirmed owner of the backups
 * @returns Complete retained form inputs, newest first
 */
export function readModalFormDrafts(userId: string): DraftSnapshot[] {
  const inspected = inspectOwnedDrafts(userId);
  if (inspected.issues.some((issue) => decodeURIComponent(issue.key).includes("modal-form:"))) {
    throw new Error(
      "Unsubmitted task title backups could not be read. Keep the original browser data and retry recovery."
    );
  }
  return inspected.drafts.filter((draft) => draft.draftId.startsWith("modal-form:") && draft.dirty);
}

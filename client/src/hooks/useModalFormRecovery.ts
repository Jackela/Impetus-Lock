import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useOptionalAuth } from "../contexts/AuthContext";
import { newDraftId, type DraftSnapshot } from "../services/draftStore";
import { readModalFormDrafts, retainModalFormDraft } from "../services/modalCreateAttemptStore";

/** Latest form input, including the account that actually owns its displayed text. */
interface ModalFormInput {
  open: boolean;
  ownerId?: string;
  getTitle: () => string;
  unsubmitted: boolean;
  separateFrom?: string;
}

function readRecovery(ownerId?: string): { drafts: DraftSnapshot[]; error: string | null } {
  if (!ownerId) return { drafts: [], error: null };
  try {
    return { drafts: readModalFormDrafts(ownerId), error: null };
  } catch (failure) {
    return {
      drafts: [],
      error:
        failure instanceof Error ? failure.message : "Task title recovery failed. Please retry.",
    };
  }
}

/**
 * Retain unsent modal input before authentication changes, without selecting an editor draft.
 * @param input - Latest displayed input and its original owner
 * @param input.open - Whether the form is displayed
 * @param input.ownerId - Account that owns the form
 * @param input.getTitle - Read the latest title, including the current input event
 * @param input.unsubmitted - Whether the title needs a backup
 * @param input.separateFrom - Earlier attempt associated with this separate title
 * @returns Owned backups, any recovery failure and synchronous preservation/retry actions
 */
export function useModalFormRecovery({
  open,
  ownerId,
  getTitle,
  unsubmitted,
  separateFrom,
}: ModalFormInput) {
  const auth = useOptionalAuth();
  const registerSnapshot = auth?.registerSnapshot;
  const identity = useMemo(() => ({ ownerId, draftId: `modal-form:${newDraftId()}` }), [ownerId]);
  const [state, setState] = useState(() => ({
    open,
    ownerId,
    ...readRecovery(open ? ownerId : undefined),
  }));
  if (state.open !== open || state.ownerId !== ownerId) {
    setState({ open, ownerId, ...readRecovery(open ? ownerId : undefined) });
  }

  const preserveTitle = useCallback(() => {
    if (!ownerId || !open || !unsubmitted) return;
    const title = getTitle();
    if (!title) return;
    try {
      retainModalFormDraft(ownerId, identity.draftId, title, separateFrom);
    } catch (failure) {
      setState((previous) => ({
        ...previous,
        error:
          "Your unsubmitted task title could not be saved. Keep this form open and retry when browser storage is available.",
      }));
      throw failure;
    }
  }, [getTitle, identity, open, ownerId, separateFrom, unsubmitted]);

  const retryRecovery = useCallback(() => {
    if (!ownerId || !open) return;
    setState({ open, ownerId, ...readRecovery(ownerId) });
  }, [ownerId, open]);

  useLayoutEffect(() => {
    if (!registerSnapshot || !ownerId || !open) return;
    return registerSnapshot(preserveTitle);
  }, [registerSnapshot, ownerId, open, preserveTitle]);

  return {
    drafts: state.ownerId === ownerId ? state.drafts : [],
    error: state.ownerId === ownerId ? state.error : null,
    preserveTitle,
    retryRecovery,
  };
}

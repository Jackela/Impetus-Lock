import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOptionalAuth } from "../contexts/AuthContext";
import { newDraftId, type DraftSnapshot } from "../services/draftStore";
import { readModalFormDrafts, retainModalFormDraft } from "../services/modalCreateAttemptStore";

/** Latest form input, including the account that actually owns its displayed text. */
interface ModalFormInput {
  open: boolean;
  ownerId?: string;
  titleRef: { current: string };
  unsubmitted: boolean;
  separateFrom?: string;
}

/**
 * Retain unsent modal input before authentication changes, without selecting an editor draft.
 * @param input - Latest displayed input and its original owner
 * @returns Owned backups, any recovery failure and synchronous preservation/retry actions
 */
export function useModalFormRecovery(input: ModalFormInput) {
  const auth = useOptionalAuth();
  const ownerId = auth?.user?.id;
  const registerSnapshot = auth?.registerSnapshot;
  const identity = useMemo(() => ({ ownerId, draftId: `modal-form:${newDraftId()}` }), [ownerId]);
  const currentInput = useRef(input);
  currentInput.current = input;
  const [state, setState] = useState<{
    ownerId?: string;
    drafts: DraftSnapshot[];
    error: string | null;
  }>({ drafts: [], error: null });
  const preserveTitle = useCallback(() => {
    const current = currentInput.current;
    const title = current.titleRef.current;
    if (!ownerId || current.ownerId !== ownerId || !current.open || !current.unsubmitted || !title)
      return;
    try {
      retainModalFormDraft(ownerId, identity.draftId, title, current.separateFrom);
    } catch (failure) {
      setState((previous) => ({
        ...previous,
        ownerId,
        error:
          "Your unsubmitted task title could not be saved. Keep this form open and retry when browser storage is available.",
      }));
      throw failure;
    }
  }, [identity, ownerId]);
  const retryRecovery = useCallback(() => {
    if (!ownerId || !currentInput.current.open) return;
    try {
      setState({ ownerId, drafts: readModalFormDrafts(ownerId), error: null });
    } catch (failure) {
      setState({
        ownerId,
        drafts: [],
        error:
          failure instanceof Error ? failure.message : "Task title recovery failed. Please retry.",
      });
    }
  }, [ownerId]);
  useEffect(() => {
    retryRecovery();
  }, [retryRecovery, input.open]);
  useEffect(() => {
    if (!registerSnapshot || !ownerId || !input.open) return;
    return registerSnapshot(preserveTitle);
  }, [registerSnapshot, ownerId, input.open, preserveTitle]);
  return {
    drafts: state.ownerId === ownerId ? state.drafts : [],
    error: state.ownerId === ownerId ? state.error : null,
    preserveTitle,
    retryRecovery,
  };
}

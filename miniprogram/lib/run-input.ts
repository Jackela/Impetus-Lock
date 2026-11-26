import type { Action } from "./types";

export type FirstTurn = Omit<Action, "kind" | "version">;

export interface Pending {
  action: Action;
  first?: boolean;
  cancelRequestId?: string;
  verbatimRequestId?: string;
  fromVoiceSwitch?: boolean;
  reviewedVersion?: number;
}

export interface FinishedInput {
  requestId: string;
  text: string;
  kind: "voice" | "first" | "draft";
}

export function finishedInput(action: FirstTurn | undefined | null): FinishedInput | undefined {
  if (action?.request_id && action.text && (action.source === "keyboard" || action.source === "voice")) {
    return { requestId: action.request_id, text: action.text, kind: action.source === "voice" ? "voice" : "first" };
  }
  return undefined;
}

export function finishedDraft(text?: string | null): FinishedInput | undefined {
  return typeof text === "string" && text.trim() ? { requestId: "local-draft", text, kind: "draft" } : undefined;
}

export function pendingFinishedInput(pending?: Pending | null): FinishedInput | undefined {
  return pending?.action?.kind === "turn" && (pending.first || pending.action.source === "voice")
    ? finishedInput(pending.action) : undefined;
}

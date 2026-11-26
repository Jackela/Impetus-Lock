import { act, renderHook } from "@testing-library/react";
import type { Editor } from "@milkdown/core";
import { expect, it, vi } from "vitest";
import { DELETE_RESET_DELAY_MS, MIN_DOCUMENT_SIZE_FOR_DELETE } from "../config/animation";
import { AIActionType } from "../types/ai-actions";
import { useManualDelete } from "./useManualDelete";

it("blocks reentry and exposes the cooldown without a parent rerender", () => {
  vi.useFakeTimers();
  try {
    const onSensoryFeedback = vi.fn();
    const editor = {
      action: () => ({
        state: { doc: { content: { size: MIN_DOCUMENT_SIZE_FOR_DELETE - 1 } } },
      }),
    } as unknown as Editor;
    const { result } = renderHook(() => useManualDelete({ onSensoryFeedback }));

    act(() => {
      result.current.handleManualDelete(editor);
      result.current.handleManualDelete(editor);
    });
    expect(onSensoryFeedback).toHaveBeenCalledExactlyOnceWith(AIActionType.ERROR, {
      duration: DELETE_RESET_DELAY_MS,
    });
    expect(result.current.isDeleting).toBe(true);

    act(() => vi.advanceTimersByTime(DELETE_RESET_DELAY_MS));
    expect(result.current.isDeleting).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});

import { act, renderHook } from "@testing-library/react";
import { Editor } from "@milkdown/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EDITOR_RETRY_INTERVAL_MS } from "../config/animation";
import { useEditorInitialization } from "./useEditorInitialization";

describe("useEditorInitialization", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("publishes readiness when Milkdown becomes available on a retry", async () => {
    const editor = Editor.make();
    const onReady = vi.fn();
    const getEditor = vi.fn<() => Editor | undefined>().mockReturnValueOnce(undefined);
    getEditor.mockReturnValue(editor);
    const { result } = renderHook(() => useEditorInitialization({ getEditor, onReady }));
    expect(result.current.isInitialized).toBe(false);

    await act(() => vi.advanceTimersByTimeAsync(EDITOR_RETRY_INTERVAL_MS));

    expect(result.current.isInitialized).toBe(true);
    expect(result.current.editorRef.current).toBe(editor);
    expect(onReady).toHaveBeenCalledExactlyOnceWith(editor);
  });

  it("cancels the pending readiness check when its writer unmounts", async () => {
    const editor = Editor.make();
    const onReady = vi.fn();
    const getEditor = vi.fn<() => Editor | undefined>().mockReturnValueOnce(undefined);
    getEditor.mockReturnValue(editor);
    const { unmount } = renderHook(() => useEditorInitialization({ getEditor, onReady }));
    unmount();

    await act(() => vi.advanceTimersByTimeAsync(EDITOR_RETRY_INTERVAL_MS));

    expect(getEditor).toHaveBeenCalledTimes(1);
    expect(onReady).not.toHaveBeenCalled();
  });
});

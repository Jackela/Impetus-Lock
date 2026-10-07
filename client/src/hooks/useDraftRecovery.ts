import { useCallback, useState } from "react";
import { discardLegacyDraft, exportLegacyDraft, readLegacyDraft } from "../services/draftStore";

function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Keep unassigned source data available for explicit recovery choices.
 * @returns The original draft, recovery errors, and explicit export/discard actions
 */
export function useDraftRecovery() {
  const [error, setError] = useState<string | null>(null);
  const [legacy, setLegacy] = useState(() => {
    try {
      return readLegacyDraft();
    } catch {
      return null;
    }
  });
  const exportLegacy = useCallback(() => {
    try {
      const content = exportLegacyDraft();
      if (content !== null) download(content, "unassigned-draft.json", "application/json");
    } catch {
      setError("The original draft could not be exported. Keep this page open and retry.");
    }
  }, []);
  const discardLegacy = useCallback(() => {
    try {
      discardLegacyDraft();
      setLegacy(null);
      setError(null);
    } catch {
      setError(
        "The unassigned draft could not be discarded. Retry when browser storage is available."
      );
    }
  }, []);
  const exportCurrent = useCallback((content: string, lockIds: string[]) => {
    download(JSON.stringify({ content, lockIds }), "writing-draft.json", "application/json");
  }, []);
  const exportOwned = useCallback((issue: { key: string; raw: string }) => {
    download(
      JSON.stringify({ key: issue.key, raw: issue.raw }, null, 2),
      "owned-draft-backup.json",
      "application/json"
    );
  }, []);
  return { legacy, error, exportLegacy, discardLegacy, exportCurrent, exportOwned };
}

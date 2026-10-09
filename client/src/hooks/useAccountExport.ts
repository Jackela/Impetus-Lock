import { useEffect, useRef, useState } from "react";
import { useOptionalAuth } from "../contexts/AuthContext";
import { fetchTasks, type TaskListResponse } from "../services/api/taskClient";
import { fetchStats, type StatsRecord } from "../services/api/statsClient";
import type { RemoteSession } from "../services/api/remoteSession";

/** Server data belonging to the account captured when export began. */
export interface AccountExportData {
  tasks: TaskListResponse;
  stats: StatsRecord;
}

/**
 * Fetch account data for a synchronous download callback within its current session.
 *
 * @returns Export availability, waiting state, and the account export action
 */
export function useAccountExport() {
  const auth = useOptionalAuth();
  const session = auth?.session;
  const canExport = auth === undefined || auth.remoteEnabled;
  const [state, setState] = useState<{
    exporting: boolean;
    error: string | null;
    session?: RemoteSession | null;
  }>({ exporting: false, error: null });
  const ownsState = auth === undefined || (state.session === session && !!session?.isCurrent());
  const exporting = ownsState && state.exporting;
  const mounted = useRef(false);
  const request = useRef<{ controller: AbortController; session?: RemoteSession | null } | null>(
    null
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.controller.abort();
      request.current = null;
    };
  }, []);

  const exportAccountData = async (download: (data: AccountExportData) => void): Promise<void> => {
    if (!canExport || !mounted.current || (session !== undefined && !session?.isCurrent())) return;
    if (
      request.current &&
      request.current.session === session &&
      !request.current.controller.signal.aborted
    )
      return;
    request.current?.controller.abort();
    const controller = new AbortController();
    const operation = { controller, session };
    request.current = operation;
    const current = (): boolean =>
      mounted.current &&
      request.current === operation &&
      !controller.signal.aborted &&
      (session === undefined || !!session?.isCurrent());
    setState({ exporting: true, error: null, session });
    try {
      const options = { session, signal: controller.signal };
      const [tasks, stats] = await Promise.all([fetchTasks({}, options), fetchStats(options)]);
      if (current()) download({ tasks, stats });
    } catch (error) {
      if (current() && !(error instanceof Error && error.name === "AbortError")) {
        const message = error instanceof Error ? error.message : "Unable to export account data";
        const status =
          error instanceof Error && "status" in error && typeof error.status === "number"
            ? ` (HTTP ${error.status})`
            : "";
        setState((previous) => ({ ...previous, error: `${message}${status}. Please retry.` }));
      }
    } finally {
      const update = current();
      if (request.current === operation) request.current = null;
      if (update) setState((previous) => ({ ...previous, exporting: false }));
    }
  };

  return { canExport, exporting, error: ownsState ? state.error : null, exportAccountData };
}

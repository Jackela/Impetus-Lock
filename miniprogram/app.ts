import { invalidateSession } from "./lib/api";

import { getFirstStoryTimings, markLaunch } from "./lib/perf";

App({
  getFirstStoryTimings,
  onLaunch() { markLaunch(); },
  onShow() {
    // Reconfirm on foreground entry. An old login or private response may still be in flight.
    invalidateSession();
  },
});

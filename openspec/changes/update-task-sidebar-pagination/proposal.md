# Reach older tasks from the editor sidebar

The authenticated task API already returns ordered pages. The sidebar only requested the first 100 tasks. The maintainer authorized a compatible navigation entry in the November 26 remediation. Load the next page on demand, retain earlier pages and the current selection on failure, and allow retries through the existing task endpoint.

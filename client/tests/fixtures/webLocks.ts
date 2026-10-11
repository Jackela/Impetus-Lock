/**
 * Simulate the browser lock boundary in jsdom; browser acceptance uses real Web Locks.
 * @returns A serial lock manager with abortable waiting and no forced release of active work
 */
export function browserLockFixture() {
  const queues = new Map<string, Promise<unknown>>();
  return {
    async request<T>(
      name: string,
      options: LockOptions,
      callback: (lock: { name: string; mode: "exclusive" }) => Promise<T>
    ): Promise<T> {
      const previous = queues.get(name) ?? Promise.resolve();
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      queues.set(
        name,
        previous.catch(() => {}).then(() => held)
      );
      try {
        await previous.catch(() => {});
        if (options.signal?.aborted) throw new DOMException("Waiting was cancelled", "AbortError");
        return await callback({ name, mode: "exclusive" });
      } finally {
        release();
      }
    },
  };
}

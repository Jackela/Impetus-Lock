/** Simulate one browser origin without sharing Node's broadcast channels across test workers. */
export class BrowserBroadcastChannel {
  private static readonly channels = new Set<BrowserBroadcastChannel>();
  readonly name: string;
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;

  /** @param name - Browser channel name */
  constructor(name: string) {
    this.name = name;
    BrowserBroadcastChannel.channels.add(this);
  }

  /** @param data - Structured message delivered to other listeners on this origin */
  postMessage(data: unknown): void {
    for (const channel of BrowserBroadcastChannel.channels) {
      if (channel !== this && channel.name === this.name) {
        queueMicrotask(() => {
          if (BrowserBroadcastChannel.channels.has(channel))
            channel.onmessage?.(new MessageEvent("message", { data }));
        });
      }
    }
  }

  /** Stop receiving messages when a page's authentication observer is removed. */
  close(): void {
    BrowserBroadcastChannel.channels.delete(this);
  }
}

/**
 * Force UTC timezone for consistent test output across environments.
 *
 * This ensures that Date.toLocaleString() produces the same output
 * in local development (which may use UTC+8) and CI (which uses UTC).
 */
process.env.TZ = "UTC";

import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

/**
 * Mock matchMedia (for prefers-reduced-motion and responsive design support)
 *
 * Enhanced implementation that:
 * - Supports prefers-reduced-motion queries
 * - Supports responsive breakpoint queries (max-width, min-width)
 * - Properly implements addEventListener/removeEventListener
 */
interface MediaQueryListListener {
  (event: MediaQueryListEvent): void;
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => {
    let matches = false;

    if (query.includes("prefers-reduced-motion: reduce")) {
      matches = false;
    } else if (query.includes("max-width")) {
      const maxWidth = parseInt(query.match(/max-width:\s*(\d+)px/)?.[1] || "0", 10);
      matches = 1024 <= maxWidth;
    } else if (query.includes("min-width")) {
      const minWidth = parseInt(query.match(/min-width:\s*(\d+)px/)?.[1] || "0", 10);
      matches = 1024 >= minWidth;
    }

    const listeners: MediaQueryListListener[] = [];

    return {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((event: string, listener: MediaQueryListListener) => {
        if (event === "change") {
          listeners.push(listener);
        }
      }),
      removeEventListener: vi.fn((event: string, listener: MediaQueryListListener) => {
        if (event === "change") {
          const index = listeners.indexOf(listener);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        }
      }),
      dispatchEvent: vi.fn(),
    };
  }),
});

/**
 * Mock Web Audio API (T034)
 *
 * jsdom doesn't support AudioContext, so we need to mock it for testing.
 * This provides a minimal mock that tracks audio operations for test assertions.
 */
class MockAudioContext {
  destination = {};
  currentTime = 0;

  createBufferSource() {
    return {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  createGain() {
    return {
      gain: { value: 1 },
      connect: vi.fn(),
    };
  }

  decodeAudioData(arrayBuffer: ArrayBuffer) {
    return Promise.resolve({
      duration: 1.0,
      length: 44100,
      numberOfChannels: 2,
      sampleRate: 44100,
    });
  }

  close() {
    return Promise.resolve();
  }
}

global.AudioContext = MockAudioContext as unknown as typeof AudioContext;
(window as Window).AudioContext = MockAudioContext as unknown as typeof AudioContext;

/**
 * Mock fetch for static audio assets so Vitest doesn't try to resolve real files.
 */
const originalFetch = global.fetch;

const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : ((input as Request).url ?? "");

  if (url.includes("/src/assets/audio/")) {
    // Return a tiny ArrayBuffer to satisfy decodeAudioData
    const buffer = new ArrayBuffer(8);
    return new Response(buffer, { status: 200 });
  }

  if (originalFetch) {
    return originalFetch(input as RequestInfo, init);
  }

  return new Response(null, { status: 200 });
});

global.fetch = mockFetch;
(window as Window).fetch = mockFetch;

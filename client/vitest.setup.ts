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
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => {
    // Simple query parsing for common patterns
    let matches = false;

    // Check for prefers-reduced-motion
    if (query.includes("prefers-reduced-motion: reduce")) {
      matches = false; // Default: no reduced motion
    }
    // Check for max-width queries (mobile-first responsive design)
    else if (query.includes("max-width")) {
      const maxWidth = parseInt(query.match(/max-width:\s*(\d+)px/)?.[1] || "0", 10);
      // Default to desktop viewport (1024px) in tests
      matches = 1024 <= maxWidth;
    }
    // Check for min-width queries
    else if (query.includes("min-width")) {
      const minWidth = parseInt(query.match(/min-width:\s*(\d+)px/)?.[1] || "0", 10);
      // Default to desktop viewport (1024px) in tests
      matches = 1024 >= minWidth;
    }

    const listeners: Array<(event: any) => void> = [];

    return {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn((event: string, listener: (event: any) => void) => {
        if (event === "change") {
          listeners.push(listener);
        }
      }),
      removeEventListener: vi.fn((event: string, listener: (event: any) => void) => {
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

// Assign to both global and window for maximum compatibility
global.AudioContext = MockAudioContext as any;
(window as any).AudioContext = MockAudioContext;

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

global.fetch = mockFetch as typeof fetch;
(window as any).fetch = mockFetch;

import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

/**
 * Mock matchMedia (for prefers-reduced-motion support)
 */
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false, // Default: no reduced motion
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
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

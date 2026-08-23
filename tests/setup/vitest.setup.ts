import "@testing-library/jest-dom/vitest";

import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());

// Lazy route transforms are substantially slower under V8 coverage and on
// constrained CI runners. Assertions still resolve immediately in normal runs.
configure({ asyncUtilTimeout: 10_000 });

// Mirror the production document shell from index.html for document-level a11y checks.
document.documentElement.lang = "es";

class ResizeObserverStub implements ResizeObserver {
  readonly observe = vi.fn<ResizeObserver["observe"]>();
  readonly unobserve = vi.fn<ResizeObserver["unobserve"]>();
  readonly disconnect = vi.fn<ResizeObserver["disconnect"]>();
}

Object.defineProperty(window, "ResizeObserver", {
  configurable: true,
  value: ResizeObserverStub,
});

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn<MediaQueryList["addEventListener"]>(),
    removeEventListener: vi.fn<MediaQueryList["removeEventListener"]>(),
    addListener: vi.fn<MediaQueryList["addListener"]>(),
    removeListener: vi.fn<MediaQueryList["removeListener"]>(),
    dispatchEvent: vi.fn<MediaQueryList["dispatchEvent"]>(),
  }),
});

Object.defineProperty(window, "scrollTo", {
  configurable: true,
  value: vi.fn<typeof window.scrollTo>(),
});

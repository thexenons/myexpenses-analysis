import { act, renderHook } from "@testing-library/react";
import { createElement, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useToday } from "./use-today.ts";

describe("useToday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T21:59:30Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("uses the requested calendar timezone rather than the UTC day", () => {
    vi.setSystemTime(new Date("2026-10-05T23:30:00Z"));
    const { result } = renderHook(() => useToday("Europe/Madrid"));
    expect(result.current).toBe("2026-10-06");
  });

  it("refreshes a mounted snapshot across local midnight", () => {
    const { result } = renderHook(() => useToday("Europe/Madrid"));
    expect(result.current).toBe("2026-10-05");
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current).toBe("2026-10-06");
  });

  it("reinterprets timezone changes and catches up with the current clock", () => {
    vi.setSystemTime(new Date("2026-10-05T23:30:00Z"));
    const { result, rerender } = renderHook(({ zone }) => useToday(zone), {
      initialProps: { zone: "America/New_York" },
    });
    expect(result.current).toBe("2026-10-05");
    rerender({ zone: "Europe/Madrid" });
    expect(result.current).toBe("2026-10-06");
    vi.setSystemTime(new Date("2026-10-07T23:30:00Z"));
    rerender({ zone: "America/New_York" });
    expect(result.current).toBe("2026-10-07");
  });

  it("does not re-render for minute ticks within the same local day", () => {
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
    const rendered = vi.fn<(today: string) => void>();
    renderHook(() => {
      const today = useToday("Europe/Madrid");
      rendered(today);
      return today;
    });
    const initialRenders = rendered.mock.calls.length;
    act(() => vi.advanceTimersByTime(10 * 60_000));
    expect(rendered).toHaveBeenCalledTimes(initialRenders);
  });

  it("catches up on focus after a suspended clock", () => {
    const { result } = renderHook(() => useToday("Europe/Madrid"));
    vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
    act(() => window.dispatchEvent(new Event("focus")));
    expect(result.current).toBe("2026-10-07");
  });

  it("catches up when the document becomes visible", () => {
    const visibility = vi.spyOn(document, "visibilityState", "get");
    const { result } = renderHook(() => useToday("Europe/Madrid"));
    vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
    visibility.mockReturnValue("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(result.current).toBe("2026-10-05");
    visibility.mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(result.current).toBe("2026-10-07");
  });

  it("cleans up its timer and event subscriptions in StrictMode", () => {
    const removeFocus = vi.spyOn(window, "removeEventListener");
    const removeVisibility = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(() => useToday("Europe/Madrid"), {
      wrapper: ({ children }) => createElement(StrictMode, null, children),
    });
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(removeFocus).toHaveBeenCalledWith("focus", expect.any(Function));
    expect(removeVisibility).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });
});

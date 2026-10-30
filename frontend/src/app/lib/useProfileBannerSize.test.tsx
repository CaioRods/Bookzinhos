// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useProfileBannerSize } from "./useProfileBannerSize";

afterEach(() => {
  cleanup();
  document.querySelector("[data-profile-banner]")?.remove();
  vi.unstubAllGlobals();
});
describe("profile banner preview geometry", () => {
  it("uses the actual banner and tracks responsive or content-driven size changes", () => {
    let notify: () => void = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          notify = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const banner = document.createElement("header");
    banner.setAttribute("data-profile-banner", "");
    document.body.append(banner);
    let dimensions = { width: 1485, height: 420 };
    banner.getBoundingClientRect = () => ({
      ...dimensions,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: dimensions.height,
      right: dimensions.width,
      toJSON: () => ({}),
    });
    const hook = renderHook(() => useProfileBannerSize(true));
    expect(hook.result.current).toEqual({ width: 1485, height: 420 });
    act(() => {
      dimensions = { width: 390, height: 518 };
      notify();
    });
    expect(hook.result.current).toEqual({ width: 390, height: 518 });
    hook.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
  it("does not change other crop surfaces", () => {
    const hook = renderHook(() => useProfileBannerSize(false));
    expect(hook.result.current).toBeNull();
  });
});

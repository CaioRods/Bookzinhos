// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installLongPressContext } from "./longPressContext";
let dispose: () => void;
function pointer(element: Element, type: string, extra: Record<string, unknown> = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerType: "touch", isPrimary: true, pointerId: 1, clientX: 20, clientY: 20, ...extra });
  element.dispatchEvent(event);
}
beforeEach(() => { vi.useFakeTimers(); document.body.innerHTML = '<div data-banner-src="/banner.webp"><img/><button>Editar</button></div>'; dispose = installLongPressContext(); });
afterEach(() => { dispose(); vi.useRealTimers(); document.body.innerHTML = ""; });
describe("touch context actions", () => {
  it("opens once on hold and suppresses the release click", () => {
    const image = document.querySelector("img")!;
    const menu = vi.fn(), click = vi.fn(); image.addEventListener("contextmenu", menu); image.addEventListener("click", click);
    pointer(image, "pointerdown"); vi.advanceTimersByTime(500);
    expect(menu).toHaveBeenCalledOnce();
    pointer(image, "pointerup");
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }); image.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true); expect(click).not.toHaveBeenCalled();
  });
  it.each(["move", "scroll", "cancel", "release"])("does not open after %s", action => {
    const image = document.querySelector("img")!, menu = vi.fn(); image.addEventListener("contextmenu", menu);
    pointer(image, "pointerdown"); vi.advanceTimersByTime(200);
    if (action === "move") pointer(image, "pointermove", { clientY: 60 });
    else if (action === "scroll") document.dispatchEvent(new Event("scroll"));
    else pointer(image, action === "cancel" ? "pointercancel" : "pointerup");
    vi.advanceTimersByTime(600); expect(menu).not.toHaveBeenCalled();
  });
  it("preserves quick taps, mouse clicks, banner controls and removes pending work on cleanup", () => {
    const image = document.querySelector("img")!, button = document.querySelector("button")!, menu = vi.fn(); image.addEventListener("contextmenu", menu);
    pointer(image, "pointerdown", { pointerType: "mouse" }); vi.advanceTimersByTime(600);
    pointer(button, "pointerdown"); vi.advanceTimersByTime(600);
    expect(menu).not.toHaveBeenCalled();
    pointer(image, "pointerdown"); pointer(image, "pointerup");
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }); image.dispatchEvent(event); expect(event.defaultPrevented).toBe(false);
    pointer(image, "pointerdown"); dispose(); vi.advanceTimersByTime(600); expect(menu).not.toHaveBeenCalled();
  });
});

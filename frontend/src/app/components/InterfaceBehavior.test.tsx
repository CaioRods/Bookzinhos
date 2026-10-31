// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { InterfaceBehavior } from "./InterfaceBehavior";
afterEach(cleanup);
it("blocks content copying and link/image dragging but preserves editing and removes its listeners", () => {
  const { unmount, container } = render(<><InterfaceBehavior/><p>Texto público</p><input defaultValue="Editar"/><a href="/library">Biblioteca</a></>);
  const send = (element: Element, type: string) => { const event = new Event(type, { bubbles: true, cancelable: true }); element.dispatchEvent(event); return event.defaultPrevented; };
  for (const type of ["copy", "cut", "selectstart", "dragstart"]) {
    expect(send(container.querySelector("p")!, type)).toBe(true);
    expect(send(container.querySelector("input")!, type)).toBe(false);
  }
  expect(send(container.querySelector("a")!, "dragstart")).toBe(true);
  unmount();
  expect(send(document.body,"copy")).toBe(false);
});

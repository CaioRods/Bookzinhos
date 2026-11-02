// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useState } from "react";
import { Modal } from "./Ui";
afterEach(cleanup);
it("shows and focuses only the top modal and restores the underlying modal when closing", () => {
  function Stack() {
    const [top, setTop] = useState(true);
    return <><Modal open title="Cenários" onClose={() => {}}><p>Catálogo</p></Modal><Modal open={top} title="Recorte" onClose={() => setTop(false)}><button>Arrastar</button></Modal></>;
  }
  render(<Stack/>);
  expect(screen.queryByRole("dialog", {name:"Cenários"})).toBeNull();
  expect(screen.getByRole("dialog", {name:"Recorte"})).toBeTruthy();
  const layers = document.querySelectorAll<HTMLElement>(".mb-modal-layer");
  expect(layers[0].inert).toBe(true);
  expect(layers[0].style.visibility).toBe("hidden");
  fireEvent.keyDown(window, {key:"Escape"});
  expect(screen.queryByRole("dialog", {name:"Recorte"})).toBeNull();
  expect(screen.getByRole("dialog", {name:"Cenários"})).toBeTruthy();
  expect(layers[0].inert).toBe(false);
  expect(document.body.style.overflow).toBe("hidden");
  cleanup();
  expect(document.body.style.overflow).not.toBe("hidden");
});

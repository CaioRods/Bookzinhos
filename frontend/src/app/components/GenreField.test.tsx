// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GenreField } from "./GenreField";
afterEach(cleanup);
function Form({ initial = "Fantasia", submit = () => {} }: { initial?: string; submit?: () => void }) {
  const [value, setValue] = useState(initial);
  return <form onSubmit={event => { event.preventDefault(); submit(); }}><GenreField value={value} onChange={setValue} /><output>{value}</output></form>;
}
it("adds and removes genres independently when creating or editing a book", () => {
  render(<Form />);
  fireEvent.click(screen.getByRole("button", { name: "Romance" }));
  expect(screen.getByRole("button", { name: "Fantasia" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Romance" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Fantasia" }));
  expect(screen.getByRole("status")).toHaveTextContent("Romance");
  expect(screen.getByRole("button", { name: "Fantasia" })).toHaveAttribute("aria-pressed", "false");
});
it("restores multiple saved genres and adds a custom genre without submitting the form", () => {
  const submit = vi.fn(); render(<Form initial="Fantasia, Romance" submit={submit} />);
  expect(screen.getByRole("button", { name: "Romance" })).toHaveAttribute("aria-pressed", "true");
  const input = screen.getByRole("textbox", { name: "Outro gênero" });
  fireEvent.change(input, { target: { value: "Ficção climática" } }); fireEvent.keyDown(input, { key: "Enter" });
  expect(screen.getByRole("status")).toHaveTextContent("Fantasia, Romance, Ficção climática");
  expect(screen.getByRole("button", { name: "Ficção climática" })).toHaveAttribute("aria-pressed", "true");
  expect(submit).not.toHaveBeenCalled();
});

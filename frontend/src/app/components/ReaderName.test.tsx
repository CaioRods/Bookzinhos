// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReaderName, ReaderNamesProvider } from "./ReaderName";
import { saveSession } from "../lib/session";
vi.mock("../lib/api", () => ({ fetchAllUsers: vi.fn(async () => [{ username: "ana.antiga", displayName: "Nome no servidor" }, { username: "joao", displayName: "João Silva" }]) }));
beforeEach(() => localStorage.clear());
afterEach(cleanup);
it("updates existing post and review authors after an account name edit without changing their identity", async () => {
  saveSession({ username: "ana.antiga", displayName: "Ana" });
  render(<ReaderNamesProvider><p data-testid="post"><ReaderName username="ana.antiga"/></p><p><ReaderName username="joao"/></p></ReaderNamesProvider>);
  await screen.findByText("João Silva");
  expect(screen.getByTestId("post")).toHaveTextContent("Ana");
  act(() => saveSession({ username: "ana.antiga", displayName: "Ana Nova" }));
  await waitFor(() => expect(screen.getByTestId("post")).toHaveTextContent("Ana Nova"));
  expect(localStorage.getItem("books-username")).toBe("ana.antiga");
});

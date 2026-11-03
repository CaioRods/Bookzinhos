// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { BadgeGallery } from "./BadgeGallery";

afterEach(cleanup);
const badges = Array.from({ length: 5 }, (_, i) => ({ code: `badge-${i}`, name: `Selo ${i}`, description: `Conquista ${i}`, category: "reading", threshold: i, earnedAt: 1 }));

it("shows two badges, expands the remaining badges and collapses again", () => {
  render(<BadgeGallery badges={badges}/>);
  expect(screen.getAllByRole("article")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Ver mais 3 selos" }));
  expect(screen.getAllByRole("article")).toHaveLength(5);
  expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(screen.getByRole("button", { name: "Ver menos" }));
  expect(screen.getAllByRole("article")).toHaveLength(2);
});

it("does not show an expansion button when there are at most two badges", () => {
  render(<BadgeGallery badges={badges.slice(0, 2)}/>);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

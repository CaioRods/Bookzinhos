// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileProgressAvatar } from "./ProfileProgressAvatar";

describe("ProfileProgressAvatar", () => {
  it("shows circular progress, level and reader category beneath the avatar", () => {
    render(<ProfileProgressAvatar avatar="🐼" level={12} title="Aprendiz" totalXp={120} currentLevelXp={100} nextLevelXp={200} />);
    expect(screen.getByRole("progressbar", { name: /progresso para o nível 13/i })).toHaveAttribute("aria-valuenow", "20");
    expect(screen.getByText("Nível 12")).toBeInTheDocument();
    expect(screen.getByText("Aprendiz")).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { levelTier, ProfileProgressAvatar } from "./ProfileProgressAvatar";

describe("ProfileProgressAvatar", () => {
  it("shows circular progress, level and reader category beneath the avatar", () => {
    render(<ProfileProgressAvatar avatar="🐼" level={12} title="Aprendiz" totalXp={120} currentLevelXp={100} nextLevelXp={200} />);
    expect(screen.getByRole("progressbar", { name: /progresso para o nível 13/i })).toHaveAttribute("aria-valuenow", "20");
    expect(screen.getByText("12")).toHaveClass("mb-level-medallion");
    expect(screen.getByText("Aprendiz")).toBeInTheDocument();
  });

  it("maps level ranges to iron, bronze, gold, blue and diamond", () => {
    expect(levelTier(1)).toBe("iron");
    expect(levelTier(19)).toBe("iron");
    expect(levelTier(20)).toBe("bronze");
    expect(levelTier(40)).toBe("gold");
    expect(levelTier(60)).toBe("blue");
    expect(levelTier(80)).toBe("diamond");
    expect(levelTier(100)).toBe("diamond");
  });

  it("supports the compact header treatment without repeating the category", () => {
    const { container } = render(<ProfileProgressAvatar compact avatar="🐶" level={40} title="Leitor" totalXp={500} currentLevelXp={400} nextLevelXp={600} />);
    expect(container.querySelector(".mb-profile-progress-avatar--compact")).toBeInTheDocument();
    expect(screen.getByText("40")).toHaveClass("mb-level-medallion");
    expect(screen.queryByText("Leitor")).not.toBeInTheDocument();
  });

  it("does not expose another reader's xp percentage when totals are omitted", () => {
    const { container } = render(<ProfileProgressAvatar avatar="🐼" level={25} title="Explorador" />);
    expect(container.querySelector('[role="img"][aria-label="Nível público 25"]')).toBeInTheDocument();
    expect(container.querySelector('[role="progressbar"]')).not.toBeInTheDocument();
  });
});

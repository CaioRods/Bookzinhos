// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DonationCampaign, DONATION_INTERVAL } from "./DonationCampaign";

vi.mock("./SupportDonation", () => ({ SupportDonation: ({ onClose }: { onClose: () => void }) => <div role="dialog"><button onClick={onClose}>Fechar doação</button></div> }));
function App() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate("/read/1")}>Ler</button><button onClick={() => navigate("/")}>Início</button><button onClick={() => navigate("/donate")}>Causa</button><DonationCampaign /></>;
}
beforeEach(() => { vi.useFakeTimers(); Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe("DonationCampaign", () => {
  it("opens on entry, can close, and returns after 40 minutes", () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.queryByRole("dialog")).not.toBeNull();
    fireEvent.click(screen.getByText("Fechar doação"));
    act(() => { vi.advanceTimersByTime(DONATION_INTERVAL - 1); });
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByRole("dialog")).not.toBeNull();
  });
  it("defers an overdue reminder until leaving the reader", () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    fireEvent.click(screen.getByText("Fechar doação"));
    fireEvent.click(screen.getByText("Ler"));
    act(() => { vi.advanceTimersByTime(DONATION_INTERVAL * 2); });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByText("Início"));
    expect(screen.queryByRole("dialog")).not.toBeNull();
  });
  it("does not interrupt a direct reader entry or the donation page", () => {
    render(<MemoryRouter initialEntries={["/read/1"]}><App /></MemoryRouter>);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByText("Causa"));
    act(() => { vi.advanceTimersByTime(DONATION_INTERVAL); });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByText("Início"));
    expect(screen.queryByRole("dialog")).not.toBeNull();
  });
  it("waits for a hidden tab to become visible", () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.queryByRole("dialog")).toBeNull();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.queryByRole("dialog")).not.toBeNull();
  });
});

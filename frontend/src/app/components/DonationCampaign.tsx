import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { SupportDonation } from "./SupportDonation";

const HIDDEN_KEY = "mybooks:donation:hidden:v1";
const NEXT_ALLOWED_KEY = "mybooks:donation:next-allowed:v1";
export const DONATION_INTERVAL = 30 * 60 * 1000;
export const DONATION_SUPPORT = {
  pixKey: "baa03d59-5011-4ced-9d47-18a8949cff22",
  recipient: "Campanha myBooks em apoio ao GRAACC",
  message: "Queremos fazer a diferença, sem fins lucrativos. Sua contribuição voluntária ajuda nossa campanha em apoio a crianças e adolescentes com câncer atendidos pelo GRAACC.",
};
function nextAllowed() {
  try { const value = Number(localStorage.getItem(NEXT_ALLOWED_KEY)); return Number.isFinite(value) && value > 0 ? value : 0; } catch { return 0; }
}
function isHidden() {
  try { return localStorage.getItem(HIDDEN_KEY) === "1"; } catch { return false; }
}
export function DonationCampaign() {
  const { pathname } = useLocation();
  const blocked = pathname.startsWith("/read/") || pathname === "/donate";
  const [hidden, setHidden] = useState(isHidden);
  const [open, setOpen] = useState(false);
  const nextAt = useRef(nextAllowed());
  const postpone = useCallback(() => {
    nextAt.current = Date.now() + DONATION_INTERVAL;
    try { localStorage.setItem(NEXT_ALLOWED_KEY, String(nextAt.current)); } catch { /* Vale nesta sessão quando o armazenamento está indisponível. */ }
  }, []);
  const dismiss = useCallback(() => { postpone(); setOpen(false); }, [postpone]);
  useEffect(() => {
    if (blocked || hidden) { setOpen(false); return; }
    const check = () => {
      if (open || document.visibilityState === "hidden" || isHidden()) return;
      nextAt.current = Math.max(nextAt.current, nextAllowed());
      if (Date.now() < nextAt.current) return;
      postpone();
      setOpen(true);
    };
    // Expiring the cooldown only makes the campaign eligible. There is no timer
    // interrupting the current screen; navigation or returning to the tab checks it.
    check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, [blocked, hidden, pathname, open, postpone]);
  const neverShow = () => {
    try { localStorage.setItem(HIDDEN_KEY, "1"); } catch { /* A preferência ainda vale nesta sessão. */ }
    setHidden(true);
    setOpen(false);
  };
  return !blocked && !hidden && open ? <SupportDonation support={DONATION_SUPPORT} onClose={dismiss} onNeverShow={neverShow} /> : null;
}

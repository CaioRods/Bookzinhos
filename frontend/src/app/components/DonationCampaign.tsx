import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { SupportDonation } from "./SupportDonation";

export const DONATION_INTERVAL = 40 * 60 * 1000;
export const DONATION_SUPPORT = {
  pixKey: "38301542837",
  recipient: "Campanha myBooks em apoio ao GRAACC",
  message: "Queremos fazer a diferença, sem fins lucrativos. Sua contribuição voluntária ajuda nossa campanha em apoio a crianças e adolescentes com câncer atendidos pelo GRAACC.",
};

export function DonationCampaign() {
  const { pathname } = useLocation();
  const blocked = pathname.startsWith("/read/") || pathname === "/donate";
  const [open, setOpen] = useState(false);
  const nextAt = useRef(0);
  const dismiss = useCallback(() => {
    nextAt.current = Date.now() + DONATION_INTERVAL;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (blocked) return;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      clearTimeout(timer);
      if (document.visibilityState === "hidden") return;
      const remaining = nextAt.current - Date.now();
      if (remaining <= 0) {
        nextAt.current = Date.now() + DONATION_INTERVAL;
        setOpen(true);
      } else {
        timer = setTimeout(check, remaining);
      }
    };
    check();
    document.addEventListener("visibilitychange", check);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [blocked, pathname, open]);

  return !blocked && open ? <SupportDonation support={DONATION_SUPPORT} onClose={dismiss} /> : null;
}

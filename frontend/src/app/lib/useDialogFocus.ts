import { type RefObject, useEffect } from "react";

const FOCUSABLE = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function useDialogFocus(
  dialog: RefObject<HTMLElement | null>,
  options: { initialFocus?: RefObject<HTMLElement | null>; onClose?: () => void; inertRoot?: boolean } = {},
) {
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.getElementById("root") as (HTMLElement & { inert: boolean }) | null;
    const wasInert = root?.inert;
    if (options.inertRoot && root) root.inert = true;
    requestAnimationFrame(() => (options.initialFocus?.current || dialog.current)?.focus());

    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && options.onClose) { event.preventDefault(); options.onClose(); return; }
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!focusable.length) { event.preventDefault(); dialog.current.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      if (options.inertRoot && root) root.inert = Boolean(wasInert);
      previous?.focus();
    };
  }, [dialog, options.initialFocus, options.inertRoot, options.onClose]);
}

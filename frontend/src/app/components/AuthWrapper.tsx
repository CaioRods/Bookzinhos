import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet } from "react-router";
import { Login } from "../pages/Login";
import { BookOpening } from "./BookOpening";
import { completeOpening, needsOpening } from "../lib/opening";
import { getUsername, isGuest, enterGuestMode } from "../lib/session";
import { clearSession, saveSession } from "../lib/session";
import { getAuthenticatedSession } from "../lib/api";

export function AuthWrapper() {
  const [user, setUser] = useState<string | null>(null);
  const [guest, setGuest] = useState<boolean>(isGuest);
  const [restoring, setRestoring] = useState(true);
  const [openingFor, setOpeningFor] = useState<string | null>(() => {
    const username = getUsername();
    return needsOpening(username) ? username : null;
  });
  const previousUser = useRef(user);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    getAuthenticatedSession()
      .then((profile) => {
        if (!active) return;
        if (profile) saveSession(profile);
        else if (!isGuest()) clearSession();
      })
      .catch(() => { /* falha temporária: mantém a entrada disponível */ })
      .finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const sync = () => {
      const username = getUsername();
      if (username && username !== previousUser.current)
        setOpeningFor(username);
      if (!username) setOpeningFor(null);
      previousUser.current = username;
      setUser(username);
      setGuest(isGuest());
    };
    sync();
    window.addEventListener("mybooks:session", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("mybooks:session", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const element = content.current;
    if (!element) return;
    element.inert = !!openingFor;
    return () => {
      element.inert = false;
    };
  }, [openingFor, user, guest]);

  const finishOpening = useCallback(() => {
    if (openingFor) completeOpening(openingFor);
    setOpeningFor(null);
  }, [openingFor]);

  if (restoring) return <div className="mb-auth-restoring" role="status" aria-label="Restaurando sessão" />;

  if (user || guest)
    return (
      <>
        <div
          ref={content}
          className="mb-authenticated-app"
          aria-hidden={openingFor ? true : undefined}
        >
          <Outlet />
        </div>
        {user && openingFor && (
          <BookOpening key={openingFor} onComplete={finishOpening} />
        )}
      </>
    );

  return (
    <Login
      onLoginSuccess={(username) => {
        previousUser.current = username;
        setUser(username);
        setGuest(false);
        setOpeningFor(username);
      }}
      onGuest={() => {
        enterGuestMode();
        setGuest(true);
      }}
    />
  );
}

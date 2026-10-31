import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet } from "react-router";
import { Login } from "../pages/Login";
import { BookOpening } from "./BookOpening";
import { completeOpening, needsOpening } from "../lib/opening";
import { getUsername, isGuest, enterGuestMode } from "../lib/session";
import { clearSession, saveSession } from "../lib/session";
import { getAuthenticatedSession } from "../lib/api";
import { PrivacyConsent } from "./PrivacyConsent";

export function AuthWrapper() {
  const [user, setUser] = useState<string | null>(null);
  const [guest, setGuest] = useState<boolean>(isGuest);
  const [restoring, setRestoring] = useState(true);
  const [privacyPending, setPrivacyPending] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const [openingFor, setOpeningFor] = useState<string | null>(() => {
    const username = getUsername();
    return needsOpening(username) ? username : null;
  });
  const previousUser = useRef(user);
  const content = useRef<HTMLDivElement>(null);

  const restoreSession = useCallback(async () => {
    setRestoring(true);
    setRestoreError("");
    try {
      const profile = await getAuthenticatedSession();
      if (profile) {
        saveSession(profile);
        setPrivacyPending(profile.privacyRequired === true);
        setUser(profile.username);
      } else if (!isGuest()) {
        clearSession();
        setUser(null);
        setPrivacyPending(false);
      }
      setRestoring(false);
      return profile;
    } catch {
      setRestoreError("Não foi possível confirmar sua sessão com segurança.");
      setRestoring(false);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    getAuthenticatedSession()
      .then((profile) => {
        if (!active) return;
        if (profile) {
          saveSession(profile);
          setPrivacyPending(profile.privacyRequired === true);
          setUser(profile.username);
        } else if (!isGuest()) {
          clearSession();
          setPrivacyPending(false);
        }
        setRestoring(false);
      })
      .catch(() => {
        if (!active) return;
        setRestoreError("Não foi possível confirmar sua sessão com segurança.");
        setRestoring(false);
      });
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
    const blocked = !!openingFor || (!!user && privacyPending);
    element.inert = blocked;
    return () => {
      element.inert = false;
    };
  }, [openingFor, user, guest, privacyPending]);

  const finishOpening = useCallback(() => {
    if (openingFor) completeOpening(openingFor);
    setOpeningFor(null);
  }, [openingFor]);

  if (restoring) return <div className="mb-auth-restoring" role="status" aria-label="Restaurando sessão" />;

  if (restoreError) return <main className="mb-auth-session-error"><h1>Sessão não confirmada</h1><p>{restoreError}</p><button className="mb-btn mb-btn-primary" onClick={restoreSession}>Tentar novamente</button></main>;

  const privacyRequired = !!user && privacyPending;

  if (user || guest)
    return (
      <>
        <div
          ref={content}
          className="mb-authenticated-app"
          aria-hidden={openingFor || privacyRequired ? true : undefined}
        >
          <Outlet />
        </div>
        {user && openingFor && !privacyRequired && (
          <BookOpening key={openingFor} onComplete={finishOpening} />
        )}
        {privacyRequired && <PrivacyConsent onAccepted={() => setPrivacyPending(false)} />}
      </>
    );

  return (
    <Login
      onLoginSuccess={async (username) => {
        previousUser.current = username;
        setGuest(false);
        const profile = await restoreSession();
        if (profile) setOpeningFor(username);
      }}
      onGuest={() => {
        enterGuestMode();
        setGuest(true);
      }}
    />
  );
}

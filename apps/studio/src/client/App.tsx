import { useEffect, useState } from "react";
import type { RelationSummary, StudioSession } from "../shared/types";
import { loadSession, studioApi } from "./api";
import { DataExplorer } from "./components/DataExplorer";
import { QueryWorkspace } from "./components/QueryWorkspace";
import { StatusNotice } from "./components/StatusNotice";

type Screen = "data" | "query";

export default function App() {
  const [screen, setScreen] = useState<Screen>("data");
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState<StudioSession | null>(null);
  const [relations, setRelations] = useState<RelationSummary[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([loadSession(), studioApi.relations()])
      .then(([nextSession, nextRelations]) => {
        setSession(nextSession);
        setRelations(nextRelations);
      })
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : "Studio could not start",
        ),
      );
  }, []);

  if (error)
    return (
      <main className="centered-state">
        <StatusNotice title="Studio is locked" tone="danger">
          {error}. Return to the terminal and launch Studio again.
        </StatusNotice>
      </main>
    );
  if (!session)
    return (
      <main className="centered-state">
        <div className="loading-mark" />
        <p>Opening ZeroDrive Studio…</p>
      </main>
    );

  const navigateTo = (nextScreen: Screen) => {
    setScreen(nextScreen);
    setMenuOpen(false);
  };

  const navigation = (["data", "query"] as Screen[]).map((item) => ({
    id: item,
    label: item === "data" ? "Data explorer" : "SQL workspace",
  }));

  const studioLogo = new URL(
    "../../assets/zerodrive-studio-logo.png",
    import.meta.url,
  ).href;

  return (
    <div className="studio-shell">
      <header className="topbar">
        <button
          className="brand"
          aria-label="ZeroDrive Studio"
          onClick={() => navigateTo("data")}
        >
          <span className="brand-logo-frame">
            <img
              className="brand-logo"
              src={studioLogo}
              alt=""
              aria-hidden="true"
            />
          </span>
          <strong>ZeroDrive Studio</strong>
        </button>

        <div className="desktop-header-actions">
          <nav className="header-nav" aria-label="Studio navigation">
            {navigation.map((item) => (
              <button
                key={item.id}
                className={
                  screen === item.id
                    ? "header-nav-link header-nav-link--active"
                    : "header-nav-link"
                }
                onClick={() => navigateTo(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <span className="header-divider" aria-hidden="true" />
          <div className="topbar-status">
            <span className={`profile-pill profile-pill--${session.profile}`}>
              {session.profile}
            </span>
            <span className="connection-state">PostgreSQL connected</span>
          </div>
        </div>

        <div className="mobile-header-actions">
          <span className={`profile-pill profile-pill--${session.profile}`}>
            {session.profile}
          </span>
          <button
            className="menu-trigger"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="studio-mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            Menu
          </button>
          {menuOpen && (
            <div className="mobile-menu" id="studio-mobile-menu">
              <nav aria-label="Mobile Studio navigation">
                {navigation.map((item) => (
                  <button
                    key={item.id}
                    className={
                      screen === item.id
                        ? "mobile-menu-link mobile-menu-link--active"
                        : "mobile-menu-link"
                    }
                    onClick={() => navigateTo(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
              <div className="mobile-menu-status">
                <span className="connection-state">PostgreSQL connected</span>
                <span>
                  {session.readOnly ? "Read only" : "Local writes enabled"}
                </span>
              </div>
            </div>
          )}
        </div>
      </header>
      <main
        className={
          screen === "data" ? "studio-main studio-main--wide" : "studio-main"
        }
      >
        {screen === "data" && (
          <DataExplorer relations={relations} profile={session.profile} />
        )}
        {screen === "query" && <QueryWorkspace profile={session.profile} />}
      </main>
      <footer className="studio-footer">
        <span>Local operator tool</span>
        <span>Credentials never enter the browser</span>
      </footer>
    </div>
  );
}

import { useEffect, useState } from "react";
import type {
  ConnectionOverview,
  RelationSummary,
  StudioSession,
} from "../shared/types";
import { loadSession, studioApi } from "./api";
import { DataExplorer } from "./components/DataExplorer";
import { Overview } from "./components/Overview";
import { QueryWorkspace } from "./components/QueryWorkspace";
import { StatusNotice } from "./components/StatusNotice";

type Screen = "overview" | "data" | "query";

export default function App() {
  const [screen, setScreen] = useState<Screen>("overview");
  const [session, setSession] = useState<StudioSession | null>(null);
  const [overview, setOverview] = useState<ConnectionOverview | null>(null);
  const [relations, setRelations] = useState<RelationSummary[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([loadSession(), studioApi.overview(), studioApi.relations()])
      .then(([nextSession, nextOverview, nextRelations]) => {
        setSession(nextSession);
        setOverview(nextOverview);
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
  if (!session || !overview)
    return (
      <main className="centered-state">
        <div className="loading-mark" />
        <p>Opening ZeroDrive Studio…</p>
      </main>
    );

  return (
    <div className="studio-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setScreen("overview")}>
          <span>ZD</span>
          <strong>ZeroDrive Studio</strong>
        </button>
        <div className="topbar-status">
          <span className={`profile-pill profile-pill--${session.profile}`}>
            {session.profile}
          </span>
          <span className="connection-state">PostgreSQL connected</span>
        </div>
      </header>
      <nav className="primary-nav" aria-label="Studio navigation">
        {(["overview", "data", "query"] as Screen[]).map((item) => (
          <button
            key={item}
            className={
              screen === item ? "nav-link nav-link--active" : "nav-link"
            }
            onClick={() => setScreen(item)}
          >
            {item === "data"
              ? "Data explorer"
              : item === "query"
                ? "SQL workspace"
                : "Overview"}
          </button>
        ))}
      </nav>
      <main
        className={
          screen === "data" ? "studio-main studio-main--wide" : "studio-main"
        }
      >
        {screen === "overview" && <Overview overview={overview} />}
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

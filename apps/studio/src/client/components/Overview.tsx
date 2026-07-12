import type { ConnectionOverview } from "../../shared/types";

export function Overview({ overview }: { overview: ConnectionOverview }) {
  const metrics = [
    ["Tables", overview.tableCount],
    ["Views", overview.viewCount],
    ["Migrations", overview.migrationCount],
    ["Latency", `${overview.latencyMs} ms`],
  ];
  return (
    <section className="page-stack" aria-labelledby="overview-title">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Connection overview</p>
          <h1 id="overview-title">Your database, without the guesswork.</h1>
          <p>
            Inspect the current ZeroDrive database and migration state.
            Credentials remain inside this localhost process.
          </p>
        </div>
        <span className={`profile-pill profile-pill--${overview.profile}`}>
          {overview.profile} ·{" "}
          {overview.readOnly ? "read only" : "write enabled"}
        </span>
      </header>

      <div className="metric-grid">
        {metrics.map(([label, value]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>

      <article className="detail-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Active connection</p>
            <h2>{overview.database}</h2>
          </div>
          <span className="health-dot">Connected</span>
        </div>
        <dl className="definition-grid">
          <div>
            <dt>PostgreSQL role</dt>
            <dd>{overview.user}</dd>
          </div>
          <div>
            <dt>Server</dt>
            <dd>{overview.version}</dd>
          </div>
          <div>
            <dt>Latest migration</dt>
            <dd>{overview.latestMigration || "No recorded migrations"}</dd>
          </div>
          <div>
            <dt>Safety mode</dt>
            <dd>
              {overview.readOnly
                ? "Database-enforced read only"
                : "Local development writes"}
            </dd>
          </div>
        </dl>
      </article>
    </section>
  );
}

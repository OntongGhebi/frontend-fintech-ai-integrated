import { getApiBaseUrl } from "../lib/api-client";

export function DashboardPage() {
  return (
    <section className="dashboard-page">
      <div className="welcome-section">
        <span className="eyebrow">OVERVIEW</span>
        <h2>Your financial overview</h2>
        <p>
          Manage your accounts, transactions, budgets, and financial insights
          from one workspace.
        </p>
      </div>

      <div className="foundation-grid">
        <article className="foundation-card">
          <span className="card-number">01</span>
          <h3>Accounts</h3>
          <p>Your account balances and transfers will be connected here.</p>
          <span className="feature-status">Planned</span>
        </article>

        <article className="foundation-card">
          <span className="card-number">02</span>
          <h3>Transactions</h3>
          <p>Income and expense records will be managed in this workspace.</p>
          <span className="feature-status">Planned</span>
        </article>

        <article className="foundation-card">
          <span className="card-number">03</span>
          <h3>Budgets</h3>
          <p>Budget tracking and alerts will be added in a later phase.</p>
          <span className="feature-status">Planned</span>
        </article>
      </div>

      <div className="integration-note">
        <div>
          <strong>API configuration</strong>
          <p>
            The frontend API client is configured for the local backend. A
            successful connection has not yet been verified.
          </p>
        </div>

        <code>{getApiBaseUrl()}</code>
      </div>
    </section>
  );
}

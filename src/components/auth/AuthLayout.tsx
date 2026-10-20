import type { ReactNode } from "react";
import "./AuthLayout.css";

interface AuthLayoutProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({
  eyebrow,
  title,
  description,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <main className="auth-v2-screen">
      <section className="auth-v2-shell">
        <aside className="auth-v2-showcase">
          <a
            href="/login"
            className="auth-v2-brand"
            aria-label="Fintech AI home"
          >
            <span className="auth-v2-brand-icon" aria-hidden="true">
              F
            </span>
            <span>Fintech AI</span>
          </a>

          <div className="auth-v2-showcase-copy">
            <span className="auth-v2-kicker">YOUR FINANCIAL WORKSPACE</span>

            <h2>
              Make your money
              <br />
              <span>work smarter.</span>
            </h2>

            <p>
              Pantau pemasukan, kelola pengeluaran, dan rencanakan masa depan
              keuanganmu dalam satu workspace.
            </p>
          </div>

          <div
            className="auth-v2-preview"
            aria-label="Ilustrasi dashboard keuangan"
          >
            <div className="auth-v2-preview-top">
              <div>
                <span className="auth-v2-preview-label">TOTAL BALANCE</span>
                <strong className="auth-v2-preview-balance">
                  IDR <span>••••••</span>
                </strong>
              </div>

              <span className="auth-v2-preview-icon" aria-hidden="true">
                ↗
              </span>
            </div>

            <div className="auth-v2-preview-divider" />

            <div className="auth-v2-chart-heading">
              <span>Financial activity</span>
              <span>Overview</span>
            </div>

            <div className="auth-v2-chart" aria-hidden="true">
              <span style={{ height: "34%" }} />
              <span style={{ height: "48%" }} />
              <span style={{ height: "39%" }} />
              <span style={{ height: "62%" }} />
              <span style={{ height: "50%" }} />
              <span style={{ height: "75%" }} />
              <span style={{ height: "57%" }} />
              <span style={{ height: "88%" }} />
              <span style={{ height: "68%" }} />
              <span style={{ height: "96%" }} />
              <span style={{ height: "72%" }} />
              <span style={{ height: "83%" }} />
            </div>

            <div className="auth-v2-chart-months" aria-hidden="true">
              <span>JAN</span>
              <span>MAR</span>
              <span>MAY</span>
              <span>JUL</span>
              <span>SEP</span>
              <span>DEC</span>
            </div>

            <div className="auth-v2-preview-bottom">
              <div className="auth-v2-legend">
                <span className="auth-v2-legend-dot auth-v2-dot-green" />
                Income
              </div>
              <div className="auth-v2-legend">
                <span className="auth-v2-legend-dot auth-v2-dot-lime" />
                Expenses
              </div>
              <span className="auth-v2-preview-note">Illustration</span>
            </div>
          </div>

          <div className="auth-v2-showcase-bottom">
            <span>Personal finance, made clearer.</span>
            <span className="auth-v2-showcase-indicator">
              <span />
              Your financial journey starts here
            </span>
          </div>
        </aside>

        <section className="auth-v2-content">
          <div className="auth-v2-mobile-brand">
            <span className="auth-v2-brand-icon" aria-hidden="true">
              F
            </span>
            <span>Fintech AI</span>
          </div>

          <div className="auth-v2-form-container">
            <header className="auth-v2-heading">
              <span className="auth-v2-kicker">{eyebrow}</span>
              <h1>{title}</h1>
              <p>{description}</p>
            </header>

            <div className="auth-v2-form-content">{children}</div>

            {footer && <div className="auth-v2-footer">{footer}</div>}
          </div>

          <div className="auth-v2-content-bottom">
            <span>Fintech AI</span>
            <span>Personal Finance Workspace</span>
          </div>
        </section>
      </section>
    </main>
  );
}

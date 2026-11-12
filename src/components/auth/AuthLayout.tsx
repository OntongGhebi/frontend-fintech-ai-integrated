import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "./AuthLayout.css";

interface AuthLayoutProps {
  mode?: "login" | "register";
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({
  mode = "login",
  eyebrow,
  title,
  description,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <main className="auth-v2-screen">
      <section className={`auth-v2-shell auth-v2-shell--${mode}`}>
        <aside className="auth-v2-showcase">
          <Link
            to="/login"
            viewTransition
            className="auth-v2-brand"
            aria-label="Nalara — halaman masuk"
          >
            <span className="auth-v2-brand-icon" aria-hidden="true">
              N
            </span>
            <span>Nalara</span>
          </Link>

          <div className="auth-v2-showcase-copy">
            <span className="auth-v2-kicker">RUANG KEUANGANMU</span>

            <h2>
              Pahami arus uangmu
              <br />
              <span>dengan Nalara.</span>
            </h2>

            <p>
              Kelola pemasukan, pengeluaran, dan rencanakan langkah finansial
              berikutnya dalam satu tempat.
            </p>
          </div>
        </aside>

        <section className="auth-v2-content">
          <div className="auth-v2-form-container">
            <div className="auth-v2-mobile-brand">
              <span className="auth-v2-brand-icon" aria-hidden="true">
                N
              </span>
              <span>Nalara</span>
            </div>

            <header className="auth-v2-heading">
              <span className="auth-v2-kicker">{eyebrow}</span>
              <h1>{title}</h1>
              <p>{description}</p>
            </header>

            <div className="auth-v2-form-content">{children}</div>

            {footer && <div className="auth-v2-footer">{footer}</div>}
          </div>
        </section>
      </section>
    </main>
  );
}

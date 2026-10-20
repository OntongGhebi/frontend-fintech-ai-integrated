import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../../contexts/AuthContext";

const navigation = [{ label: "Dashboard", icon: "▦", to: "/" }];

const upcomingFeatures = [
  "Analytics",
  "Transactions",
  "Accounts",
  "Budgets",
  "Recurring",
  "Notifications",
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  async function handleLogout() {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    setLogoutError("");

    try {
      await logout();
      navigate("/login", { replace: true });
    } catch {
      setLogoutError("Logout mengalami kendala. Silakan coba kembali.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  const displayName = user?.name?.trim() || "Pengguna";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand" aria-label="Fintech AI dashboard">
          <span className="brand-mark" aria-hidden="true">
            F
          </span>

          <span className="brand-copy">
            <strong>Fintech AI</strong>
            <span>Personal Finance</span>
          </span>
        </NavLink>

        <div className="sidebar-search-placeholder">
          <span aria-hidden="true">⌕</span>
          <span>Financial workspace</span>
        </div>

        <nav aria-label="Navigasi utama" className="navigation">
          <span className="navigation-heading">MENU</span>

          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `navigation-link${isActive ? " active" : ""}`
              }
            >
              <span className="navigation-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}

          <span className="navigation-heading navigation-heading-spaced">
            YOUR FINANCES
          </span>

          {upcomingFeatures.map((feature) => (
            <div
              key={feature}
              className="navigation-link navigation-link-disabled"
              aria-disabled="true"
              title={`${feature} belum tersedia`}
            >
              <span className="navigation-icon" aria-hidden="true">
                ·
              </span>
              <span>{feature}</span>
              <span className="navigation-soon">Soon</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <span className="status-dot" />
            <span>Workspace aktif</span>
          </div>

          <div className="sidebar-user">
            <div className="user-avatar" aria-hidden="true">
              {initial}
            </div>

            <div className="sidebar-user-info">
              <strong title={displayName}>{displayName}</strong>
              <span title={user?.email}>{user?.email || "Akun pengguna"}</span>
            </div>

            <button
              type="button"
              className="logout-button"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              aria-label="Logout"
              title="Logout"
            >
              {isLoggingOut ? "…" : "↗"}
            </button>
          </div>

          {logoutError && (
            <p className="sidebar-error" role="alert">
              {logoutError}
            </p>
          )}
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-title">
            <span className="eyebrow">PERSONAL FINANCE</span>
            <h1>Dashboard</h1>
            <p>Track, assess, and enhance your financial performance.</p>
          </div>

          <div className="topbar-actions">
            <span className="topbar-date">
              <span className="topbar-date-dot" />
              IDR · Asia/Jakarta
            </span>

            <div className="topbar-profile">
              <div className="user-avatar user-avatar-small" aria-hidden="true">
                {initial}
              </div>

              <div className="topbar-profile-copy">
                <strong>{displayName}</strong>
                <span>{user?.email}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>

        <footer className="app-footer">
          <span>Fintech AI</span>
          <span>Personal finance workspace · IDR</span>
        </footer>
      </div>
    </div>
  );
}

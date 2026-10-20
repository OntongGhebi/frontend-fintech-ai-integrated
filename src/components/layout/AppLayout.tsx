import { NavLink, Outlet } from "react-router-dom";

const navigation = [{ label: "Dashboard", to: "/" }];

export function AppLayout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">F</div>
          <div>
            <strong>Fintech AI</strong>
            <span>Personal Finance</span>
          </div>
        </div>

        <nav aria-label="Main navigation" className="navigation">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `navigation-link${isActive ? " active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" />
          Frontend foundation
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div>
            <span className="eyebrow">PERSONAL FINANCE</span>
            <h1>Financial workspace</h1>
          </div>
          <span className="environment-label">Development</span>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

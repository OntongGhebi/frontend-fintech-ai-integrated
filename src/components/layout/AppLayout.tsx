import { useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowLeftRight,
  Bell,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Crown,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Repeat,
  Tags,
  Wallet,
  X,
  PiggyBank,
  Workflow,
} from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { GlobalSearch } from "./GlobalSearch";
import "./AppLayout.css";
import "./AppLayout.subscription.css";

const primaryNavigation = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    to: "/",
    end: true,
  },
];

const financeNavigation = [
  { label: "Accounts", icon: Wallet, to: "/accounts" },
  { label: "Categories", icon: Tags, to: "/categories" },
];

const financeOperationsNavigation = [
  { label: "Transactions", icon: HandCoins, to: "/transactions" },
  { label: "Budgets", icon: PiggyBank, to: "/budgets" },
  {
    label: "Recurring",
    icon: Repeat,
    to: "/recurring-transactions",
  },
];

const insightNavigation = [
  {
    label: "Reports & Analytics",
    icon: ChartNoAxesCombined,
    to: "/reports",
  },
];

const workspaceNavigation = [
  { label: "Subscription", icon: CreditCard, to: "/subscription" },
  { label: "Payments", icon: ReceiptText, to: "/payments" },
  { label: "Integrations", icon: Workflow, to: "/integrations" },
];

function getPageHeading(pathname: string) {
  if (pathname === "/transactions/new") {
    return {
      title: "Tambah transaksi",
      description: "Catat pemasukan atau pengeluaran keuanganmu.",
    };
  }

  if (pathname === "/transactions/transfer") {
    return {
      title: "Transfer dana",
      description: "Pindahkan dana antar akun keuanganmu.",
    };
  }

  if (pathname.startsWith("/transactions/") && pathname.endsWith("/edit")) {
    return {
      title: "Edit transaksi",
      description: "Perbarui informasi transaksi yang tercatat.",
    };
  }

  if (pathname.startsWith("/transactions/")) {
    return {
      title: "Detail transaksi",
      description: "Lihat informasi dan aktivitas transaksi.",
    };
  }

  if (pathname === "/transactions") {
    return {
      title: "Transactions",
      description: "Kelola pemasukan, pengeluaran, dan perpindahan dana.",
    };
  }

  if (pathname === "/notifications") {
    return {
      title: "Notifications",
      description: "Pantau pembaruan penting dan aktivitas akun Anda.",
    };
  }

  if (pathname === "/accounts") {
    return {
      title: "Accounts",
      description: "Kelola rekening dan sumber dana keuanganmu.",
    };
  }

  if (pathname.startsWith("/accounts/")) {
    return {
      title: "Detail akun",
      description: "Lihat saldo dan informasi akun keuanganmu.",
    };
  }

  if (pathname === "/budgets") {
    return {
      title: "Budgets",
      description: "Kelola batas pengeluaran dan pantau pemakaian anggaran.",
    };
  }

  if (pathname === "/reports") {
    return {
      title: "Reports & Analytics",
      description: "Analisis pemasukan, pengeluaran, dan performa keuangan.",
    };
  }

  if (pathname === "/categories") {
    return {
      title: "Categories",
      description: "Kelola kategori pemasukan dan pengeluaran transaksi.",
    };
  }

  if (pathname === "/plans") {
    return {
      title: "Pilih Paket",
      description:
        "Pilih paket yang sesuai dengan kebutuhan pengelolaan keuanganmu.",
    };
  }

  if (pathname === "/subscription") {
    return {
      title: "Subscription",
      description:
        "Pantau paket aktif, masa langganan, dan riwayat aktivitas akunmu.",
    };
  }

  if (pathname === "/payments") {
    return {
      title: "Payments",
      description: "Lihat riwayat pembayaran dan status pembayaran.",
    };
  }

  if (pathname === "/integrations") {
    return {
      title: "Integrations",
      description: "Kelola integrasi Telegram dan AI Assistant.",
    };
  }

  if (pathname === "/settings") {
    return {
      title: "Settings",
      description: "Kelola profil, preferensi, dan keamanan akun Anda.",
    };
  }

  if (
    pathname === "/recurring-transactions" ||
    pathname.startsWith("/recurring-transactions/")
  ) {
    return {
      title: "Recurring Transactions",
      description: "Kelola transaksi terjadwal untuk kebutuhan rutin.",
    };
  }

  return {
    title: "Dashboard",
    description: "Pantau dan evaluasi performa keuanganmu.",
  };
}

interface NavigationItem {
  label: string;
  icon: typeof LayoutDashboard;
  to: string;
  end?: boolean;
}

interface NavigationGroupProps {
  title: string;
  items: NavigationItem[];
  onNavigate: () => void;
}

function NavigationGroup({ title, items, onNavigate }: NavigationGroupProps) {
  return (
    <section className="layout-nav-group" aria-label={title}>
      <span className="layout-nav-heading">{title}</span>

      <div className="layout-nav-items">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end ?? false}
              className={({ isActive }) =>
                `layout-nav-link${isActive ? " is-active" : ""}`
              }
              onClick={onNavigate}
            >
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </section>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [mobileNavState, setMobileNavState] = useState({
    pathname: location.pathname,
    isOpen: false,
  });

  const [financeState, setFinanceState] = useState(() => ({
    pathname: location.pathname,
    isOpen: financeOperationsNavigation.some((item) =>
      location.pathname.startsWith(item.to),
    ),
  }));

  const [workspaceState, setWorkspaceState] = useState(() => ({
    pathname: location.pathname,
    isOpen: workspaceNavigation.some((item) =>
      location.pathname.startsWith(item.to),
    ),
  }));

  const [logoutError, setLogoutError] = useState("");

  const isFinanceOpen =
    financeState.pathname === location.pathname
      ? financeState.isOpen
      : financeOperationsNavigation.some((item) =>
          location.pathname.startsWith(item.to),
        );

  const isWorkspaceOpen =
    workspaceState.pathname === location.pathname
      ? workspaceState.isOpen
      : workspaceNavigation.some((item) =>
          location.pathname.startsWith(item.to),
        );

  const isMobileNavOpen =
    mobileNavState.pathname === location.pathname && mobileNavState.isOpen;

  const setIsMobileNavOpen = (
    next: boolean | ((isOpen: boolean) => boolean),
  ) => {
    setMobileNavState((current) => ({
      pathname: location.pathname,
      isOpen:
        typeof next === "function"
          ? next(current.pathname === location.pathname && current.isOpen)
          : next,
    }));
  };

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
  const pageHeading = getPageHeading(location.pathname);

  const showTransactionActions =
    location.pathname === "/" || location.pathname === "/transactions";

  const financeIsActive = financeOperationsNavigation.some((item) =>
    location.pathname.startsWith(item.to),
  );

  const workspaceIsActive = workspaceNavigation.some((item) =>
    location.pathname.startsWith(item.to),
  );

  const closeMobileNavigation = () => {
    setIsMobileNavOpen(false);
  };

  return (
    <div className="app-shell">
      {isMobileNavOpen && (
        <button
          type="button"
          className="layout-mobile-backdrop"
          aria-label="Tutup navigasi"
          onClick={closeMobileNavigation}
        />
      )}

      <aside
        className={`layout-sidebar${isMobileNavOpen ? " is-mobile-open" : ""}`}
      >
        <div className="layout-sidebar-mobile-heading">
          <span>NAVIGATION</span>

          <button
            type="button"
            className="layout-icon-button"
            aria-label="Tutup navigasi"
            onClick={closeMobileNavigation}
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <div className="layout-brand-row">
          <NavLink
            to="/"
            className="layout-brand"
            aria-label="Fintech AI dashboard"
            onClick={closeMobileNavigation}
          >
            <span className="layout-brand-mark" aria-hidden="true">
              F
            </span>

            <span className="layout-brand-copy">
              <strong>Fintech AI</strong>
              <span>Personal Finance</span>
            </span>
          </NavLink>
          <NavLink
            to="/plans"
            className={({ isActive }) =>
              `layout-brand-plan-link${isActive ? " is-active" : ""}`
            }
            aria-label="Lihat pilihan paket subscription"
            title="Paket & harga"
            onClick={closeMobileNavigation}
          >
            <Crown size={19} strokeWidth={1.9} aria-hidden="true" />
          </NavLink>
        </div>

        <div className="layout-sidebar-caption">
          <span className="layout-caption-dot" />
          <span>Personal workspace</span>
        </div>

        {/* Global search */}
        <div className="sidebar-search-container">
          <GlobalSearch onNavigate={closeMobileNavigation} />
        </div>

        <nav className="layout-navigation" aria-label="Navigasi utama">
          <NavigationGroup
            title="OVERVIEW"
            items={primaryNavigation}
            onNavigate={closeMobileNavigation}
          />

          <NavigationGroup
            title="MANAGE"
            items={financeNavigation}
            onNavigate={closeMobileNavigation}
          />

          <section className="layout-nav-group" aria-label="Finance">
            <button
              type="button"
              className={`layout-nav-group-toggle${
                financeIsActive ? " is-active" : ""
              }`}
              aria-expanded={isFinanceOpen}
              onClick={() =>
                setFinanceState({
                  pathname: location.pathname,
                  isOpen: !isFinanceOpen,
                })
              }
            >
              <span className="layout-nav-group-toggle-label">
                <HandCoins size={18} strokeWidth={1.8} aria-hidden="true" />
                <span>FINANCE</span>
              </span>

              {isFinanceOpen ? (
                <ChevronDown size={16} aria-hidden="true" />
              ) : (
                <ChevronRight size={16} aria-hidden="true" />
              )}
            </button>

            {isFinanceOpen && (
              <div className="layout-nav-items layout-nav-subitems">
                {financeOperationsNavigation.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/transactions"}
                      className={({ isActive }) =>
                        `layout-nav-link${isActive ? " is-active" : ""}`
                      }
                      onClick={closeMobileNavigation}
                    >
                      <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            )}
          </section>

          <NavigationGroup
            title="ANALYTICS"
            items={insightNavigation}
            onNavigate={closeMobileNavigation}
          />

          <section className="layout-nav-group" aria-label="Workspace">
            <button
              type="button"
              className={`layout-nav-group-toggle${
                workspaceIsActive ? " is-active" : ""
              }`}
              aria-expanded={isWorkspaceOpen}
              onClick={() =>
                setWorkspaceState({
                  pathname: location.pathname,
                  isOpen: !isWorkspaceOpen,
                })
              }
            >
              <span className="layout-nav-group-toggle-label">
                <Workflow size={18} strokeWidth={1.8} aria-hidden="true" />
                <span>WORKSPACE</span>
              </span>

              {isWorkspaceOpen ? (
                <ChevronDown size={16} aria-hidden="true" />
              ) : (
                <ChevronRight size={16} aria-hidden="true" />
              )}
            </button>

            {isWorkspaceOpen && (
              <div className="layout-nav-items layout-nav-subitems">
                {workspaceNavigation.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `layout-nav-link${isActive ? " is-active" : ""}`
                      }
                      onClick={closeMobileNavigation}
                    >
                      <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            )}
          </section>
        </nav>

        <div className="layout-sidebar-bottom">
          <div className="layout-workspace-status">
            <span className="layout-caption-dot" />
            <span>Workspace aktif</span>
          </div>

          <div className="layout-sidebar-user">
            <div className="layout-avatar" aria-hidden="true">
              {initial}
            </div>

            <div className="layout-sidebar-user-copy">
              <strong title={displayName}>{displayName}</strong>
              <span title={user?.email}>{user?.email || "Akun pengguna"}</span>
            </div>

            <button
              type="button"
              className="layout-icon-button layout-logout-button"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              aria-label="Logout"
              title="Logout"
            >
              {isLoggingOut ? (
                <span aria-hidden="true">…</span>
              ) : (
                <LogOut size={17} aria-hidden="true" />
              )}
            </button>
          </div>

          {logoutError && (
            <p className="layout-logout-error" role="alert">
              {logoutError}
            </p>
          )}
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar layout-topbar">
          <div className="topbar-heading-group">
            <button
              type="button"
              className="layout-mobile-menu-button"
              aria-label={isMobileNavOpen ? "Tutup navigasi" : "Buka navigasi"}
              aria-expanded={isMobileNavOpen}
              onClick={() => setIsMobileNavOpen((open) => !open)}
            >
              <Menu size={21} aria-hidden="true" />
            </button>

            <div className="topbar-title">
              <span className="eyebrow">PERSONAL FINANCE</span>
              <h1>{pageHeading.title}</h1>
              <p>{pageHeading.description}</p>
            </div>
          </div>

          <div className="topbar-actions layout-topbar-actions">
            {showTransactionActions && (
              <div className="layout-transaction-actions">
                <Link
                  to="/transactions/transfer"
                  className="layout-transfer-button"
                  aria-label="Transfer dana antar rekening"
                  title="Transfer dana"
                >
                  <ArrowLeftRight size={17} aria-hidden="true" />
                  <span>Transfer</span>
                </Link>

                <Link
                  to="/transactions/new"
                  className="layout-add-transaction-button"
                  aria-label="Tambah transaksi baru"
                  title="Tambah transaksi"
                >
                  <span className="layout-add-icon" aria-hidden="true">
                    +
                  </span>
                  <span>Tambah transaksi</span>
                </Link>
              </div>
            )}

            <div className="layout-account-actions">
              <NavLink
                to="/notifications"
                className={({ isActive }) =>
                  `layout-notification-button${isActive ? " is-active" : ""}`
                }
                aria-label="Buka notifikasi"
                title="Notifications"
              >
                <Bell size={19} strokeWidth={1.8} aria-hidden="true" />
              </NavLink>

              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `layout-topbar-profile${isActive ? " is-active" : ""}`
                }
                aria-label="Buka pengaturan akun"
                title="Profil dan pengaturan"
              >
                <div
                  className="layout-avatar layout-avatar-small"
                  aria-hidden="true"
                >
                  {initial}
                </div>

                <div className="layout-topbar-profile-copy">
                  <strong>{displayName}</strong>
                  <span>{user?.email || "Pengaturan akun"}</span>
                </div>

                <ChevronDown size={15} aria-hidden="true" />
              </NavLink>
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

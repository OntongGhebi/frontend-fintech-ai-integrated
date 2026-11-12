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
  ChartNoAxesCombined,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Crown,
  HandCoins,
  Headset,
  HeartPulse,
  Lightbulb,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PiggyBank,
  ReceiptText,
  Repeat,
  Tags,
  Wallet,
  Workflow,
  X,
} from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { GlobalSearch } from "./GlobalSearch";
import "./AppLayout.css";
import "./AppLayout.subscription.css";
import { AIAssistantWidget } from "../ai-assistant/AIAssistantWidget";
import { NotificationBell } from "./NotificationBell";

interface NavigationItem {
  label: string;
  icon: typeof LayoutDashboard;
  to: string;
  end?: boolean;
}

interface NavigationDropdownProps {
  title: string;
  icon: typeof LayoutDashboard;
  items: NavigationItem[];
  isOpen: boolean;
  isActive: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}

const primaryNavigation: NavigationItem[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    to: "/",
    end: true,
  },
];

const financeNavigation: NavigationItem[] = [
  { label: "Transactions", icon: HandCoins, to: "/transactions" },
  { label: "Accounts", icon: Wallet, to: "/accounts" },
  { label: "Budgets", icon: PiggyBank, to: "/budgets" },
  {
    label: "Recurring",
    icon: Repeat,
    to: "/recurring-transactions",
  },
  { label: "Categories", icon: Tags, to: "/categories" },
];

const insightsNavigation: NavigationItem[] = [
  {
    label: "Financial Well-being",
    icon: HeartPulse,
    to: "/financial-well-being",
  },
  {
    label: "Budget Recommendations",
    icon: Lightbulb,
    to: "/budget-recommendations",
  },
  {
    label: "Reports & Analytics",
    icon: ChartNoAxesCombined,
    to: "/reports",
  },
];

const workspaceNavigation: NavigationItem[] = [
  { label: "Subscription", icon: CreditCard, to: "/subscription" },
  { label: "Payments", icon: ReceiptText, to: "/payments" },
  { label: "Integrations", icon: Workflow, to: "/integrations" },
];

function getPageHeading(pathname: string) {
  if (pathname === "/financial-well-being") {
    return {
      title: "Financial Well-being",
      description:
        "Pahami kesehatan keuangan dan tentukan langkah pengelolaan berikutnya.",
    };
  }

  if (pathname === "/budget-recommendations") {
    return {
      title: "Rekomendasi Anggaran",
      description:
        "Tinjau usulan penyesuaian anggaran berdasarkan kondisi keuangan Anda.",
    };
  }

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

  if (pathname === "/helpdesk") {
    return {
      title: "Helpdesk",
      description: "Temukan bantuan dan dukungan untuk penggunaan aplikasi.",
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

function isPathInNavigation(
  pathname: string,
  items: NavigationItem[],
): boolean {
  return items.some(
    (item) =>
      pathname === item.to || (!item.end && pathname.startsWith(`${item.to}/`)),
  );
}

function NavigationDropdown({
  title,
  icon: GroupIcon,
  items,
  isOpen,
  isActive,
  onToggle,
  onNavigate,
}: NavigationDropdownProps) {
  return (
    <section className="layout-nav-group" aria-label={title}>
      <button
        type="button"
        className={`layout-nav-group-toggle${isActive ? " is-active" : ""}`}
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <span className="layout-nav-group-toggle-label">
          <GroupIcon size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>{title}</span>
        </span>

        {isOpen ? (
          <ChevronDown size={16} aria-hidden="true" />
        ) : (
          <ChevronRight size={16} aria-hidden="true" />
        )}
      </button>

      {isOpen && (
        <div className="layout-nav-items layout-nav-subitems">
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end ?? false}
                className={({ isActive: linkIsActive }) =>
                  `layout-nav-link${linkIsActive ? " is-active" : ""}`
                }
                onClick={onNavigate}
              >
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const [mobileNavState, setMobileNavState] = useState({
    pathname: location.pathname,
    isOpen: false,
  });

  const activeGroup = (() => {
    if (isPathInNavigation(location.pathname, financeNavigation)) {
      return "finance";
    }

    if (isPathInNavigation(location.pathname, insightsNavigation)) {
      return "insights";
    }

    if (isPathInNavigation(location.pathname, workspaceNavigation)) {
      return "workspace";
    }

    return null;
  })();

  const [expandedGroupState, setExpandedGroupState] = useState<{
    pathname: string;
    group: string | null;
  }>({
    pathname: location.pathname,
    group: activeGroup,
  });

  const expandedGroup =
    expandedGroupState.pathname === location.pathname
      ? expandedGroupState.group
      : activeGroup;

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

  const closeMobileNavigation = () => {
    setIsMobileNavOpen(false);
  };

  const toggleNavigationGroup = (group: string) => {
    setExpandedGroupState({
      pathname: location.pathname,
      group: expandedGroup === group ? null : group,
    });
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

        {/* Brand */}
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
        </div>

        {/* Global search */}
        <div className="sidebar-search-container">
          <GlobalSearch onNavigate={closeMobileNavigation} />
        </div>

        {/* Main navigation */}
        <nav className="layout-navigation" aria-label="Navigasi utama">
          <div className="layout-nav-items">
            {primaryNavigation.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end ?? false}
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

          <NavigationDropdown
            title="Finance"
            icon={HandCoins}
            items={financeNavigation}
            isOpen={expandedGroup === "finance"}
            isActive={isPathInNavigation(location.pathname, financeNavigation)}
            onToggle={() => toggleNavigationGroup("finance")}
            onNavigate={closeMobileNavigation}
          />

          <NavigationDropdown
            title="Insights"
            icon={ChartNoAxesCombined}
            items={insightsNavigation}
            isOpen={expandedGroup === "insights"}
            isActive={isPathInNavigation(location.pathname, insightsNavigation)}
            onToggle={() => toggleNavigationGroup("insights")}
            onNavigate={closeMobileNavigation}
          />

          <NavigationDropdown
            title="Workspace"
            icon={Workflow}
            items={workspaceNavigation}
            isOpen={expandedGroup === "workspace"}
            isActive={isPathInNavigation(
              location.pathname,
              workspaceNavigation,
            )}
            onToggle={() => toggleNavigationGroup("workspace")}
            onNavigate={closeMobileNavigation}
          />
        </nav>

        {/* Sidebar bottom */}
        <div className="layout-sidebar-bottom">
          <NavLink
            to="/helpdesk"
            className={({ isActive }) =>
              `layout-helpdesk-link${isActive ? " is-active" : ""}`
            }
            onClick={closeMobileNavigation}
          >
            <Headset size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>Helpdesk</span>
          </NavLink>

          <button
            type="button"
            className="layout-logout-link"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <span className="layout-logout-loading" aria-hidden="true">
                …
              </span>
            ) : (
              <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />
            )}
            <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
          </button>

          {logoutError && (
            <p className="layout-logout-error" role="alert">
              {logoutError}
            </p>
          )}

          <div className="layout-premium-card">
            <div className="layout-premium-heading">
              <strong>Upgrade Pro!</strong>
              <Crown size={17} strokeWidth={1.9} aria-hidden="true" />
            </div>

            <p>
              Tingkatkan pengalaman finansial dengan fitur dan analisis yang
              lebih lengkap.
            </p>

            <div className="layout-premium-actions">
              <NavLink
                to="/plans"
                className="layout-premium-button"
                onClick={closeMobileNavigation}
              >
                <Crown size={13} aria-hidden="true" />
                <span>Upgrade</span>
              </NavLink>

              <NavLink
                to="/subscription"
                className="layout-premium-learn"
                onClick={closeMobileNavigation}
              >
                Learn more
              </NavLink>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
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
              {/* Dark mode placeholder */}
              <button
                type="button"
                className="layout-theme-toggle"
                disabled
                aria-label="Dark mode segera hadir"
                title="Dark mode segera hadir"
              >
                <Moon size={19} strokeWidth={1.8} aria-hidden="true" />
                <span>Dark mode</span>
                <span className="layout-coming-soon">Soon</span>
              </button>

              <NotificationBell />

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

      <AIAssistantWidget />
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../../contexts/AuthContext";
import {
  ChartArea,
  FileBarChart,
  HandCoins,
  WalletMinimal,
  Bell,
  CreditCard,
  ReceiptText,
  Workflow,
  Settings,
  Tags,
  PiggyBank,
} from "lucide-react";

const navigation = [
  {
    label: "Dashboard",
    icon: <ChartArea size={18} />,
    to: "/",
    end: true,
  },
  {
    label: "Transactions",
    icon: <HandCoins size={18} />,
    to: "/transactions",
    end: false,
  },
  {
    label: "Accounts",
    icon: <WalletMinimal size={18} />,
    to: "/accounts",
    end: false,
  },
  {
    label: "Budgets",
    icon: <PiggyBank size={18} />,
    to: "/budgets",
    end: false,
  },
  {
    label: "Reports",
    icon: <FileBarChart size={18} />,
    to: "/reports",
    end: false,
  },
  {
    label: "Categories",
    icon: <Tags size={18} />,
    to: "/categories",
    end: false,
  },
  {
    label: "Notifications",
    icon: <Bell size={18} />,
    to: "/notifications",
    end: false,
  },
  {
    label: "Subscription",
    icon: <CreditCard size={18} />,
    to: "/subscription",
    end: false,
  },
  {
    label: "Payments",
    icon: <ReceiptText size={18} />,
    to: "/payments",
    end: false,
  },
  {
    label: "Integrations",
    icon: <Workflow size={18} />,
    to: "/integrations",
    end: false,
  },
  {
    label: "Settings",
    icon: <Settings size={18} />,
    to: "/settings",
    end: false,
  },
];

const upcomingFeatures = ["Recurring"];

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
      title: "Reports",
      description: "Analisis pemasukan, pengeluaran, dan performa keuangan.",
    };
  }

  if (pathname === "/categories") {
    return {
      title: "Categories",
      description: "Kelola kategori pemasukan dan pengeluaran transaksi.",
    };
  }

  if (pathname === "/subscription") {
    return {
      title: "Subscription",
      description: "Kelola paket dan status langganan akunmu.",
    };
  }

  if (pathname === "/payments") {
    return {
      title: "Payments",
      description: "Lihat riwayat pembayaran dan status transaksi pembayaran.",
    };
  }

  if (pathname === "/integrations") {
    return {
      title: "Integrations",
      description: "Kelola panduan integrasi Telegram dan AI Assistant.",
    };
  }

  if (pathname === "/settings") {
    return {
      title: "Settings",
      description: "Kelola profil, preferensi, dan keamanan akun Anda.",
    };
  }

  return {
    title: "Dashboard",
    description: "Track, assess, and enhance your financial performance.",
  };
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

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

  const showAddTransactionButton =
    location.pathname === "/" || location.pathname === "/transactions";

  const showTransferButton =
    location.pathname === "/" || location.pathname === "/transactions";

  return (
    <div className="app-shell">
      {isMobileNavOpen && (
        <button
          type="button"
          className="mobile-nav-backdrop"
          aria-label="Tutup navigasi"
          onClick={() => setIsMobileNavOpen(false)}
        />
      )}

      <aside className={`sidebar${isMobileNavOpen ? " sidebar-open" : ""}`}>
        <div className="sidebar-mobile-heading">
          <span>NAVIGASI</span>
          <button
            type="button"
            className="sidebar-mobile-close"
            aria-label="Tutup navigasi"
            onClick={() => setIsMobileNavOpen(false)}
          >
            ×
          </button>
        </div>

        <NavLink
          to="/"
          className="brand"
          aria-label="Fintech AI dashboard"
          onClick={() => setIsMobileNavOpen(false)}
        >
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
              end={item.end}
              className={({ isActive }) =>
                `navigation-link${isActive ? " active" : ""}`
              }
              onClick={() => setIsMobileNavOpen(false)}
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
          <div className="topbar-heading-group">
            <button
              type="button"
              className="mobile-nav-toggle"
              aria-label={isMobileNavOpen ? "Tutup navigasi" : "Buka navigasi"}
              aria-expanded={isMobileNavOpen}
              onClick={() => setIsMobileNavOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>

            <div className="topbar-title">
              <span className="eyebrow">PERSONAL FINANCE</span>
              <h1>{pageHeading.title}</h1>
              <p>{pageHeading.description}</p>
            </div>
          </div>

          <div className="topbar-actions">
            {showTransferButton && (
              <Link
                to="/transactions/transfer"
                className="layout-transfer-button"
                aria-label="Transfer dana antar rekening"
              >
                <span aria-hidden="true">↔</span>
                <span>Transfer Dana</span>
              </Link>
            )}

            {showAddTransactionButton && (
              <Link
                to="/transactions/new"
                className="layout-add-transaction-button"
                aria-label="Tambah transaksi baru"
              >
                <span aria-hidden="true">＋</span>
                <span>Tambah Transaksi</span>
              </Link>
            )}

            <span className="topbar-date">
              <span className="topbar-date-dot" />
              IDR · Asia/Jakarta
            </span>

            <NavLink
              to="/settings"
              className="topbar-profile"
              aria-label="Buka pengaturan akun"
              title="Pengaturan akun"
            >
              <div className="user-avatar user-avatar-small" aria-hidden="true">
                {initial}
              </div>

              <div className="topbar-profile-copy">
                <strong>{displayName}</strong>
                <span>{user?.email}</span>
              </div>
            </NavLink>
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

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  // ArrowDown,
  // ArrowUp,
  ArrowUpRight,
  Banknote,
  Bell,
  BookOpen,
  CalendarClock,
  CreditCard,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  Search,
  Settings,
  Tags,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { apiClient } from "../../lib/api-client";
import "./GlobalSearch.css";

type SearchItem = {
  id: string;
  title: string;
  description: string;
  path: string;
  group: string;
  icon: LucideIcon;
  keywords?: string;
};

type TransactionRecord = {
  id: string;
  description?: string | null;
  title?: string | null;
  amount?: number | string | null;
  type?: string | null;
  date?: string | null;
  transactionDate?: string | null;
  category?: { name?: string | null } | string | null;
};

type AccountRecord = {
  id: string;
  name?: string | null;
  type?: string | null;
  balance?: number | string | null;
};

type CategoryRecord = {
  id: string;
  name?: string | null;
  type?: string | null;
};

type CollectionResponse<T> = {
  data?: T[];
  items?: T[];
  results?: T[];
};

type PositionedPanel = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  openAbove: boolean;
};

type GlobalSearchProps = {
  onNavigate?: () => void;
};

const PAGE_ITEMS: SearchItem[] = [
  {
    id: "page-dashboard",
    title: "Dashboard",
    description: "Ringkasan keuangan",
    path: "/",
    group: "Halaman",
    icon: LayoutDashboard,
    keywords: "beranda overview ringkasan",
  },
  {
    id: "page-transactions",
    title: "Transactions",
    description: "Riwayat pemasukan dan pengeluaran",
    path: "/transactions",
    group: "Halaman",
    icon: Banknote,
    keywords: "income expense pemasukan pengeluaran",
  },
  {
    id: "page-accounts",
    title: "Accounts",
    description: "Saldo dan rekening keuangan",
    path: "/accounts",
    group: "Halaman",
    icon: Wallet,
    keywords: "rekening wallet balance",
  },
  {
    id: "page-budgets",
    title: "Budgets",
    description: "Anggaran dan batas pengeluaran",
    path: "/budgets",
    group: "Halaman",
    icon: CreditCard,
    keywords: "anggaran limit spending",
  },
  {
    id: "page-reports",
    title: "Reports",
    description: "Analisis dan laporan keuangan",
    path: "/reports",
    group: "Halaman",
    icon: FileText,
    keywords: "report analytics statistik",
  },
  {
    id: "page-categories",
    title: "Category",
    description: "Kategori transaksi",
    path: "/categories",
    group: "Halaman",
    icon: Tags,
    keywords: "classification jenis transaksi",
  },
  {
    id: "page-recurring",
    title: "Recurring Transactions",
    description: "Jadwal transaksi otomatis",
    path: "/recurring-transactions",
    group: "Halaman",
    icon: CalendarClock,
    keywords: "recurring schedule otomatis",
  },
  {
    id: "page-notifications",
    title: "Notifications",
    description: "Pemberitahuan dan aktivitas",
    path: "/notifications",
    group: "Halaman",
    icon: Bell,
    keywords: "notification alerts",
  },
  {
    id: "page-subscription",
    title: "Subscriptions",
    description: "Paket dan status langganan",
    path: "/subscription",
    group: "Halaman",
    icon: CreditCard,
    keywords: "subscription plan paket",
  },
  {
    id: "page-payments",
    title: "Payments",
    description: "Riwayat pembayaran",
    path: "/payments",
    group: "Halaman",
    icon: Banknote,
    keywords: "payment billing",
  },
  {
    id: "page-integrations",
    title: "Integrations",
    description: "Telegram dan layanan terhubung",
    path: "/integrations",
    group: "Halaman",
    icon: BookOpen,
    keywords: "integration telegram bot",
  },
  {
    id: "page-settings",
    title: "Settings",
    description: "Preferensi dan konfigurasi akun",
    path: "/settings",
    group: "Halaman",
    icon: Settings,
    keywords: "settings preferences konfigurasi",
  },
];

function unwrapCollection<T>(response: unknown): T[] {
  if (Array.isArray(response)) {
    return response as T[];
  }

  if (!response || typeof response !== "object") {
    return [];
  }

  const value = response as CollectionResponse<T>;

  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.results)) return value.results;

  return [];
}

function normalize(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function formatAmount(value: unknown): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getCategoryName(category: TransactionRecord["category"]): string {
  if (typeof category === "string") return category;
  if (category && typeof category === "object") {
    return normalize(category.name);
  }

  return "";
}

function createTransactionItems(
  transactions: TransactionRecord[],
): SearchItem[] {
  return transactions
    .filter((transaction) => normalize(transaction.id))
    .map((transaction) => {
      const title =
        normalize(transaction.description) ||
        normalize(transaction.title) ||
        "Transaksi tanpa nama";

      const category = getCategoryName(transaction.category);
      const amount = formatAmount(transaction.amount);
      const date =
        normalize(transaction.date) || normalize(transaction.transactionDate);

      return {
        id: `transaction-${transaction.id}`,
        title,
        description:
          [category, amount, date].filter(Boolean).join(" · ") ||
          "Detail transaksi",
        path: `/transactions/${encodeURIComponent(transaction.id)}`,
        group: "Transaksi",
        icon: Banknote,
        keywords: `${transaction.type ?? ""} ${category}`,
      };
    });
}

function createAccountItems(accounts: AccountRecord[]): SearchItem[] {
  return accounts
    .filter((account) => normalize(account.id))
    .map((account) => ({
      id: `account-${account.id}`,
      title: normalize(account.name) || "Akun tanpa nama",
      description:
        [normalize(account.type), formatAmount(account.balance)]
          .filter(Boolean)
          .join(" · ") || "Detail akun",
      path: `/accounts/${encodeURIComponent(account.id)}`,
      group: "Akun",
      icon: Wallet,
      keywords: normalize(account.type),
    }));
}

function createCategoryItems(categories: CategoryRecord[]): SearchItem[] {
  return categories
    .filter((category) => normalize(category.id))
    .map((category) => ({
      id: `category-${category.id}`,
      title: normalize(category.name) || "Kategori tanpa nama",
      description: normalize(category.type) || "Kategori transaksi",
      path: "/categories",
      group: "Kategori",
      icon: Tags,
      keywords: normalize(category.type),
    }));
}

function calculatePanelPosition(
  input: HTMLInputElement,
  panelWidth: number,
): PositionedPanel {
  const rect = input.getBoundingClientRect();
  const viewportPadding = 12;
  const gap = 8;

  const width = Math.min(
    Math.max(rect.width, 320),
    window.innerWidth - viewportPadding * 2,
    panelWidth,
  );

  const left = Math.min(
    Math.max(viewportPadding, rect.left),
    window.innerWidth - width - viewportPadding,
  );

  const availableBelow =
    window.innerHeight - rect.bottom - gap - viewportPadding;
  const availableAbove = rect.top - gap - viewportPadding;

  const openAbove = availableBelow < 240 && availableAbove > availableBelow;

  const availableHeight = Math.max(
    160,
    openAbove ? availableAbove : availableBelow,
  );

  const maxHeight = Math.min(
    520,
    window.innerHeight - viewportPadding * 2,
    availableHeight,
  );

  const top = openAbove
    ? Math.max(viewportPadding, rect.top - gap - maxHeight)
    : Math.min(
        window.innerHeight - maxHeight - viewportPadding,
        rect.bottom + gap,
      );

  return {
    top,
    left,
    width,
    maxHeight,
    openAbove,
  };
}

export function GlobalSearch({ onNavigate }: GlobalSearchProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const listId = useId();

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const [dataItems, setDataItems] = useState<SearchItem[]>([]);
  const [panelPosition, setPanelPosition] = useState<PositionedPanel | null>(
    null,
  );

  const updatePanelPosition = useCallback(() => {
    const input = inputRef.current;

    if (!input || !isOpen) return;

    setPanelPosition(calculatePanelPosition(input, 560));
  }, [isOpen]);

  const loadSearchData = useCallback(async () => {
    if (hasLoadedData || isLoading) return;

    setIsLoading(true);
    setLoadError(false);

    const [transactionsResult, accountsResult, categoriesResult] =
      await Promise.allSettled([
        apiClient.get<unknown>("transactions?page=1&limit=50"),
        apiClient.get<unknown>("accounts"),
        apiClient.get<unknown>("categories"),
      ]);

    const nextItems: SearchItem[] = [];

    if (transactionsResult.status === "fulfilled") {
      nextItems.push(
        ...createTransactionItems(
          unwrapCollection<TransactionRecord>(transactionsResult.value),
        ),
      );
    }

    if (accountsResult.status === "fulfilled") {
      nextItems.push(
        ...createAccountItems(
          unwrapCollection<AccountRecord>(accountsResult.value),
        ),
      );
    }

    if (categoriesResult.status === "fulfilled") {
      nextItems.push(
        ...createCategoryItems(
          unwrapCollection<CategoryRecord>(categoriesResult.value),
        ),
      );
    }

    const allFailed =
      transactionsResult.status === "rejected" &&
      accountsResult.status === "rejected" &&
      categoriesResult.status === "rejected";

    setDataItems(nextItems);
    setLoadError(allFailed);
    setHasLoadedData(!allFailed);
    setIsLoading(false);
  }, [hasLoadedData, isLoading]);

  const allItems = useMemo(() => [...PAGE_ITEMS, ...dataItems], [dataItems]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");

    if (!normalizedQuery) {
      return PAGE_ITEMS.slice(0, 6);
    }

    return allItems
      .filter((item) => {
        const searchable = [
          item.title,
          item.description,
          item.group,
          item.keywords ?? "",
        ]
          .join(" ")
          .toLocaleLowerCase("id-ID");

        return searchable.includes(normalizedQuery);
      })
      .slice(0, 30);
  }, [allItems, query]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, SearchItem[]>();

    filteredItems.forEach((item) => {
      const group = groups.get(item.group) ?? [];
      group.push(item);
      groups.set(item.group, group);
    });

    return Array.from(groups.entries());
  }, [filteredItems]);

  useEffect(() => {
    if (!isOpen) return;

    void loadSearchData();
  }, [isOpen, loadSearchData]);

  useEffect(() => {
    if (!isOpen) return;

    updatePanelPosition();

    const handleViewportChange = () => updatePanelPosition();

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener("resize", handleViewportChange);
    visualViewport?.addEventListener("scroll", handleViewportChange);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      visualViewport?.removeEventListener("resize", handleViewportChange);
      visualViewport?.removeEventListener("scroll", handleViewportChange);
    };
  }, [isOpen, updatePanelPosition]);

  useEffect(() => {
    setIsOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) return;

      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }

      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target;

      const isTyping =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen(true);

        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      }

      if (event.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }

      if (!isTyping && event.key === "/") {
        event.preventDefault();
        setIsOpen(true);

        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      }
    };

    document.addEventListener("keydown", handleShortcut);

    return () => {
      document.removeEventListener("keydown", handleShortcut);
    };
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleSelect = useCallback(
    (item: SearchItem) => {
      setIsOpen(false);
      setQuery("");
      navigate(item.path);
      onNavigate?.();
    },
    [navigate, onNavigate],
  );

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        Math.min(current + 1, filteredItems.length - 1),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, current - 1));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      const selected = filteredItems[activeIndex];

      if (selected) handleSelect(selected);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="global-search" ref={rootRef}>
      <div
        className={`global-search__field ${
          isOpen ? "global-search__field--active" : ""
        }`}
      >
        <Search
          className="global-search__input-icon"
          size={17}
          aria-hidden="true"
        />

        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Cari apa saja..."
          aria-label="Cari halaman, transaksi, akun, dan kategori"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listId : undefined}
          aria-autocomplete="list"
          role="combobox"
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleInputKeyDown}
        />

        {query ? (
          <button
            type="button"
            className="global-search__clear"
            aria-label="Hapus pencarian"
            onClick={() => {
              setQuery("");
              setActiveIndex(0);
              inputRef.current?.focus();
            }}
          >
            <X size={14} />
          </button>
        ) : (
          <kbd className="global-search__shortcut">Ctrl K</kbd>
        )}
      </div>

      {isOpen &&
        panelPosition &&
        createPortal(
          <div
            ref={panelRef}
            className={`global-search-panel ${
              panelPosition.openAbove ? "global-search-panel--above" : ""
            }`}
            style={{
              top: panelPosition.top,
              left: panelPosition.left,
              width: panelPosition.width,
              maxHeight: panelPosition.maxHeight,
            }}
          >
            <div className="global-search-panel__header">
              <div>
                <span className="global-search-panel__eyebrow">
                  PENCARIAN GLOBAL
                </span>
                <p className="global-search-panel__heading">
                  {query.trim() ? "Hasil pencarian" : "Akses cepat"}
                </p>
              </div>

              <button
                type="button"
                className="global-search-panel__close"
                aria-label="Tutup pencarian"
                onClick={() => setIsOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div
              id={listId}
              className="global-search-panel__results"
              role="listbox"
              aria-label="Hasil pencarian"
            >
              {isLoading && dataItems.length === 0 && (
                <div className="global-search-panel__status">
                  <LoaderCircle size={18} className="global-search__spinner" />
                  <span>Memuat data pencarian...</span>
                </div>
              )}

              {!isLoading && loadError && (
                <div className="global-search-panel__status global-search-panel__status--error">
                  <p>Data pencarian belum dapat dimuat.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setHasLoadedData(false);
                      setLoadError(false);
                      setIsLoading(false);
                    }}
                  >
                    Coba lagi
                  </button>
                </div>
              )}

              {groupedItems.map(([group, items]) => (
                <section
                  className="global-search-group"
                  key={group}
                  aria-label={group}
                >
                  <p className="global-search-group__title">
                    {group}
                    <span>{items.length}</span>
                  </p>

                  {items.map((item) => {
                    const Icon = item.icon;
                    const index = filteredItems.findIndex(
                      (candidate) => candidate.id === item.id,
                    );
                    const isActive = index === activeIndex;

                    return (
                      <button
                        type="button"
                        key={item.id}
                        role="option"
                        aria-selected={isActive}
                        className={`global-search-result ${
                          isActive ? "global-search-result--active" : ""
                        }`}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => handleSelect(item)}
                      >
                        <span className="global-search-result__icon">
                          <Icon size={17} />
                        </span>

                        <span className="global-search-result__content">
                          <span className="global-search-result__title">
                            {item.title}
                          </span>
                          <span className="global-search-result__description">
                            {item.description}
                          </span>
                        </span>

                        <ArrowUpRight
                          size={15}
                          className="global-search-result__arrow"
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </section>
              ))}

              {!isLoading && !loadError && filteredItems.length === 0 && (
                <div className="global-search-panel__empty">
                  <span className="global-search-panel__empty-icon">
                    <Search size={20} />
                  </span>
                  <strong>Tidak ada hasil</strong>
                  <p>Coba kata kunci lain atau gunakan nama halaman.</p>
                </div>
              )}
            </div>

            <div className="global-search-panel__footer"></div>
          </div>,
          document.body,
        )}
    </div>
  );
}

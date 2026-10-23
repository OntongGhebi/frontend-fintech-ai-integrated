import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CircleCheck,
  Clock3,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";

import { ApiRequestError, apiClient } from "../lib/api-client";
import "./BudgetsPage.css";

type BudgetStatus = "ACTIVE" | "PAUSED" | "COMPLETED";
type BudgetPeriod = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "CUSTOM";

type PerformanceStatus = "ON_TRACK" | "NEAR_LIMIT" | "OVER_BUDGET";

interface BudgetCategory {
  id: string;
  name: string;
}

interface Budget {
  id: string;
  name: string;
  amount: string | number;
  period: BudgetPeriod;
  startDate: string;
  endDate: string | null;
  status: BudgetStatus;
  categoryId?: string | null;
  category?: BudgetCategory | null;
  createdAt?: string;
}

interface BudgetPerformance {
  budgetId: string;
  budgetName: string;
  categoryId: string | null;
  categoryName: string | null;
  budgetAmount: string | number;
  actualAmount: string | number;
  remainingAmount: string | number;
  usagePercentage: string | number;
  transactionCount: number;
  status: PerformanceStatus;
}

interface BudgetPerformanceResponse {
  budgets?: BudgetPerformance[];
  items?: BudgetPerformance[];
  data?:
    | BudgetPerformance[]
    | {
        budgets?: BudgetPerformance[];
        items?: BudgetPerformance[];
      };
}

type StatusFilter = "ALL" | BudgetStatus;

const PERIOD_LABELS: Record<BudgetPeriod, string> = {
  DAILY: "Harian",
  WEEKLY: "Mingguan",
  MONTHLY: "Bulanan",
  YEARLY: "Tahunan",
  CUSTOM: "Periode khusus",
};

const STATUS_LABELS: Record<BudgetStatus, string> = {
  ACTIVE: "Aktif",
  PAUSED: "Dijeda",
  COMPLETED: "Selesai",
};

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "Asia/Jakarta",
});

function toAmount(value: string | number | null | undefined): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function formatCurrency(value: string | number): string {
  return currencyFormatter.format(toAmount(value));
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Tanpa tanggal akhir";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Tanggal tidak tersedia"
    : dateFormatter.format(date);
}

function getUsage(value: string | number): number {
  return Math.max(0, toAmount(value));
}

function getPerformanceStatusLabel(status: PerformanceStatus): string {
  switch (status) {
    case "NEAR_LIMIT":
      return "Mendekati batas";
    case "OVER_BUDGET":
      return "Melebihi anggaran";
    default:
      return "Dalam batas";
  }
}

function getPerformanceClass(status: PerformanceStatus): string {
  switch (status) {
    case "NEAR_LIMIT":
      return "near-limit";
    case "OVER_BUDGET":
      return "over-budget";
    default:
      return "on-track";
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return "Tidak dapat terhubung ke backend. Periksa koneksi API kamu.";
    }

    if (error.status === 401) {
      return "Sesi akun berakhir. Silakan masuk kembali.";
    }

    return error.message || "Terjadi kesalahan saat mengambil data anggaran.";
  }

  if (error instanceof Error) return error.message;

  return "Terjadi kesalahan yang tidak diketahui.";
}

function parseBudgets(response: unknown): Budget[] {
  if (Array.isArray(response)) return response as Budget[];

  if (typeof response === "object" && response !== null) {
    const record = response as Record<string, unknown>;

    if (Array.isArray(record["data"])) {
      return record["data"] as Budget[];
    }

    if (Array.isArray(record["budgets"])) {
      return record["budgets"] as Budget[];
    }
  }

  throw new Error("Format respons daftar anggaran tidak sesuai kontrak API.");
}

function parsePerformance(response: unknown): BudgetPerformance[] {
  if (Array.isArray(response)) return response as BudgetPerformance[];

  if (typeof response !== "object" || response === null) {
    throw new Error("Format respons performa anggaran tidak valid.");
  }

  const record = response as BudgetPerformanceResponse;
  const data = record.data;

  if (Array.isArray(data)) return data;
  if (data && !Array.isArray(data)) {
    if (Array.isArray(data.budgets)) return data.budgets;
    if (Array.isArray(data.items)) return data.items;
  }

  if (Array.isArray(record.budgets)) return record.budgets;
  if (Array.isArray(record.items)) return record.items;

  throw new Error("Data performa anggaran tidak ditemukan dalam respons API.");
}

export function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [performance, setPerformance] = useState<BudgetPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageError, setPageError] = useState("");
  const [performanceError, setPerformanceError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [reloadKey, setReloadKey] = useState(0);

  const loadBudgets = useCallback(async () => {
    setPageError("");
    setPerformanceError("");
    setIsRefreshing(true);

    const [budgetResult, performanceResult] = await Promise.allSettled([
      apiClient.get<unknown>("/budgets"),
      apiClient.get<unknown>("/dashboard/budgets/performance"),
    ]);

    if (budgetResult.status === "fulfilled") {
      try {
        const items = parseBudgets(budgetResult.value).filter(
          (item) =>
            typeof item.id === "string" &&
            typeof item.name === "string" &&
            typeof item.amount !== "undefined",
        );

        setBudgets(items);
      } catch (error) {
        setPageError(getErrorMessage(error));
      }
    } else {
      setPageError(getErrorMessage(budgetResult.reason));
    }

    if (performanceResult.status === "fulfilled") {
      try {
        setPerformance(parsePerformance(performanceResult.value));
      } catch (error) {
        setPerformance([]);
        setPerformanceError(getErrorMessage(error));
      }
    } else {
      setPerformance([]);
      setPerformanceError(getErrorMessage(performanceResult.reason));
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void loadBudgets();
  }, [loadBudgets, reloadKey]);

  const performanceByBudgetId = useMemo(
    () => new Map(performance.map((item) => [item.budgetId, item])),
    [performance],
  );

  const filteredBudgets = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");

    return budgets.filter((budget) => {
      const categoryName = budget.category?.name ?? "";

      const matchesSearch =
        !query ||
        budget.name.toLocaleLowerCase("id-ID").includes(query) ||
        categoryName.toLocaleLowerCase("id-ID").includes(query);

      const matchesStatus =
        statusFilter === "ALL" || budget.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [budgets, search, statusFilter]);

  const activeCount = budgets.filter(
    (budget) => budget.status === "ACTIVE",
  ).length;

  const pausedCount = budgets.filter(
    (budget) => budget.status === "PAUSED",
  ).length;

  const completedCount = budgets.filter(
    (budget) => budget.status === "COMPLETED",
  ).length;

  const totalBudget = budgets
    .filter((budget) => budget.status === "ACTIVE")
    .reduce((sum, budget) => sum + toAmount(budget.amount), 0);

  const totalSpent = performance.reduce(
    (sum, item) => sum + toAmount(item.actualAmount),
    0,
  );

  const totalRemaining = performance.reduce(
    (sum, item) => sum + toAmount(item.remainingAmount),
    0,
  );

  return (
    <main className="budgets-page">
      <header className="budgets-page-header">
        <div>
          <span className="budgets-eyebrow">BUDGET MANAGEMENT</span>
          <h1>Anggaran</h1>
          <p>
            Pantau batas pengeluaran, penggunaan anggaran, dan kondisi
            keuanganmu dalam satu halaman.
          </p>
        </div>

        <button
          type="button"
          className="budgets-refresh-button"
          onClick={() => setReloadKey((value) => value + 1)}
          disabled={isRefreshing}
        >
          <RefreshCw size={17} className={isRefreshing ? "budgets-spin" : ""} />
          {isRefreshing ? "Memperbarui..." : "Perbarui data"}
        </button>
      </header>

      {pageError && (
        <section className="budgets-alert budgets-alert--error" role="alert">
          <AlertTriangle size={19} />
          <div>
            <strong>Anggaran gagal dimuat</strong>
            <p>{pageError}</p>
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              Coba lagi
            </button>
          </div>
        </section>
      )}

      {!pageError && performanceError && (
        <section className="budgets-alert budgets-alert--warning" role="status">
          <AlertTriangle size={19} />
          <div>
            <strong>Data penggunaan belum tersedia</strong>
            <p>
              Daftar anggaran tetap tersedia, tetapi ringkasan pemakaian belum
              bisa ditampilkan. {performanceError}
            </p>
          </div>
        </section>
      )}

      <section className="budgets-summary-grid" aria-label="Ringkasan anggaran">
        <article className="budgets-summary-card">
          <div className="budgets-summary-icon budgets-summary-icon--primary">
            <Wallet size={20} />
          </div>
          <span>Total batas anggaran aktif</span>
          <strong>{formatCurrency(totalBudget)}</strong>
          <small>{activeCount} anggaran aktif</small>
        </article>

        <article className="budgets-summary-card">
          <div className="budgets-summary-icon budgets-summary-icon--spent">
            <CalendarDays size={20} />
          </div>
          <span>Total penggunaan terukur</span>
          <strong>{formatCurrency(totalSpent)}</strong>
          <small>Berdasarkan data performa backend</small>
        </article>

        <article className="budgets-summary-card">
          <div className="budgets-summary-icon budgets-summary-icon--remaining">
            <CircleCheck size={20} />
          </div>
          <span>Total sisa terukur</span>
          <strong>{formatCurrency(totalRemaining)}</strong>
          <small>Dari data performa anggaran</small>
        </article>

        <article className="budgets-summary-card">
          <div className="budgets-summary-icon budgets-summary-icon--paused">
            <Clock3 size={20} />
          </div>
          <span>Anggaran nonaktif sementara</span>
          <strong>{pausedCount}</strong>
          <small>{completedCount} anggaran selesai</small>
        </article>
      </section>

      <section className="budgets-list-panel">
        <div className="budgets-list-heading">
          <div>
            <h2>Daftar anggaran</h2>
            <p>
              {filteredBudgets.length} dari {budgets.length} anggaran
            </p>
          </div>
        </div>

        <div className="budgets-list-toolbar">
          <label className="budgets-search">
            <Search size={18} aria-hidden="true" />
            <span className="budgets-visually-hidden">Cari anggaran</span>
            <input
              type="search"
              placeholder="Cari nama atau kategori..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label className="budgets-status-filter">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
            >
              <option value="ALL">Semua status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="PAUSED">Dijeda</option>
              <option value="COMPLETED">Selesai</option>
            </select>
          </label>
        </div>

        {isLoading ? (
          <div className="budgets-loading" role="status">
            <span className="budgets-loading-spinner" />
            <p>Memuat data anggaran...</p>
          </div>
        ) : !pageError && filteredBudgets.length === 0 ? (
          <div className="budgets-empty-state">
            <div className="budgets-empty-icon">
              <Wallet size={25} />
            </div>
            <h3>
              {budgets.length === 0
                ? "Belum ada anggaran"
                : "Anggaran tidak ditemukan"}
            </h3>
            <p>
              {budgets.length === 0
                ? "Anggaran yang kamu buat nantinya akan ditampilkan di sini beserta progres penggunaannya."
                : "Coba ubah kata pencarian atau filter status."}
            </p>
            {budgets.length > 0 && (
              <button
                type="button"
                className="budgets-secondary-button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("ALL");
                }}
              >
                Reset filter
              </button>
            )}
          </div>
        ) : (
          <div className="budgets-card-list">
            {filteredBudgets.map((budget) => {
              const item = performanceByBudgetId.get(budget.id);
              const usage = item ? getUsage(item.usagePercentage) : null;
              const progressWidth = usage === null ? 0 : Math.min(100, usage);
              const performanceClass = item
                ? getPerformanceClass(item.status)
                : "unknown";
              const period = PERIOD_LABELS[budget.period] ?? budget.period;
              const statusLabel = STATUS_LABELS[budget.status] ?? budget.status;

              return (
                <article className="budgets-item" key={budget.id}>
                  <div className="budgets-item-top">
                    <div className="budgets-item-title">
                      <h3>{budget.name}</h3>
                      <p>
                        {budget.category?.name ?? "Semua kategori"} · {period}
                      </p>
                    </div>

                    <span
                      className={`budgets-status-badge budgets-status-badge--${budget.status.toLowerCase()}`}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  <div className="budgets-item-amount-row">
                    <div>
                      <span>Batas anggaran</span>
                      <strong>{formatCurrency(budget.amount)}</strong>
                    </div>
                    <div className="budgets-item-spent">
                      <span>Terpakai</span>
                      <strong>
                        {item ? formatCurrency(item.actualAmount) : "—"}
                      </strong>
                    </div>
                  </div>

                  <div className="budgets-progress-label">
                    <span>Penggunaan anggaran</span>
                    <strong>
                      {usage === null
                        ? "Belum tersedia"
                        : `${new Intl.NumberFormat("id-ID", {
                            maximumFractionDigits: 1,
                          }).format(usage)}%`}
                    </strong>
                  </div>

                  <div
                    className="budgets-progress-track"
                    role="progressbar"
                    aria-label={`Penggunaan anggaran ${budget.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progressWidth}
                  >
                    <div
                      className={`budgets-progress-fill budgets-progress-fill--${performanceClass}`}
                      style={{ width: `${progressWidth}%` }}
                    />
                  </div>

                  <div className="budgets-item-bottom">
                    <span>
                      {item
                        ? `Sisa terukur: ${formatCurrency(item.remainingAmount)}`
                        : "Data penggunaan belum tersedia"}
                    </span>
                    <span>
                      {formatDate(budget.startDate)} —{" "}
                      {formatDate(budget.endDate)}
                    </span>
                  </div>

                  {item && (
                    <div
                      className={`budgets-performance-note budgets-performance-note--${performanceClass}`}
                    >
                      <span className="budgets-performance-dot" />
                      {getPerformanceStatusLabel(item.status)}
                      <span>{item.transactionCount} transaksi terhitung</span>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

import { useEffect, useMemo, useState } from "react";

import { ApiRequestError, apiClient } from "../lib/api-client";
import { BudgetPerformanceSection } from "./dashboard/BudgetPerformanceSection";
import { RecurringPerformanceSection } from "./dashboard/RecurringPerformanceSection";
import { CashFlowAnalyticsSection } from "./dashboard/CashFlowAnalyticsSection";
import "./DashboardPage.css";

interface DashboardSummary {
  currency: string;
  totalIncome: string;
  totalExpense: string;
  netCashFlow: string;
  transactionCount: number;
}

interface MonthlyFinancialItem {
  month: string;
  income: string;
  expense: string;
  netCashFlow: string;
  transactionCount: number;
  savingsRate: string;
}

interface MonthlyFinancialSummary {
  currency: string;
  startDate: string;
  endDate: string;
  months: MonthlyFinancialItem[];
  totalIncome: string;
  totalExpense: string;
  totalNetCashFlow: string;
  totalTransactionCount: number;
  averageMonthlyIncome: string;
  averageMonthlyExpense: string;
}

interface CategoryAnalyticsItem {
  categoryId: string;
  categoryName: string;
  totalAmount: string;
  transactionCount: number;
  percentage: string;
}

interface CategoryAnalytics {
  currency: string;
  type: "INCOME" | "EXPENSE";
  categories: CategoryAnalyticsItem[];
  totalAmount: string;
  transactionCount: number;
}

interface DashboardOverview {
  currency: string;
  summary: DashboardSummary;
  monthlyFinancialSummary: MonthlyFinancialSummary;
  categoryAnalytics: CategoryAnalytics;
}

interface BudgetPerformanceItem {
  budgetId: string;
  budgetName: string;
  categoryId: string | null;
  categoryName: string | null;
  budgetAmount: string | number;
  actualAmount: string | number;
  remainingAmount: string | number;
  usagePercentage: string | number;
  transactionCount: number;
  status: "ON_TRACK" | "NEAR_LIMIT" | "OVER_BUDGET" | string;
}

interface BudgetPerformanceResponse {
  currency?: string;
  items?: BudgetPerformanceItem[];
  budgets?: BudgetPerformanceItem[];
  data?:
    | BudgetPerformanceItem[]
    | {
        items?: BudgetPerformanceItem[];
        budgets?: BudgetPerformanceItem[];
      };
  summary?: {
    totalBudgetAmount?: string | number;
    totalActualAmount?: string | number;
    totalRemainingAmount?: string | number;
  };
}

interface Comparison {
  current: number;
  previous: number;
  difference: number;
  percentage: number | null;
}

type ComparisonType = "income" | "expense";

function toAmount(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function formatCurrency(value: string | number, currency = "IDR"): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "—";
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompactCurrency(
  value: string | number,
  currency = "IDR",
): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "—";
  }

  const absolute = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";

  if (currency === "IDR" && absolute >= 1_000_000_000) {
    return `${sign}Rp ${(absolute / 1_000_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} M`;
  }

  if (currency === "IDR" && absolute >= 1_000_000) {
    return `${sign}Rp ${(absolute / 1_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} jt`;
  }

  if (currency === "IDR" && absolute >= 10_000) {
    return `${sign}Rp ${(absolute / 1_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} rb`;
  }

  return formatCurrency(amount, currency);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatPercent(value: number): string {
  return `${value.toLocaleString("id-ID", {
    maximumFractionDigits: 1,
  })}%`;
}

function formatMonth(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);

  if (!match) {
    return month;
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);

  return new Intl.DateTimeFormat("id-ID", {
    month: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function formatPeriod(summary?: MonthlyFinancialSummary): string {
  if (!summary?.startDate || !summary.endDate) {
    return "Periode analitik";
  }

  const start = new Date(summary.startDate);
  const end = new Date(summary.endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Periode analitik";
  }

  const formatter = new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function getPercentage(value: string | number): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(100, Math.max(0, parsed));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return "Backend tidak dapat dijangkau. Pastikan server API aktif dan URL API sudah benar.";
    }

    return error.message || "Dashboard gagal dimuat.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Terjadi kesalahan saat memuat data dashboard.";
}

function getCurrentMonthKey(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  return year && month ? `${year}-${month}` : "";
}

function getPreviousMonthKey(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);

  if (!match) {
    return "";
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 2, 1, 12);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthlyComparison(
  months: MonthlyFinancialItem[],
  field: "income" | "expense",
): Comparison | null {
  const currentMonth = getCurrentMonthKey();
  const previousMonth = getPreviousMonthKey(currentMonth);

  const currentItem = months.find((item) => item.month === currentMonth);
  const previousItem = months.find((item) => item.month === previousMonth);

  if (!currentItem || !previousItem) {
    return null;
  }

  const current = toAmount(currentItem[field]);
  const previous = toAmount(previousItem[field]);
  const difference = current - previous;

  let percentage: number | null = null;

  if (previous !== 0) {
    percentage = (difference / Math.abs(previous)) * 100;
  } else if (current === 0) {
    percentage = 0;
  }

  return { current, previous, difference, percentage };
}

function getBudgetItems(
  response: BudgetPerformanceResponse | BudgetPerformanceItem[] | null,
): BudgetPerformanceItem[] {
  if (!response) {
    return [];
  }

  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response.items)) {
    return response.items;
  }

  if (Array.isArray(response.budgets)) {
    return response.budgets;
  }

  if (Array.isArray(response.data)) {
    return response.data;
  }

  if (response.data && !Array.isArray(response.data)) {
    if (Array.isArray(response.data.items)) {
      return response.data.items;
    }

    if (Array.isArray(response.data.budgets)) {
      return response.data.budgets;
    }
  }

  return [];
}

/**
 * Indikator singkat di header kartu:
 * kenaikan = hijau, penurunan = merah, tetap = netral.
 * Aturan warna mengikuti arah perubahan untuk pemasukan maupun pengeluaran.
 */
function ComparisonHeader({ comparison }: { comparison: Comparison | null }) {
  if (!comparison) {
    return (
      <span
        className="dashboard-comparison-header dashboard-comparison-header--muted"
        title="Data bulan ini atau bulan lalu belum lengkap"
      >
        <span aria-hidden="true">—</span>
        <span>Belum tersedia</span>
      </span>
    );
  }

  const increased = comparison.difference > 0;
  const decreased = comparison.difference < 0;
  const tone = increased ? "positive" : decreased ? "negative" : "neutral";

  const arrow = increased ? "↗" : decreased ? "↘" : "→";

  return (
    <span
      className={`dashboard-comparison-header dashboard-comparison-header--${tone}`}
      title={`Bulan ini: ${formatCurrency(comparison.current)}. Bulan lalu: ${formatCurrency(comparison.previous)}.`}
      aria-label={
        comparison.percentage === null
          ? `Perubahan nominal ${increased ? "naik" : decreased ? "turun" : "tetap"} dibanding bulan lalu`
          : `${increased ? "Naik" : decreased ? "Turun" : "Tetap"} ${formatPercent(Math.abs(comparison.percentage))} dibanding bulan lalu`
      }
    >
      <span className="dashboard-comparison-header-icon" aria-hidden="true">
        {arrow}
      </span>
      <strong>
        {comparison.percentage === null
          ? "—"
          : `${increased ? "+" : decreased ? "−" : ""}${formatPercent(Math.abs(comparison.percentage))}`}
      </strong>
    </span>
  );
}

/**
 * Detail perubahan nominal di bawah nilai utama kartu.
 * Komponen ini terpisah dari header agar persentase tetap sejajar dengan judul.
 */
function ComparisonDetail({
  comparison,
  currency,
}: {
  comparison: Comparison | null;
  currency: string;
}) {
  if (!comparison) {
    return (
      <p className="dashboard-comparison-detail dashboard-comparison-detail--muted">
        Perbandingan dengan bulan lalu belum tersedia.
      </p>
    );
  }

  const increased = comparison.difference > 0;
  const decreased = comparison.difference < 0;
  const sign = increased ? "+" : decreased ? "−" : "";
  const amount = formatCompactCurrency(
    Math.abs(comparison.difference),
    currency,
  );

  return (
    <p
      className={`dashboard-comparison-detail ${
        increased
          ? "dashboard-comparison-detail--positive"
          : decreased
            ? "dashboard-comparison-detail--negative"
            : "dashboard-comparison-detail--neutral"
      }`}
      title={`Nominal bulan lalu: ${formatCurrency(comparison.previous, currency)}`}
    >
      <span>
        {sign}
        {amount}
      </span>
      <span>vs bulan lalu</span>
    </p>
  );
}

export function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [incomeAnalytics, setIncomeAnalytics] =
    useState<CategoryAnalytics | null>(null);
  const [budgetItems, setBudgetItems] = useState<BudgetPerformanceItem[]>([]);
  const [budgetLoaded, setBudgetLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<"6" | "12">("12");

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboard() {
      setIsLoading(true);
      setErrorMessage(null);
      setBudgetLoaded(false);

      const [overviewResult, incomeResult, budgetResult] =
        await Promise.allSettled([
          apiClient.get<DashboardOverview>("/dashboard/overview"),
          apiClient.get<CategoryAnalytics>("/dashboard/categories?type=INCOME"),
          apiClient.get<BudgetPerformanceResponse | BudgetPerformanceItem[]>(
            "/dashboard/budgets/performance",
          ),
        ]);

      if (cancelled) {
        return;
      }

      if (overviewResult.status === "fulfilled") {
        const result = overviewResult.value;

        if (
          result?.summary &&
          result.monthlyFinancialSummary &&
          result.categoryAnalytics
        ) {
          setOverview(result);
        } else {
          setOverview(null);
          setErrorMessage(
            "Respons dashboard belum memiliki struktur analitik yang diperlukan.",
          );
        }
      } else {
        setOverview(null);
        setErrorMessage(getErrorMessage(overviewResult.reason));
      }

      if (incomeResult.status === "fulfilled") {
        setIncomeAnalytics(incomeResult.value);
      } else {
        setIncomeAnalytics(null);
      }

      if (budgetResult.status === "fulfilled") {
        setBudgetItems(getBudgetItems(budgetResult.value));
      } else {
        setBudgetItems([]);
      }

      setBudgetLoaded(true);
      setIsLoading(false);
    }

    void fetchDashboard();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const summary = overview?.summary;
  const monthlySummary = overview?.monthlyFinancialSummary;
  const categoryAnalytics = overview?.categoryAnalytics;
  const currency = overview?.currency ?? "IDR";
  const allMonths = monthlySummary?.months ?? [];

  const months = useMemo(
    () => allMonths.slice(-Number(selectedPeriod)),
    [allMonths, selectedPeriod],
  );

  const expenseCategories = useMemo(
    () =>
      [...(categoryAnalytics?.categories ?? [])]
        .filter((item) => toAmount(item.totalAmount) > 0)
        .sort(
          (first, second) =>
            toAmount(second.totalAmount) - toAmount(first.totalAmount),
        ),
    [categoryAnalytics?.categories],
  );

  const topIncomeCategories = useMemo(
    () =>
      [...(incomeAnalytics?.categories ?? [])]
        .filter((item) => toAmount(item.totalAmount) > 0)
        .sort(
          (first, second) =>
            toAmount(second.totalAmount) - toAmount(first.totalAmount),
        )
        .slice(0, 3),
    [incomeAnalytics?.categories],
  );

  const incomeComparison = useMemo(
    () => getMonthlyComparison(allMonths, "income"),
    [allMonths],
  );

  const expenseComparison = useMemo(
    () => getMonthlyComparison(allMonths, "expense"),
    [allMonths],
  );

  const budgetTotals = useMemo(() => {
    const totalBudget = budgetItems.reduce(
      (sum, item) => sum + Math.max(0, toAmount(item.budgetAmount)),
      0,
    );

    const totalActual = budgetItems.reduce(
      (sum, item) => sum + Math.max(0, toAmount(item.actualAmount)),
      0,
    );

    return {
      totalBudget,
      totalActual,
      remaining: totalBudget - totalActual,
      usagePercentage:
        totalBudget > 0 ? (totalActual / totalBudget) * 100 : null,
    };
  }, [budgetItems]);

  const maxMonthlyAmount = Math.max(
    1,
    ...months.flatMap((month) => [
      toAmount(month.income),
      toAmount(month.expense),
    ]),
  );

  const hasMonthlyTransactions = months.some(
    (month) => toAmount(month.income) > 0 || toAmount(month.expense) > 0,
  );

  const hasExpenseCategories = expenseCategories.length > 0;
  const hasIncomeCategories = topIncomeCategories.length > 0;

  const income = toAmount(summary?.totalIncome);
  const cashFlow = toAmount(summary?.netCashFlow);
  const savingsRate =
    income > 0 ? Math.max(0, Math.min(100, (cashFlow / income) * 100)) : 0;

  return (
    <main className="dashboard-page">
      <div className="dashboard-toolbar" aria-label="Kontrol dashboard">
        <div className="dashboard-toolbar-context">
          <span className="dashboard-live-dot" aria-hidden="true" />
          <span className="dashboard-toolbar-label">Periode analitik</span>
          <strong className="dashboard-period-pill__value">
            {formatPeriod(monthlySummary)}
          </strong>
        </div>

        <button
          className="dashboard-refresh-button"
          type="button"
          onClick={() => setReloadKey((current) => current + 1)}
          disabled={isLoading}
          aria-label={
            isLoading ? "Dashboard sedang dimuat" : "Perbarui data dashboard"
          }
        >
          <span aria-hidden="true">{isLoading ? "…" : "↻"}</span>
          <span>{isLoading ? "Memuat" : "Perbarui"}</span>
        </button>
      </div>

      {errorMessage && (
        <div className="dashboard-error" role="alert">
          <div className="dashboard-error-symbol" aria-hidden="true">
            !
          </div>
          <div className="dashboard-error-copy">
            <strong>Data dashboard belum tersedia</strong>
            <p>{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            disabled={isLoading}
          >
            Coba lagi
          </button>
        </div>
      )}

      <section
        className="dashboard-summary-layout"
        aria-label="Ringkasan keuangan"
      >
        <article className="dashboard-balance-card">
          <div className="dashboard-balance-card-heading">
            <div>
              <span className="dashboard-card-overline">YOUR CASH FLOW</span>
              <h2>Ringkasan saldo bersih</h2>
            </div>
            <span className="dashboard-card-icon dashboard-card-icon--light">
              ↗
            </span>
          </div>

          <div
            className="dashboard-balance-value"
            aria-busy={isLoading && !overview}
            aria-live="polite"
          >
            {isLoading && !overview ? (
              <span className="dashboard-skeleton dashboard-skeleton--balance" />
            ) : summary ? (
              formatCurrency(summary.netCashFlow, currency)
            ) : (
              "—"
            )}
          </div>

          <p className="dashboard-balance-description">
            Total pemasukan dikurangi pengeluaran pada periode ringkasan.
          </p>

          <div className="dashboard-balance-footer" aria-live="polite">
            <span className="dashboard-balance-footer-icon" aria-hidden="true">
              {summary ? (cashFlow >= 0 ? "✓" : "!") : "…"}
            </span>
            <span>
              {summary
                ? cashFlow >= 0
                  ? "Arus kas bersih positif"
                  : "Pengeluaran melebihi pemasukan"
                : isLoading
                  ? "Memuat arus kas…"
                  : "Arus kas belum tersedia"}
            </span>
          </div>
        </article>

        <div className="dashboard-stat-stack">
          {/* KARTU TOTAL PEMASUKAN */}
          <article className="dashboard-stat-card dashboard-stat-card--lime">
            <div className="dashboard-stat-card-heading">
              <span>Total pemasukan</span>
              <div className="dashboard-stat-heading-right">
                <ComparisonHeader comparison={incomeComparison} />
                <span className="dashboard-stat-icon" aria-hidden="true">
                  ＋
                </span>
              </div>
            </div>

            <strong
              className="dashboard-stat-value"
              aria-busy={isLoading}
              aria-live="polite"
            >
              {isLoading && !overview ? (
                <span className="dashboard-skeleton" />
              ) : summary ? (
                formatCurrency(summary.totalIncome, currency)
              ) : (
                "—"
              )}
            </strong>

            <ComparisonDetail
              comparison={incomeComparison}
              currency={currency}
            />

            <div className="dashboard-income-categories">
              <div className="dashboard-income-categories-heading">
                <span>Kategori pemasukan terbesar</span>
                <span className="dashboard-income-category-caption">
                  Maks. 3
                </span>
              </div>

              {isLoading && !incomeAnalytics ? (
                <div className="dashboard-empty-state dashboard-empty-state--compact">
                  <p>Memuat kategori pemasukan…</p>
                </div>
              ) : !hasIncomeCategories ? (
                <div className="dashboard-empty-state dashboard-empty-state--compact">
                  <p>Belum ada data kategori pemasukan.</p>
                </div>
              ) : (
                <div className="dashboard-income-category-grid">
                  {topIncomeCategories.map((category, index) => (
                    <div
                      className="dashboard-income-category-card"
                      key={category.categoryId}
                      title={`${category.categoryName}: ${formatCurrency(category.totalAmount, currency)}`}
                    >
                      <div className="dashboard-income-category-topline">
                        <span
                          className={`dashboard-income-category-icon dashboard-income-category-icon--${index + 1}`}
                          aria-hidden="true"
                        >
                          {index === 0 ? "↗" : index === 1 ? "＋" : "◈"}
                        </span>
                        <span>
                          {formatPercent(getPercentage(category.percentage))}
                        </span>
                      </div>

                      <span className="dashboard-income-category-name">
                        {category.categoryName}
                      </span>

                      <strong className="dashboard-income-category-amount">
                        {formatCompactCurrency(category.totalAmount, currency)}
                      </strong>

                      <span className="dashboard-income-category-count">
                        {formatNumber(category.transactionCount)} transaksi
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>

          {/* KARTU TOTAL PENGELUARAN */}
          <article className="dashboard-stat-card dashboard-stat-card--coral">
            <div className="dashboard-stat-card-heading">
              <span>Total pengeluaran</span>
              <div className="dashboard-stat-heading-right">
                <ComparisonHeader comparison={expenseComparison} />
                <span className="dashboard-stat-icon" aria-hidden="true">
                  ↘
                </span>
              </div>
            </div>

            <strong
              className="dashboard-stat-value"
              aria-busy={isLoading}
              aria-live="polite"
            >
              {isLoading && !overview ? (
                <span className="dashboard-skeleton" />
              ) : summary ? (
                formatCurrency(summary.totalExpense, currency)
              ) : (
                "—"
              )}
            </strong>

            <ComparisonDetail
              comparison={expenseComparison}
              currency={currency}
            />

            <div className="dashboard-budget-progress">
              <div className="dashboard-budget-progress-heading">
                <span>Anggaran bulanan</span>
                <strong>
                  {budgetLoaded && budgetTotals.usagePercentage !== null
                    ? formatPercent(budgetTotals.usagePercentage)
                    : "—"}
                </strong>
              </div>

              {budgetLoaded && budgetTotals.totalBudget > 0 ? (
                <>
                  <div
                    className="dashboard-budget-track"
                    role="progressbar"
                    aria-label="Penggunaan total anggaran bulanan"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(
                      100,
                      Math.max(0, budgetTotals.usagePercentage ?? 0),
                    )}
                  >
                    <span
                      className={
                        (budgetTotals.usagePercentage ?? 0) > 100
                          ? "dashboard-budget-fill dashboard-budget-fill--over"
                          : "dashboard-budget-fill"
                      }
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, budgetTotals.usagePercentage ?? 0),
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="dashboard-budget-progress-details">
                    <span>
                      Terpakai{" "}
                      {formatCompactCurrency(
                        budgetTotals.totalActual,
                        currency,
                      )}
                    </span>
                    <span>
                      Anggaran{" "}
                      {formatCompactCurrency(
                        budgetTotals.totalBudget,
                        currency,
                      )}
                    </span>
                  </div>

                  <div className="dashboard-budget-remaining">
                    <span>
                      {budgetTotals.remaining >= 0
                        ? "Sisa anggaran"
                        : "Melebihi anggaran"}
                    </span>
                    <strong>
                      {formatCompactCurrency(
                        Math.abs(budgetTotals.remaining),
                        currency,
                      )}
                    </strong>
                  </div>
                </>
              ) : (
                <p className="dashboard-budget-empty">
                  {budgetLoaded
                    ? "Belum ada anggaran yang ditetapkan."
                    : "Memuat data anggaran…"}
                </p>
              )}
            </div>
          </article>
        </div>
      </section>

      <div className="dashboard-section-title">
        <div>
          <span className="dashboard-eyebrow">YOUR FINANCIAL PERFORMANCE</span>
          <h2>Analitik keuangan</h2>
        </div>
        <span className="dashboard-section-period">
          {formatPeriod(monthlySummary)}
        </span>
      </div>

      <section className="dashboard-primary-grid">
        <article
          className="dashboard-panel dashboard-money-flow"
          aria-labelledby="dashboard-money-flow-title"
        >
          <div className="dashboard-panel-heading">
            <div>
              <h3 id="dashboard-money-flow-title">Money flow</h3>
              <p>Perbandingan pemasukan dan pengeluaran bulanan.</p>
            </div>

            <label className="dashboard-period-select">
              <span className="sr-only">Periode grafik</span>
              <select
                value={selectedPeriod}
                onChange={(event) =>
                  setSelectedPeriod(event.target.value as "6" | "12")
                }
              >
                <option value="6">6 bulan</option>
                <option value="12">12 bulan</option>
              </select>
            </label>
          </div>

          <div className="dashboard-chart-legend">
            <span>
              <i className="dashboard-legend-dot dashboard-legend-dot--income" />
              Pemasukan
            </span>
            <span>
              <i className="dashboard-legend-dot dashboard-legend-dot--expense" />
              Pengeluaran
            </span>
          </div>

          {isLoading && !overview ? (
            <div className="dashboard-chart-loading" role="status">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          ) : !overview && errorMessage ? (
            <div className="dashboard-empty-state" role="status">
              <strong>Grafik belum tersedia</strong>
              <p>Data grafik belum berhasil dimuat. Coba perbarui dashboard.</p>
            </div>
          ) : !hasMonthlyTransactions ? (
            <div className="dashboard-empty-state">
              <span className="dashboard-empty-state-icon" aria-hidden="true">
                ↗
              </span>
              <strong>Belum ada aktivitas keuangan</strong>
              <p>
                Grafik akan muncul setelah transaksi tersedia pada periode yang
                dipilih.
              </p>
            </div>
          ) : (
            <>
              <div className="dashboard-chart">
                <div className="dashboard-chart-axis" aria-hidden="true">
                  <span>
                    {formatCompactCurrency(maxMonthlyAmount, currency)}
                  </span>
                  <span>
                    {formatCompactCurrency(maxMonthlyAmount / 2, currency)}
                  </span>
                  <span>{formatCompactCurrency(0, currency)}</span>
                </div>

                <div
                  className="dashboard-chart-plot"
                  role="img"
                  aria-label="Grafik batang pemasukan dan pengeluaran per bulan"
                >
                  <div className="dashboard-chart-gridline dashboard-chart-gridline--one" />
                  <div className="dashboard-chart-gridline dashboard-chart-gridline--two" />
                  <div className="dashboard-chart-gridline dashboard-chart-gridline--three" />

                  <div
                    className="dashboard-chart-columns"
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(months.length, 1)}, minmax(0, 1fr))`,
                    }}
                  >
                    {months.map((month) => {
                      const monthlyIncome = Math.max(0, toAmount(month.income));
                      const monthlyExpense = Math.max(
                        0,
                        toAmount(month.expense),
                      );

                      return (
                        <div
                          className="dashboard-chart-column"
                          key={month.month}
                        >
                          <div className="dashboard-chart-bars">
                            <div
                              className="dashboard-chart-bar dashboard-chart-bar--income"
                              style={{
                                height: `${(monthlyIncome / maxMonthlyAmount) * 100}%`,
                              }}
                              title={`Pemasukan ${formatMonth(month.month)}: ${formatCurrency(monthlyIncome, currency)}`}
                            />
                            <div
                              className="dashboard-chart-bar dashboard-chart-bar--expense"
                              style={{
                                height: `${(monthlyExpense / maxMonthlyAmount) * 100}%`,
                              }}
                              title={`Pengeluaran ${formatMonth(month.month)}: ${formatCurrency(monthlyExpense, currency)}`}
                            />
                          </div>
                          <span>{formatMonth(month.month)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="dashboard-chart-summary">
                <div>
                  <span>Total pemasukan</span>
                  <strong className="dashboard-positive-value">
                    {formatCurrency(
                      months.reduce(
                        (total, month) => total + toAmount(month.income),
                        0,
                      ),
                      currency,
                    )}
                  </strong>
                </div>
                <div>
                  <span>Total pengeluaran</span>
                  <strong className="dashboard-negative-value">
                    {formatCurrency(
                      months.reduce(
                        (total, month) => total + toAmount(month.expense),
                        0,
                      ),
                      currency,
                    )}
                  </strong>
                </div>
              </div>
            </>
          )}
        </article>

        <article
          className="dashboard-panel dashboard-spending-panel"
          aria-labelledby="dashboard-spending-title"
        >
          <div className="dashboard-panel-heading">
            <div>
              <h3 id="dashboard-spending-title">Spending breakdown</h3>
              <p>Distribusi pengeluaran per kategori.</p>
            </div>
            <span className="dashboard-panel-heading-icon" aria-hidden="true">
              ◌
            </span>
          </div>

          <div className="dashboard-spending-total">
            <span>Total pengeluaran kategori</span>
            <strong>
              {categoryAnalytics
                ? formatCurrency(categoryAnalytics.totalAmount, currency)
                : "—"}
            </strong>
            <small>
              {categoryAnalytics
                ? `${formatNumber(categoryAnalytics.transactionCount)} transaksi`
                : "Data belum tersedia"}
            </small>
          </div>

          {isLoading && !overview ? (
            <div className="dashboard-category-loading" role="status">
              <span />
              <span />
              <span />
            </div>
          ) : !overview && errorMessage ? (
            <div
              className="dashboard-empty-state dashboard-empty-state--compact"
              role="status"
            >
              <strong>Data kategori belum tersedia</strong>
              <p>Data belum berhasil dimuat. Coba perbarui dashboard.</p>
            </div>
          ) : !hasExpenseCategories ? (
            <div className="dashboard-empty-state dashboard-empty-state--compact">
              <strong>Belum ada data kategori</strong>
              <p>Pengeluaran berkategori akan ditampilkan di bagian ini.</p>
            </div>
          ) : (
            <div className="dashboard-category-list">
              {expenseCategories.slice(0, 5).map((category, index) => {
                const percentage = getPercentage(category.percentage);

                return (
                  <div
                    className="dashboard-category-item"
                    key={category.categoryId}
                  >
                    <div className="dashboard-category-heading">
                      <div className="dashboard-category-name">
                        <span
                          className={`dashboard-category-dot dashboard-category-dot--${index % 5}`}
                          aria-hidden="true"
                        />
                        <strong>{category.categoryName}</strong>
                      </div>
                      <span className="dashboard-category-percentage">
                        {formatPercent(percentage)}
                      </span>
                    </div>

                    <div
                      className="dashboard-category-track"
                      role="progressbar"
                      aria-label={`Persentase kategori ${category.categoryName}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percentage}
                    >
                      <span
                        className={`dashboard-category-fill dashboard-category-fill--${index % 5}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <div className="dashboard-category-meta">
                      <span>
                        {formatNumber(category.transactionCount)} transaksi
                      </span>
                      <strong>
                        {formatCompactCurrency(category.totalAmount, currency)}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className="dashboard-expense-card">
          <div className="dashboard-expense-card-heading">
            <div>
              <span className="dashboard-card-overline">ACTIVITY</span>
              <h2>Aktivitas keuangan</h2>
            </div>
            <span className="dashboard-expense-icon" aria-hidden="true">
              ◷
            </span>
          </div>

          <div className="dashboard-transaction-count">
            <strong>
              {isLoading && !overview
                ? "—"
                : summary
                  ? formatNumber(summary.transactionCount)
                  : "—"}
            </strong>
            <span>transaksi tercatat</span>
          </div>

          <div className="dashboard-activity-meter">
            <div className="dashboard-activity-meter-track">
              <span style={{ width: `${savingsRate}%` }} />
            </div>
            <div className="dashboard-activity-meter-labels">
              <span>Arus kas tersisa</span>
              <strong>{summary ? formatPercent(savingsRate) : "—"}</strong>
            </div>
          </div>

          <p className="dashboard-expense-card-note">
            Persentase dihitung dari arus kas bersih dibandingkan pemasukan.
          </p>
        </article>
      </section>

      <section
        className="dashboard-module-section"
        aria-label="Performa anggaran"
      >
        <BudgetPerformanceSection />
      </section>

      <section
        className="dashboard-module-section"
        aria-label="Transaksi berulang"
      >
        <RecurringPerformanceSection />
      </section>

      <section
        className="dashboard-module-section"
        aria-label="Analitik arus kas"
      >
        <CashFlowAnalyticsSection />
      </section>

      <footer className="dashboard-footer">
        <span className="dashboard-footer-mark" aria-hidden="true">
          ✳
        </span>
        <div>
          <strong>Keuangan lebih terarah, keputusan lebih baik.</strong>
          <p>
            Angka dan analitik mengikuti data yang dikembalikan oleh backend
            Anda.
          </p>
        </div>
        <span className="dashboard-footer-currency">{currency}</span>
      </footer>
    </main>
  );
}

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

  if (currency === "IDR" && Math.abs(amount) >= 1_000_000_000) {
    return `Rp ${(amount / 1_000_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} M`;
  }

  if (currency === "IDR" && Math.abs(amount) >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} jt`;
  }

  if (currency === "IDR" && Math.abs(amount) >= 10_000) {
    return `Rp ${(amount / 1_000).toLocaleString("id-ID", {
      maximumFractionDigits: 0,
    })} rb`;
  }

  return formatCurrency(amount, currency);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
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

function getPercentage(value: string): number {
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

export function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<"6" | "12">("12");

  useEffect(() => {
    let cancelled = false;

    async function fetchOverview() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await apiClient.get<DashboardOverview>(
          "/dashboard/overview",
        );

        if (
          !response?.summary ||
          !response.monthlyFinancialSummary ||
          !response.categoryAnalytics
        ) {
          throw new Error(
            "Respons dashboard belum memiliki struktur analitik yang diperlukan.",
          );
        }

        if (!cancelled) {
          setOverview(response);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetchOverview();

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

  const categories = useMemo(
    () =>
      [...(categoryAnalytics?.categories ?? [])]
        .filter((item) => Number(item.totalAmount) > 0)
        .sort(
          (first, second) =>
            Number(second.totalAmount) - Number(first.totalAmount),
        ),
    [categoryAnalytics?.categories],
  );

  const maxMonthlyAmount = Math.max(
    1,
    ...months.flatMap((month) => [
      Number(month.income) || 0,
      Number(month.expense) || 0,
    ]),
  );

  const hasMonthlyTransactions = months.some(
    (month) => Number(month.income) > 0 || Number(month.expense) > 0,
  );

  const hasCategoryTransactions = categories.length > 0;

  const income = Number(summary?.totalIncome ?? 0);
  const cashFlow = Number(summary?.netCashFlow ?? 0);

  const savingsRate =
    income > 0 ? Math.max(0, Math.min(100, (cashFlow / income) * 100)) : 0;

  const cards = [
    {
      key: "balance",
      label: "Arus kas bersih",
      value: summary ? formatCurrency(summary.netCashFlow, currency) : "—",
      note: "Pemasukan dikurangi pengeluaran",
      icon: "↗",
      tone: "emerald",
    },
    {
      key: "income",
      label: "Total pemasukan",
      value: summary ? formatCurrency(summary.totalIncome, currency) : "—",
      note: "Pemasukan yang tercatat",
      icon: "＋",
      tone: "lime",
    },
    {
      key: "expense",
      label: "Total pengeluaran",
      value: summary ? formatCurrency(summary.totalExpense, currency) : "—",
      note: "Pengeluaran yang tercatat",
      icon: "↘",
      tone: "coral",
    },
  ] as const;

  return (
    <main className="dashboard-page">
      <header className="dashboard-top-heading">
        <div className="dashboard-heading-copy">
          <span className="dashboard-eyebrow">FINANCIAL OVERVIEW</span>
          <h1>Dashboard</h1>
          <p>
            Pantau, kelola, dan tingkatkan kondisi keuangan Anda dari satu
            tempat.
          </p>
        </div>

        <div className="dashboard-heading-actions">
          <div className="dashboard-period-pill">
            <span className="dashboard-live-dot" aria-hidden="true" />
            {formatPeriod(monthlySummary)}
          </div>

          <button
            className="dashboard-refresh-button"
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            disabled={isLoading}
          >
            <span aria-hidden="true">{isLoading ? "…" : "↻"}</span>
            <span>{isLoading ? "Memuat" : "Perbarui"}</span>
          </button>
        </div>
      </header>

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
          {cards.slice(1).map((card) => (
            <article
              className={`dashboard-stat-card dashboard-stat-card--${card.tone}`}
              key={card.key}
            >
              <div className="dashboard-stat-card-heading">
                <span>{card.label}</span>
                <span className="dashboard-stat-icon" aria-hidden="true">
                  {card.icon}
                </span>
              </div>

              <strong className="dashboard-stat-value" aria-busy={isLoading}>
                {isLoading && !overview ? (
                  <span className="dashboard-skeleton" />
                ) : (
                  card.value
                )}
              </strong>

              <p>{card.note}</p>
            </article>
          ))}
        </div>

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
              <span
                style={{
                  width: `${savingsRate}%`,
                }}
              />
            </div>
            <div className="dashboard-activity-meter-labels">
              <span>Arus kas tersisa</span>
              <strong>
                {summary
                  ? `${savingsRate.toLocaleString("id-ID", {
                      maximumFractionDigits: 1,
                    })}%`
                  : "—"}
              </strong>
            </div>
          </div>

          <p className="dashboard-expense-card-note">
            Persentase dihitung dari arus kas bersih dibandingkan pemasukan.
          </p>
        </article>
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
                      const monthlyIncome = Math.max(
                        0,
                        Number(month.income) || 0,
                      );
                      const monthlyExpense = Math.max(
                        0,
                        Number(month.expense) || 0,
                      );

                      const incomeHeight =
                        (monthlyIncome / maxMonthlyAmount) * 100;
                      const expenseHeight =
                        (monthlyExpense / maxMonthlyAmount) * 100;

                      return (
                        <div
                          className="dashboard-chart-column"
                          key={month.month}
                        >
                          <div className="dashboard-chart-bars">
                            <div
                              className="dashboard-chart-bar dashboard-chart-bar--income"
                              style={{ height: `${incomeHeight}%` }}
                              title={`Pemasukan ${formatMonth(month.month)}: ${formatCurrency(monthlyIncome, currency)}`}
                            />
                            <div
                              className="dashboard-chart-bar dashboard-chart-bar--expense"
                              style={{ height: `${expenseHeight}%` }}
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
                        (total, month) => total + Number(month.income || 0),
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
                        (total, month) => total + Number(month.expense || 0),
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
          ) : !hasCategoryTransactions ? (
            <div className="dashboard-empty-state dashboard-empty-state--compact">
              <strong>Belum ada data kategori</strong>
              <p>Pengeluaran berkategori akan ditampilkan di bagian ini.</p>
            </div>
          ) : (
            <div className="dashboard-category-list">
              {categories.slice(0, 5).map((category, index) => {
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
                        {percentage.toLocaleString("id-ID", {
                          maximumFractionDigits: 1,
                        })}
                        %
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
                        {formatCurrency(category.totalAmount, currency)}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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

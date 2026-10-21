import { useEffect, useState } from "react";

import { ApiRequestError, apiClient } from "../lib/api-client";
import "./DashboardPage.css";
import { BudgetPerformanceSection } from "./dashboard/BudgetPerformanceSection";
import { RecurringPerformanceSection } from "./dashboard/RecurringPerformanceSection";
import { CashFlowAnalyticsSection } from "./dashboard/CashFlowAnalyticsSection";
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

type SummaryCardConfig = {
  key: "income" | "expense" | "cashFlow" | "transactions";
  title: string;
  value: string;
  description: string;
  icon: string;
  tone: "positive" | "negative" | "neutral" | "accent";
};

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
    year: "2-digit",
  }).format(date);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return "Tidak dapat terhubung ke backend. Pastikan server API aktif dan URL API sudah benar.";
    }

    return error.message || "Dashboard gagal dimuat dari server.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Terjadi kesalahan yang tidak diketahui saat memuat dashboard.";
}

function getPeriodLabel(summary?: MonthlyFinancialSummary): string {
  if (!summary?.startDate || !summary.endDate) {
    return "Ringkasan keuangan";
  }

  const start = new Date(summary.startDate);
  const end = new Date(summary.endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Ringkasan keuangan";
  }

  const monthYear = new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

  return `${monthYear.format(start)} – ${monthYear.format(end)}`;
}

function getPercentage(value: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(100, Math.max(0, parsed));
}

export function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
            "Respons dashboard tidak memiliki data analitik yang diperlukan.",
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
  const months = monthlySummary?.months ?? [];
  const categories = categoryAnalytics?.categories ?? [];

  const cards: SummaryCardConfig[] = [
    {
      key: "income",
      title: "Total pemasukan",
      value: summary ? formatCurrency(summary.totalIncome, currency) : "—",
      description: "Pemasukan dari transaksi yang tercatat",
      icon: "↗",
      tone: "positive",
    },
    {
      key: "expense",
      title: "Total pengeluaran",
      value: summary ? formatCurrency(summary.totalExpense, currency) : "—",
      description: "Pengeluaran dari transaksi yang tercatat",
      icon: "↘",
      tone: "negative",
    },
    {
      key: "cashFlow",
      title: "Arus kas bersih",
      value: summary ? formatCurrency(summary.netCashFlow, currency) : "—",
      description: "Pemasukan dikurangi pengeluaran",
      icon: "⇄",
      tone: "accent",
    },
    {
      key: "transactions",
      title: "Total transaksi",
      value: summary ? formatNumber(summary.transactionCount) : "—",
      description: "Transaksi dalam periode ringkasan",
      icon: "#",
      tone: "neutral",
    },
  ];

  const maxMonthlyAmount = Math.max(
    1,
    ...months.flatMap((month) => [
      Number(month.income) || 0,
      Number(month.expense) || 0,
    ]),
  );

  const hasMonthlyTransactions = months.some(
    (month) =>
      (Number(month.income) || 0) > 0 || (Number(month.expense) || 0) > 0,
  );

  const hasCategoryTransactions = categories.some(
    (category) => (Number(category.totalAmount) || 0) > 0,
  );

  return (
    <section className="dashboard-page">
      <div className="dashboard-heading">
        <div className="dashboard-heading-copy">
          <span className="eyebrow">OVERVIEW</span>
          <h1>Ringkasan keuangan</h1>
          <p>
            Pantau pemasukan, pengeluaran, dan pola keuangan Anda dari satu
            tempat.
          </p>
        </div>

        <div className="dashboard-heading-actions">
          <span className="dashboard-period">
            <span className="period-dot" aria-hidden="true" />
            {getPeriodLabel(monthlySummary)}
          </span>

          <button
            className="dashboard-refresh-button"
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            disabled={isLoading}
          >
            <span aria-hidden="true">{isLoading ? "…" : "↻"}</span>
            {isLoading ? "Memuat..." : "Perbarui"}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="dashboard-error" role="alert">
          <div className="dashboard-error-icon" aria-hidden="true">
            !
          </div>

          <div className="dashboard-error-content">
            <strong>Data dashboard belum tersedia</strong>
            <p>{errorMessage}</p>
            <button
              type="button"
              onClick={() => setReloadKey((current) => current + 1)}
              disabled={isLoading}
            >
              Coba lagi
            </button>
          </div>
        </div>
      )}

      <div
        className="financial-summary-grid"
        aria-label="Ringkasan keuangan"
        aria-busy={isLoading}
      >
        {cards.map((card) => (
          <article
            className={`financial-summary-card financial-summary-card--${card.tone}`}
            key={card.key}
          >
            <div className="financial-summary-card-top">
              <span className="financial-summary-title">{card.title}</span>
              <span className="financial-summary-icon" aria-hidden="true">
                {card.icon}
              </span>
            </div>

            <div className="financial-summary-value">
              {isLoading && !overview ? (
                <span
                  className="financial-summary-skeleton"
                  aria-label="Memuat nilai"
                />
              ) : (
                card.value
              )}
            </div>

            <p className="financial-summary-description">{card.description}</p>
          </article>
        ))}
      </div>

      <div className="dashboard-section-heading">
        <div>
          <span className="eyebrow">ANALYTICS</span>
          <h2>Analisis arus kas</h2>
        </div>
        <span className="analytics-period-label">{months.length} bulan</span>
      </div>

      <section className="analytics-panel" aria-labelledby="cash-flow-title">
        <div className="analytics-panel-heading">
          <div>
            <h3 id="cash-flow-title">Pemasukan vs. pengeluaran</h3>
            <p>Perbandingan aktivitas keuangan dari bulan ke bulan.</p>
          </div>

          <div className="chart-legend" aria-label="Legenda grafik">
            <span>
              <i className="legend-dot legend-dot--income" />
              Pemasukan
            </span>
            <span>
              <i className="legend-dot legend-dot--expense" />
              Pengeluaran
            </span>
          </div>
        </div>

        {isLoading && !overview ? (
          <div className="analytics-loading" role="status">
            <span className="analytics-loading-bar" />
            <span className="analytics-loading-bar" />
            <span className="analytics-loading-bar" />
            <span className="analytics-loading-bar" />
          </div>
        ) : !hasMonthlyTransactions ? (
          <div className="analytics-empty-state">
            <span className="analytics-empty-icon" aria-hidden="true">
              ↗
            </span>
            <strong>Belum ada aktivitas keuangan</strong>
            <p>
              Grafik akan menampilkan perbandingan pemasukan dan pengeluaran
              setelah transaksi tersedia pada periode ini.
            </p>
          </div>
        ) : (
          <div className="monthly-chart">
            <div className="monthly-chart-axis-labels" aria-hidden="true">
              <span>{formatCurrency(maxMonthlyAmount, currency)}</span>
              <span>{formatCurrency(maxMonthlyAmount / 2, currency)}</span>
              <span>Rp0</span>
            </div>

            <div
              className="monthly-chart-plot"
              role="img"
              aria-label="Grafik batang pemasukan dan pengeluaran per bulan. Rincian angka tersedia pada daftar data di bawah grafik."
            >
              <div className="monthly-chart-gridline monthly-chart-gridline--top" />
              <div className="monthly-chart-gridline monthly-chart-gridline--middle" />
              <div className="monthly-chart-gridline monthly-chart-gridline--bottom" />

              <div className="monthly-chart-columns">
                {months.map((month) => {
                  const income = Math.max(0, Number(month.income) || 0);
                  const expense = Math.max(0, Number(month.expense) || 0);
                  const incomeHeight = (income / maxMonthlyAmount) * 100;
                  const expenseHeight = (expense / maxMonthlyAmount) * 100;

                  return (
                    <div className="monthly-chart-column" key={month.month}>
                      <div className="monthly-chart-bars">
                        <div
                          className="monthly-chart-bar monthly-chart-bar--income"
                          style={{
                            height: `${incomeHeight}%`,
                          }}
                          title={`${formatMonth(month.month)} — Pemasukan: ${formatCurrency(income, currency)}`}
                        />
                        <div
                          className="monthly-chart-bar monthly-chart-bar--expense"
                          style={{
                            height: `${expenseHeight}%`,
                          }}
                          title={`${formatMonth(month.month)} — Pengeluaran: ${formatCurrency(expense, currency)}`}
                        />
                      </div>
                      <span className="monthly-chart-month">
                        {formatMonth(month.month)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="monthly-chart-data">
              {months.map((month) => (
                <div className="monthly-chart-data-row" key={month.month}>
                  <strong>{formatMonth(month.month)}</strong>
                  <span className="chart-data-income">
                    Masuk: {formatCurrency(month.income, currency)}
                  </span>
                  <span className="chart-data-expense">
                    Keluar: {formatCurrency(month.expense, currency)}
                  </span>
                  <span>
                    Bersih: {formatCurrency(month.netCashFlow, currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="dashboard-section-heading">
        <div>
          <span className="eyebrow">SPENDING BREAKDOWN</span>
          <h2>Pengeluaran per kategori</h2>
        </div>
        <span className="analytics-period-label">Berdasarkan nilai</span>
      </div>

      <section
        className="analytics-panel category-analytics-panel"
        aria-labelledby="category-analytics-title"
      >
        <div className="analytics-panel-heading">
          <div>
            <h3 id="category-analytics-title">Distribusi pengeluaran</h3>
            <p>
              Kategori dengan nilai pengeluaran terbesar ditampilkan lebih
              dahulu.
            </p>
          </div>
        </div>

        {isLoading && !overview ? (
          <div className="category-loading-list" role="status">
            <span />
            <span />
            <span />
            <span />
          </div>
        ) : !hasCategoryTransactions ? (
          <div className="analytics-empty-state">
            <span className="analytics-empty-icon" aria-hidden="true">
              ◌
            </span>
            <strong>Belum ada data pengeluaran per kategori</strong>
            <p>
              Tambahkan transaksi pengeluaran berkategori untuk melihat
              distribusi pengeluaran Anda.
            </p>
          </div>
        ) : (
          <div className="category-analytics-content">
            <div className="category-total">
              <span>Total pengeluaran per kategori</span>
              <strong>
                {formatCurrency(
                  categoryAnalytics?.totalAmount ?? "0",
                  categoryAnalytics?.currency ?? currency,
                )}
              </strong>
              <small>
                {formatNumber(categoryAnalytics?.transactionCount ?? 0)}{" "}
                transaksi
              </small>
            </div>

            <div className="category-analytics-list">
              {categories
                .filter((category) => Number(category.totalAmount) > 0)
                .map((category, index) => {
                  const percentage = getPercentage(category.percentage);

                  return (
                    <article
                      className="category-analytics-item"
                      key={category.categoryId}
                    >
                      <div className="category-analytics-item-heading">
                        <div className="category-name-group">
                          <span
                            className={`category-color-dot category-color-dot--${index % 5}`}
                            aria-hidden="true"
                          />
                          <strong>{category.categoryName}</strong>
                        </div>
                        <strong className="category-amount">
                          {formatCurrency(category.totalAmount, currency)}
                        </strong>
                      </div>

                      <div
                        className="category-progress-track"
                        role="progressbar"
                        aria-label={`Persentase pengeluaran kategori ${category.categoryName}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={percentage}
                      >
                        <div
                          className={`category-progress-fill category-progress-fill--${index % 5}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>

                      <div className="category-analytics-meta">
                        <span>
                          {percentage.toLocaleString("id-ID", {
                            maximumFractionDigits: 1,
                          })}
                          % dari total
                        </span>
                        <span>
                          {formatNumber(category.transactionCount)} transaksi
                        </span>
                      </div>
                    </article>
                  );
                })}
            </div>
          </div>
        )}
      </section>
      <BudgetPerformanceSection />
      <RecurringPerformanceSection />
      <CashFlowAnalyticsSection />

      <section className="dashboard-next-steps">
        <div className="dashboard-next-steps-mark" aria-hidden="true">
          <span>✳</span>
        </div>
        <div className="dashboard-next-steps-copy">
          <h3>Insight keuangan berbasis data</h3>
          <p>
            Analitik ini menggunakan transaksi yang diagregasikan backend.
            Rekomendasi keuangan berbasis AI akan diintegrasikan setelah backend
            dan fitur inti frontend selesai.
          </p>
        </div>
      </section>
    </section>
  );
}

import { useMemo } from "react";

import "./BudgetPerformanceSection.css";

type BudgetStatus = "ON_TRACK" | "NEAR_LIMIT" | "OVER_BUDGET";

export interface BudgetPerformanceItem {
  budgetId: string;
  budgetName: string;
  categoryId: string | null;
  categoryName: string | null;
  budgetAmount: string | number;
  actualAmount: string | number;
  remainingAmount: string | number;
  usagePercentage: string | number;
  transactionCount: number;
  status: BudgetStatus;
}

export interface BudgetPerformanceData {
  currency?: string;
  budgets: BudgetPerformanceItem[];
  totalBudgetAmount?: string | number;
  totalActualAmount?: string | number;
  totalRemainingAmount?: string | number;
}

interface BudgetPerformanceSectionProps {
  performance: BudgetPerformanceData | null;
  isLoading: boolean;
  errorMessage: string | null;
  onRefresh: () => void;
}

function toAmount(value: string | number | null | undefined): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function formatCurrency(value: string | number, currency = "IDR"): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(toAmount(value));
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

function getStatusLabel(status: BudgetStatus): string {
  switch (status) {
    case "NEAR_LIMIT":
      return "Mendekati batas";
    case "OVER_BUDGET":
      return "Melebihi anggaran";
    default:
      return "Dalam batas";
  }
}

export function BudgetPerformanceSection({
  performance,
  isLoading,
  errorMessage,
  onRefresh,
}: BudgetPerformanceSectionProps) {
  const budgets = useMemo(
    () => performance?.budgets ?? [],
    [performance?.budgets],
  );
  const currency = performance?.currency ?? "IDR";

  const totals = useMemo(
    () => ({
      budget:
        performance?.totalBudgetAmount !== undefined
          ? toAmount(performance.totalBudgetAmount)
          : budgets.reduce((sum, item) => sum + toAmount(item.budgetAmount), 0),
      spent:
        performance?.totalActualAmount !== undefined
          ? toAmount(performance.totalActualAmount)
          : budgets.reduce((sum, item) => sum + toAmount(item.actualAmount), 0),
      remaining:
        performance?.totalRemainingAmount !== undefined
          ? toAmount(performance.totalRemainingAmount)
          : budgets.reduce(
              (sum, item) => sum + toAmount(item.remainingAmount),
              0,
            ),
    }),
    [budgets, performance],
  );

  return (
    <section
      className="budget-performance"
      aria-labelledby="budget-performance-title"
      aria-busy={isLoading}
    >
      <div className="budget-performance-heading">
        <div>
          <span className="eyebrow">BUDGET MANAGEMENT</span>
          <h2 id="budget-performance-title">Performa anggaran</h2>
          <p>
            Pantau pemakaian anggaran berdasarkan periode analitik yang dipilih.
          </p>
        </div>
        <button
          className="budget-refresh-button"
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <span aria-hidden="true">{isLoading ? "…" : "↻"}</span>
          {isLoading ? "Memuat..." : "Perbarui"}
        </button>
      </div>

      {errorMessage ? (
        <div className="budget-error" role="alert">
          <div>
            <strong>Performa anggaran belum tersedia</strong>
            <p>{errorMessage}</p>
          </div>
          <button type="button" onClick={onRefresh} disabled={isLoading}>
            Coba lagi
          </button>
        </div>
      ) : isLoading && !performance ? (
        <div className="budget-loading" role="status">
          <span />
          <span />
          <span />
          <p>Memuat performa anggaran...</p>
        </div>
      ) : budgets.length === 0 ? (
        <div className="budget-empty-state">
          <span className="budget-empty-icon" aria-hidden="true">
            ◫
          </span>
          <strong>Belum ada data anggaran pada periode ini</strong>
          <p>
            Anggaran dan pemakaiannya akan muncul di sini ketika terdapat data
            yang sesuai dengan periode analitik terpilih.
          </p>
        </div>
      ) : (
        <>
          <div className="budget-summary-grid">
            <article className="budget-summary-card">
              <span>Total anggaran</span>
              <strong>{formatCurrency(totals.budget, currency)}</strong>
              <small>{formatNumber(budgets.length)} anggaran</small>
            </article>
            <article className="budget-summary-card budget-summary-card--spent">
              <span>Total digunakan</span>
              <strong>{formatCurrency(totals.spent, currency)}</strong>
              <small>Akumulasi pemakaian periode terpilih</small>
            </article>
            <article className="budget-summary-card budget-summary-card--remaining">
              <span>Total sisa anggaran</span>
              <strong>{formatCurrency(totals.remaining, currency)}</strong>
              <small>Akumulasi sisa per anggaran</small>
            </article>
          </div>

          <div className="budget-list">
            {budgets.map((budget) => {
              const usage = Math.max(0, toAmount(budget.usagePercentage));
              const barWidth = Math.min(100, usage);
              const statusClass =
                budget.status === "OVER_BUDGET"
                  ? "over"
                  : budget.status === "NEAR_LIMIT"
                    ? "near"
                    : "on-track";

              return (
                <article className="budget-item" key={budget.budgetId}>
                  <div className="budget-item-top">
                    <div className="budget-item-name">
                      <strong>{budget.budgetName}</strong>
                      <span>{budget.categoryName || "Semua kategori"}</span>
                    </div>
                    <span
                      className={`budget-status budget-status--${statusClass}`}
                    >
                      {getStatusLabel(budget.status)}
                    </span>
                  </div>
                  <div className="budget-item-amounts">
                    <div>
                      <span>Digunakan</span>
                      <strong>
                        {formatCurrency(budget.actualAmount, currency)}
                      </strong>
                    </div>
                    <div>
                      <span>Anggaran</span>
                      <strong>
                        {formatCurrency(budget.budgetAmount, currency)}
                      </strong>
                    </div>
                  </div>
                  <div className="budget-progress-heading">
                    <span>Penggunaan anggaran</span>
                    <strong>
                      {usage.toLocaleString("id-ID", {
                        maximumFractionDigits: 1,
                      })}
                      %
                    </strong>
                  </div>
                  <div
                    className="budget-progress-track"
                    role="progressbar"
                    aria-label={`Penggunaan anggaran ${budget.budgetName}`}
                    aria-valuemin={0}
                    aria-valuemax={Math.max(100, usage)}
                    aria-valuenow={usage}
                  >
                    <div
                      className={`budget-progress-fill budget-progress-fill--${statusClass}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <div className="budget-item-footer">
                    <span>
                      Sisa: {formatCurrency(budget.remainingAmount, currency)}
                    </span>
                    <span>
                      {formatNumber(budget.transactionCount)} transaksi
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

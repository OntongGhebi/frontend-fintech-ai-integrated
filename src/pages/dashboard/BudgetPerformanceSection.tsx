import type {
  DashboardBudgetPerformanceResponse,
  DashboardBudgetPerformanceItem,
  BudgetStatus,
} from "../../types/dashboard";
import "./BudgetPerformanceSection.css";

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

function getUsagePercentage(value: string | number): number {
  return Math.max(0, toAmount(value));
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

interface BudgetPerformanceSectionProps {
  performance: DashboardBudgetPerformanceResponse | null;
  isLoading: boolean;
  errorMessage: string | null;
  onRefresh: () => void;
}

export function BudgetPerformanceSection({
  performance,
  isLoading,
  errorMessage,
  onRefresh,
}: BudgetPerformanceSectionProps) {
  const budgets: DashboardBudgetPerformanceItem[] = performance?.budgets ?? [];
  const totalBudget = toAmount(performance?.totalBudgetAmount);

  const totalSpent = toAmount(performance?.totalActualAmount);

  const totalRemaining = toAmount(performance?.totalRemainingAmount);

  const budgetCount = budgets.length;

  return (
    <section
      className="budget-performance"
      aria-labelledby="budget-performance-title"
    >
      <div className="budget-performance-heading">
        <div>
          <span className="eyebrow">BUDGET MANAGEMENT</span>
          <h2 id="budget-performance-title">Performa anggaran</h2>
          <p>
            Pantau pemakaian anggaran dan identifikasi anggaran yang perlu
            mendapat perhatian.
          </p>
        </div>

        <button
          className="budget-refresh-button"
          type="button"
          onClick={() => {
            onRefresh();
          }}
          disabled={isLoading}
        >
          <span aria-hidden="true">{isLoading ? "…" : "↻"}</span>
          {isLoading ? "Memuat..." : "Perbarui"}
        </button>
      </div>

      {errorMessage && (
        <div className="budget-error" role="alert">
          <div>
            <strong>Performa anggaran belum tersedia</strong>
            <p>{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onRefresh();
            }}
            disabled={isLoading}
          >
            Coba lagi
          </button>
        </div>
      )}

      {isLoading && budgets.length === 0 && !errorMessage ? (
        <div className="budget-loading" role="status">
          <span />
          <span />
          <span />
          <p>Memuat performa anggaran...</p>
        </div>
      ) : !errorMessage && budgetCount === 0 ? (
        <div className="budget-empty-state">
          <span className="budget-empty-icon" aria-hidden="true">
            ◫
          </span>
          <strong>Belum ada anggaran</strong>
          <p>
            Anggaran yang telah dibuat akan muncul di sini, lengkap dengan
            pemakaian dan sisa anggarannya.
          </p>
        </div>
      ) : (
        !errorMessage && (
          <>
            <div className="budget-summary-grid">
              <article className="budget-summary-card">
                <span>Total anggaran</span>
                <strong>
                  {formatCurrency(totalBudget, performance?.currency ?? "IDR")}
                </strong>
                <small>{formatNumber(budgetCount)} anggaran</small>
              </article>

              <article className="budget-summary-card budget-summary-card--spent">
                <span>Total digunakan</span>
                <strong>
                  {formatCurrency(totalSpent, performance?.currency ?? "IDR")}
                </strong>
                <small>Akumulasi pemakaian</small>
              </article>

              <article className="budget-summary-card budget-summary-card--remaining">
                <span>Total sisa anggaran</span>
                <strong>
                  {formatCurrency(
                    totalRemaining,
                    performance?.currency ?? "IDR",
                  )}
                </strong>
                <small>Akumulasi sisa per anggaran</small>
              </article>
            </div>

            <div className="budget-list">
              {budgets.map((budget) => {
                const usage = getUsagePercentage(budget.usagePercentage);
                const barWidth = Math.min(100, usage);
                const status = budget.status;
                const statusClass =
                  status === "OVER_BUDGET"
                    ? "over"
                    : status === "NEAR_LIMIT"
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
                        {getStatusLabel(status)}
                      </span>
                    </div>

                    <div className="budget-item-amounts">
                      <div>
                        <span>Digunakan</span>
                        <strong>
                          {formatCurrency(
                            budget.actualAmount,
                            performance?.currency ?? "IDR",
                          )}
                        </strong>
                      </div>
                      <div>
                        <span>Anggaran</span>
                        <strong>
                          {formatCurrency(
                            budget.budgetAmount,
                            performance?.currency ?? "IDR",
                          )}
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
                        Sisa:{" "}
                        {formatCurrency(
                          budget.remainingAmount,
                          performance?.currency ?? "IDR",
                        )}
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
        )
      )}
    </section>
  );
}

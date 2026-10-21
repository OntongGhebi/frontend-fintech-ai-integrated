import { useCallback, useEffect, useState } from "react";

import { ApiRequestError, apiClient } from "../../lib/api-client";
import "./BudgetPerformanceSection.css";

type BudgetStatus = "ON_TRACK" | "NEAR_LIMIT" | "OVER_BUDGET";

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
  status: BudgetStatus;
}

interface BudgetPerformanceResponse {
  budgets?: BudgetPerformanceItem[];
  items?: BudgetPerformanceItem[];
  data?:
    | BudgetPerformanceItem[]
    | {
        budgets?: BudgetPerformanceItem[];
        items?: BudgetPerformanceItem[];
      };
}

function toAmount(value: string | number | null | undefined): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function formatCurrency(value: string | number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
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

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return "Tidak dapat terhubung ke backend. Pastikan server API aktif.";
    }

    return error.message || "Data performa anggaran gagal dimuat.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Terjadi kesalahan saat memuat performa anggaran.";
}

/**
 * Supports the common array and envelope forms without silently
 * treating an unknown response structure as an empty budget list.
 */
function parseBudgetPerformance(
  response: BudgetPerformanceItem[] | BudgetPerformanceResponse,
): BudgetPerformanceItem[] {
  if (Array.isArray(response)) {
    return response;
  }

  const data = response.data;

  if (Array.isArray(data)) {
    return data;
  }

  if (data && !Array.isArray(data)) {
    if (Array.isArray(data.budgets)) return data.budgets;
    if (Array.isArray(data.items)) return data.items;
  }

  if (Array.isArray(response.budgets)) return response.budgets;
  if (Array.isArray(response.items)) return response.items;

  throw new Error("Format respons performa anggaran tidak sesuai kontrak API.");
}

export function BudgetPerformanceSection() {
  const [budgets, setBudgets] = useState<BudgetPerformanceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadBudgets = useCallback(async () => {
    try {
      const response = await apiClient.get<
        BudgetPerformanceItem[] | BudgetPerformanceResponse
      >("/dashboard/budgets/performance");

      const items = parseBudgetPerformance(response);

      const validItems = items.filter(
        (item) =>
          typeof item.budgetId === "string" &&
          typeof item.budgetName === "string",
      );

      setErrorMessage(null);
      setBudgets(validItems);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadBudgets();
    });

    return () => window.clearTimeout(timeoutId);
  }, [loadBudgets, reloadKey]);

  const totalBudget = budgets.reduce(
    (total, item) => total + toAmount(item.budgetAmount),
    0,
  );

  const totalSpent = budgets.reduce(
    (total, item) => total + toAmount(item.actualAmount),
    0,
  );

  const totalRemaining = budgets.reduce(
    (total, item) => total + toAmount(item.remainingAmount),
    0,
  );

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
            setIsLoading(true);
            setErrorMessage(null);
            setReloadKey((current) => current + 1);
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
              setIsLoading(true);
              setErrorMessage(null);
              setReloadKey((current) => current + 1);
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
                <strong>{formatCurrency(totalBudget)}</strong>
                <small>{formatNumber(budgetCount)} anggaran</small>
              </article>

              <article className="budget-summary-card budget-summary-card--spent">
                <span>Total digunakan</span>
                <strong>{formatCurrency(totalSpent)}</strong>
                <small>Akumulasi pemakaian</small>
              </article>

              <article className="budget-summary-card budget-summary-card--remaining">
                <span>Total sisa anggaran</span>
                <strong>{formatCurrency(totalRemaining)}</strong>
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
                        <strong>{formatCurrency(budget.actualAmount)}</strong>
                      </div>
                      <div>
                        <span>Anggaran</span>
                        <strong>{formatCurrency(budget.budgetAmount)}</strong>
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
                        Sisa: {formatCurrency(budget.remainingAmount)}
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

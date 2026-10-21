import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "../../lib/api-client";
import "./CashFlowAnalyticsSection.css";

type CashFlowPeriod = "DAY" | "WEEK" | "MONTH" | "YEAR";

interface CashFlowItem {
  period: string;
  income: string;
  expense: string;
  netCashFlow: string;
  transactionCount: number;
}

interface CashFlowResponse {
  currency: string;
  startDate: string;
  endDate: string;
  period: CashFlowPeriod;
  cashFlows: CashFlowItem[];
  totalIncome: string;
  totalExpense: string;
  totalNetCashFlow: string;
  totalTransactionCount: number;
}

interface DashboardOverviewResponse {
  cashFlow: CashFlowResponse;
}

function unwrapResponse(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;

  if ("cashFlow" in record) {
    return record;
  }

  if ("data" in record) {
    const data = record.data;

    if (
      data &&
      typeof data === "object" &&
      "cashFlow" in (data as Record<string, unknown>)
    ) {
      return data;
    }
  }

  return value;
}

function isCashFlowItem(value: unknown): value is CashFlowItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;

  return (
    typeof item.period === "string" &&
    (typeof item.income === "string" || typeof item.income === "number") &&
    (typeof item.expense === "string" || typeof item.expense === "number") &&
    (typeof item.netCashFlow === "string" ||
      typeof item.netCashFlow === "number") &&
    typeof item.transactionCount === "number"
  );
}

function parseCashFlow(value: unknown): CashFlowResponse | null {
  const unwrapped = unwrapResponse(value);

  if (!unwrapped || typeof unwrapped !== "object") {
    return null;
  }

  const root = unwrapped as Record<string, unknown>;
  const candidate = root.cashFlow;

  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const data = candidate as Record<string, unknown>;

  if (
    !Array.isArray(data.cashFlows) ||
    !data.cashFlows.every(isCashFlowItem) ||
    typeof data.currency !== "string" ||
    typeof data.period !== "string" ||
    (typeof data.totalIncome !== "string" &&
      typeof data.totalIncome !== "number") ||
    (typeof data.totalExpense !== "string" &&
      typeof data.totalExpense !== "number") ||
    (typeof data.totalNetCashFlow !== "string" &&
      typeof data.totalNetCashFlow !== "number") ||
    typeof data.totalTransactionCount !== "number"
  ) {
    return null;
  }

  return {
    currency: data.currency,
    startDate: typeof data.startDate === "string" ? data.startDate : "",
    endDate: typeof data.endDate === "string" ? data.endDate : "",
    period: data.period as CashFlowPeriod,
    cashFlows: data.cashFlows,
    totalIncome: String(data.totalIncome),
    totalExpense: String(data.totalExpense),
    totalNetCashFlow: String(data.totalNetCashFlow),
    totalTransactionCount: data.totalTransactionCount,
  };
}

function toNumber(value: string | number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: string | number, currency = "IDR"): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatPeriod(value: string, period: CashFlowPeriod): string {
  if (period === "YEAR") {
    return value;
  }

  if (period === "MONTH" && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-").map(Number);

    return new Intl.DateTimeFormat("id-ID", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, 1)));
  }

  const parsed = new Date(value);

  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(parsed);
  }

  return value;
}

function formatPeriodName(period: CashFlowPeriod): string {
  const labels: Record<CashFlowPeriod, string> = {
    DAY: "Harian",
    WEEK: "Mingguan",
    MONTH: "Bulanan",
    YEAR: "Tahunan",
  };

  return labels[period] ?? "Berkala";
}

function formatDateRange(startDate: string, endDate: string): string {
  if (!startDate || !endDate) {
    return "Ringkasan arus kas";
  }

  const formatDate = (value: string) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  };

  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

function CashFlowLegend() {
  return (
    <div className="cash-flow-legend">
      <span>
        <i className="cash-flow-legend__dot cash-flow-legend__dot--income" />
        Pemasukan
      </span>
      <span>
        <i className="cash-flow-legend__dot cash-flow-legend__dot--expense" />
        Pengeluaran
      </span>
    </div>
  );
}

export function CashFlowAnalyticsSection() {
  const [cashFlow, setCashFlow] = useState<CashFlowResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCashFlow = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<DashboardOverviewResponse>(
        "/dashboard/overview",
      );

      const parsed = parseCashFlow(response);

      if (!parsed) {
        throw new Error(
          "Format data arus kas dari server tidak sesuai dengan kontrak yang diharapkan.",
        );
      }

      setCashFlow(parsed);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memuat analisis arus kas.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCashFlow();
  }, [loadCashFlow]);

  const chartMaximum = useMemo(() => {
    if (!cashFlow?.cashFlows.length) {
      return 0;
    }

    return Math.max(
      0,
      ...cashFlow.cashFlows.flatMap((item) => [
        toNumber(item.income),
        toNumber(item.expense),
      ]),
    );
  }, [cashFlow]);

  if (loading) {
    return (
      <section
        className="cash-flow-section"
        aria-labelledby="cash-flow-title"
        aria-busy="true"
      >
        <div className="cash-flow-section__header">
          <div>
            <p className="cash-flow-section__eyebrow">ANALISIS KEUANGAN</p>
            <h2 id="cash-flow-title">Cash flow</h2>
            <p className="cash-flow-section__subtitle">
              Memuat analisis pemasukan dan pengeluaran...
            </p>
          </div>
        </div>

        <div className="cash-flow-loading" role="status">
          <span className="cash-flow-loading__spinner" />
          Memuat data arus kas
        </div>
      </section>
    );
  }

  if (error || !cashFlow) {
    return (
      <section className="cash-flow-section" aria-labelledby="cash-flow-title">
        <div className="cash-flow-section__header">
          <div>
            <p className="cash-flow-section__eyebrow">ANALISIS KEUANGAN</p>
            <h2 id="cash-flow-title">Cash flow</h2>
          </div>
        </div>

        <div className="cash-flow-feedback cash-flow-feedback--error">
          <span className="cash-flow-feedback__icon" aria-hidden="true">
            !
          </span>
          <div>
            <h3>Analisis arus kas belum tersedia</h3>
            <p>{error ?? "Data arus kas tidak dapat ditampilkan."}</p>
            <button
              type="button"
              className="cash-flow-button"
              onClick={() => void loadCashFlow()}
            >
              Coba lagi
            </button>
          </div>
        </div>
      </section>
    );
  }

  const hasTransactions = cashFlow.cashFlows.some(
    (item) => item.transactionCount > 0,
  );

  return (
    <section className="cash-flow-section" aria-labelledby="cash-flow-title">
      <div className="cash-flow-section__header">
        <div>
          <p className="cash-flow-section__eyebrow">ANALISIS KEUANGAN</p>
          <h2 id="cash-flow-title">Cash flow</h2>
          <p className="cash-flow-section__subtitle">
            Perbandingan pemasukan dan pengeluaran per periode.
          </p>
          <p className="cash-flow-section__date">
            {formatDateRange(cashFlow.startDate, cashFlow.endDate)}
          </p>
        </div>

        <button
          type="button"
          className="cash-flow-refresh"
          onClick={() => void loadCashFlow()}
          aria-label="Muat ulang analisis arus kas"
          title="Muat ulang"
        >
          <span aria-hidden="true">↻</span>
          <span>Muat ulang</span>
        </button>
      </div>

      <div className="cash-flow-summary">
        <article className="cash-flow-summary__card">
          <div className="cash-flow-summary__label">
            <span className="cash-flow-summary__icon cash-flow-summary__icon--income">
              ↗
            </span>
            Total pemasukan
          </div>
          <p className="cash-flow-summary__amount cash-flow-summary__amount--income">
            {formatCurrency(cashFlow.totalIncome, cashFlow.currency)}
          </p>
        </article>

        <article className="cash-flow-summary__card">
          <div className="cash-flow-summary__label">
            <span className="cash-flow-summary__icon cash-flow-summary__icon--expense">
              ↘
            </span>
            Total pengeluaran
          </div>
          <p className="cash-flow-summary__amount cash-flow-summary__amount--expense">
            {formatCurrency(cashFlow.totalExpense, cashFlow.currency)}
          </p>
        </article>

        <article className="cash-flow-summary__card cash-flow-summary__card--net">
          <div className="cash-flow-summary__label">
            <span className="cash-flow-summary__icon cash-flow-summary__icon--net">
              ∑
            </span>
            Arus kas bersih
          </div>
          <p
            className={`cash-flow-summary__amount ${
              toNumber(cashFlow.totalNetCashFlow) >= 0
                ? "cash-flow-summary__amount--income"
                : "cash-flow-summary__amount--expense"
            }`}
          >
            {formatCurrency(cashFlow.totalNetCashFlow, cashFlow.currency)}
          </p>
          <span className="cash-flow-summary__hint">
            {toNumber(cashFlow.totalNetCashFlow) >= 0
              ? "Pemasukan lebih besar atau sama dengan pengeluaran"
              : "Pengeluaran lebih besar daripada pemasukan"}
          </span>
        </article>
      </div>

      <div className="cash-flow-chart">
        <div className="cash-flow-chart__header">
          <div>
            <h3>Pergerakan arus kas</h3>
            <p>
              {formatPeriodName(cashFlow.period)} · {cashFlow.cashFlows.length}{" "}
              periode
            </p>
          </div>
          <CashFlowLegend />
        </div>

        {!hasTransactions ? (
          <div className="cash-flow-empty">
            <span className="cash-flow-empty__icon" aria-hidden="true">
              ↗
            </span>
            <h3>Belum ada aktivitas keuangan</h3>
            <p>
              Grafik akan menampilkan perbandingan arus kas setelah transaksi
              tersedia.
            </p>
          </div>
        ) : (
          <div className="cash-flow-chart__rows">
            {cashFlow.cashFlows.map((item) => {
              const income = toNumber(item.income);
              const expense = toNumber(item.expense);
              const net = toNumber(item.netCashFlow);

              const incomeWidth =
                chartMaximum > 0 ? (income / chartMaximum) * 100 : 0;
              const expenseWidth =
                chartMaximum > 0 ? (expense / chartMaximum) * 100 : 0;

              return (
                <article className="cash-flow-period" key={item.period}>
                  <div className="cash-flow-period__top">
                    <div className="cash-flow-period__date">
                      {formatPeriod(item.period, cashFlow.period)}
                    </div>
                    <div className="cash-flow-period__net">
                      <span>Net</span>
                      <strong
                        className={
                          net >= 0 ? "cash-flow-positive" : "cash-flow-negative"
                        }
                      >
                        {formatCurrency(net, cashFlow.currency)}
                      </strong>
                    </div>
                  </div>

                  <div className="cash-flow-period__metric">
                    <div className="cash-flow-period__metric-label">
                      <span>Pemasukan</span>
                      <strong>
                        {formatCurrency(income, cashFlow.currency)}
                      </strong>
                    </div>
                    <div
                      className="cash-flow-bar"
                      role="img"
                      aria-label={`Pemasukan ${formatCurrency(
                        income,
                        cashFlow.currency,
                      )}`}
                    >
                      <span
                        className="cash-flow-bar__fill cash-flow-bar__fill--income"
                        style={{ width: `${incomeWidth}%` }}
                      />
                    </div>
                  </div>

                  <div className="cash-flow-period__metric">
                    <div className="cash-flow-period__metric-label">
                      <span>Pengeluaran</span>
                      <strong>
                        {formatCurrency(expense, cashFlow.currency)}
                      </strong>
                    </div>
                    <div
                      className="cash-flow-bar"
                      role="img"
                      aria-label={`Pengeluaran ${formatCurrency(
                        expense,
                        cashFlow.currency,
                      )}`}
                    >
                      <span
                        className="cash-flow-bar__fill cash-flow-bar__fill--expense"
                        style={{ width: `${expenseWidth}%` }}
                      />
                    </div>
                  </div>

                  <div className="cash-flow-period__footer">
                    <span>{item.transactionCount} transaksi</span>
                    <span
                      className={
                        net >= 0
                          ? "cash-flow-status cash-flow-status--positive"
                          : "cash-flow-status cash-flow-status--negative"
                      }
                    >
                      {net >= 0 ? "Surplus" : "Defisit"}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <footer className="cash-flow-section__footer">
        <span>
          <strong>{cashFlow.totalTransactionCount}</strong> transaksi dalam
          seluruh periode
        </span>
        <span>Semua nilai dalam {cashFlow.currency}</span>
      </footer>
    </section>
  );
}

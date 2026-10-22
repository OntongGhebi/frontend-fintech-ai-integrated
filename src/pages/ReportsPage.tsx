import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  CalendarDays,
  CircleAlert,
  FileBarChart,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { ApiRequestError, apiClient } from "../lib/api-client";
import "./ReportsPage.css";

type TransactionType = "INCOME" | "EXPENSE";

interface ReportSummary {
  currency: string;
  totalIncome: string;
  totalExpense: string;
  netCashFlow: string;
  transactionCount: number;
}

interface ReportPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface ReportTransaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  type: TransactionType;
  amount: string;
  currency: string;
  description: string | null;
  transactionDate: string;
  source: string;
}

interface FinancialReportResponse {
  reportType: "FINANCIAL";
  currency: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  summary: ReportSummary;
  income: {
    currency: string;
    totalIncome: string;
    transactionCount: number;
    averageIncome: string;
  };
  expense: {
    currency: string;
    totalExpense: string;
    transactionCount: number;
    averageExpense: string;
  };
  categoryAnalytics: unknown;
  accountAnalytics: unknown;
  budgetPerformance: unknown;
  recurringPerformance: unknown;
  monthlyFinancialSummary: unknown;
  cashFlow: unknown;
  transactions: {
    data: ReportTransaction[];
    meta: ReportPagination;
  };
}

interface ReportFilters {
  startDate: string;
  endDate: string;
  type: "" | TransactionType;
}

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getInitialFilters(): ReportFilters {
  const now = new Date();

  return {
    startDate: getLocalDateString(
      new Date(now.getFullYear(), now.getMonth(), 1),
    ),
    endDate: getLocalDateString(
      new Date(now.getFullYear(), now.getMonth() + 1, 0),
    ),
    type: "",
  };
}

function getDateBoundary(date: string, boundary: "start" | "end"): string {
  const time = boundary === "start" ? "00:00:00" : "23:59:59.999";

  return `${date}T${time}+07:00`;
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

function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return "Sesi Anda berakhir. Silakan login kembali.";
    }

    if (error.status >= 500) {
      return "Server sedang mengalami kendala. Silakan coba lagi.";
    }

    return error.message || "Laporan tidak dapat dimuat.";
  }

  if (error instanceof TypeError) {
    return "Tidak dapat terhubung ke backend. Periksa koneksi dan konfigurasi API.";
  }

  return "Terjadi kesalahan saat memuat laporan keuangan.";
}

export function ReportsPage() {
  const [filters, setFilters] = useState<ReportFilters>(getInitialFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<ReportFilters>(getInitialFilters);
  const [report, setReport] = useState<FinancialReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (appliedFilters.startDate) {
        params.set(
          "startDate",
          getDateBoundary(appliedFilters.startDate, "start"),
        );
      }

      if (appliedFilters.endDate) {
        params.set("endDate", getDateBoundary(appliedFilters.endDate, "end"));
      }

      if (appliedFilters.type) {
        params.set("type", appliedFilters.type);
      }

      params.set("page", "1");
      params.set("limit", "20");

      const response = await apiClient.get<FinancialReportResponse>(
        `reports/financial?${params.toString()}`,
      );

      setReport(response);
    } catch (loadError) {
      setReport(null);
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    void loadReport();
  }, [loadReport, reloadKey]);

  function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError("");

    if (
      filters.startDate &&
      filters.endDate &&
      filters.startDate > filters.endDate
    ) {
      setValidationError("Tanggal mulai tidak boleh melewati tanggal akhir.");
      return;
    }

    setAppliedFilters({ ...filters });
  }

  function handleResetFilters() {
    const defaults = getInitialFilters();

    setFilters(defaults);
    setAppliedFilters(defaults);
    setValidationError("");
  }

  function handleRetry() {
    setReloadKey((current) => current + 1);
  }

  const summary = report?.summary;
  const currency = report?.currency ?? "IDR";

  const cards = [
    {
      key: "income",
      label: "Total pemasukan",
      value: summary?.totalIncome ?? "0",
      description: `${formatNumber(report?.income.transactionCount ?? 0)} transaksi pemasukan`,
      icon: TrendingUp,
      tone: "income",
    },
    {
      key: "expense",
      label: "Total pengeluaran",
      value: summary?.totalExpense ?? "0",
      description: `${formatNumber(report?.expense.transactionCount ?? 0)} transaksi pengeluaran`,
      icon: TrendingDown,
      tone: "expense",
    },
    {
      key: "net",
      label: "Arus kas bersih",
      value: summary?.netCashFlow ?? "0",
      description: "Pemasukan dikurangi pengeluaran",
      icon: Wallet,
      tone: "net",
    },
  ] as const;

  return (
    <section className="reports-page" aria-labelledby="reports-title">
      <div className="reports-heading">
        <div>
          <span className="reports-eyebrow">FINANCIAL OVERVIEW</span>
          <h2 id="reports-title">Laporan keuangan</h2>
          <p>
            Evaluasi pemasukan, pengeluaran, dan arus kas berdasarkan periode
            yang Anda pilih.
          </p>
        </div>

        <button
          type="button"
          className="reports-refresh-button"
          onClick={handleRetry}
          disabled={isLoading}
        >
          <RefreshCw size={16} aria-hidden="true" />
          <span>{isLoading ? "Memuat..." : "Perbarui laporan"}</span>
        </button>
      </div>

      <form className="reports-filter-panel" onSubmit={handleApplyFilters}>
        <div className="reports-filter-heading">
          <span className="reports-filter-icon" aria-hidden="true">
            <CalendarDays size={19} />
          </span>
          <div>
            <h3>Periode laporan</h3>
            <p>Pilih tanggal dan jenis transaksi yang ingin dianalisis.</p>
          </div>
        </div>

        <div className="reports-filter-fields">
          <label className="reports-field">
            <span>Tanggal mulai</span>
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  startDate: event.target.value,
                }))
              }
            />
          </label>

          <label className="reports-field">
            <span>Tanggal akhir</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  endDate: event.target.value,
                }))
              }
            />
          </label>

          <label className="reports-field">
            <span>Jenis transaksi</span>
            <select
              value={filters.type}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  type: event.target.value as ReportFilters["type"],
                }))
              }
            >
              <option value="">Semua transaksi</option>
              <option value="INCOME">Pemasukan</option>
              <option value="EXPENSE">Pengeluaran</option>
            </select>
          </label>
        </div>

        {validationError && (
          <p className="reports-validation-error" role="alert">
            {validationError}
          </p>
        )}

        <div className="reports-filter-actions">
          <button
            type="button"
            className="reports-button-secondary"
            onClick={handleResetFilters}
          >
            Reset filter
          </button>
          <button
            type="submit"
            className="reports-button-primary"
            disabled={isLoading}
          >
            Terapkan filter
          </button>
        </div>
      </form>

      {error && (
        <div className="reports-error" role="alert">
          <CircleAlert size={21} aria-hidden="true" />
          <div>
            <strong>Laporan belum tersedia</strong>
            <p>{error}</p>
            <button type="button" onClick={handleRetry}>
              Coba lagi
            </button>
          </div>
        </div>
      )}

      <div className="reports-section-heading">
        <div>
          <span className="reports-eyebrow">REPORT SUMMARY</span>
          <h3>Ringkasan finansial</h3>
        </div>

        {report && (
          <span className="reports-period-chip">
            {formatDate(report.startDate)} – {formatDate(report.endDate)}
          </span>
        )}
      </div>

      <div
        className="reports-summary-grid"
        aria-label="Ringkasan laporan keuangan"
        aria-busy={isLoading}
      >
        {cards.map((card) => {
          const Icon = card.icon;
          const amount = Number(card.value);
          const isNegative = card.key === "net" && amount < 0;

          return (
            <article
              key={card.key}
              className={`reports-summary-card reports-summary-card--${card.tone}`}
            >
              <div className="reports-summary-card-top">
                <span>{card.label}</span>
                <span className="reports-summary-icon">
                  <Icon size={20} aria-hidden="true" />
                </span>
              </div>

              <strong className="reports-summary-value">
                {isLoading && !report
                  ? "Memuat..."
                  : formatCurrency(card.value, currency)}
              </strong>

              <p>{card.description}</p>

              {isNegative && (
                <span className="reports-negative-note">
                  Pengeluaran melebihi pemasukan pada periode ini.
                </span>
              )}
            </article>
          );
        })}
      </div>

      <section className="reports-detail-panel">
        <div className="reports-detail-heading">
          <span className="reports-detail-icon" aria-hidden="true">
            <FileBarChart size={21} />
          </span>
          <div>
            <h3>Ikhtisar aktivitas</h3>
            <p>Jumlah transaksi yang tercatat pada periode laporan.</p>
          </div>
        </div>

        {isLoading && !report ? (
          <div className="reports-loading" role="status">
            Sedang memuat laporan keuangan...
          </div>
        ) : report ? (
          <>
            <div className="reports-activity-total">
              <strong>{formatNumber(report.summary.transactionCount)}</strong>
              <span>Transaksi pada periode terpilih</span>
            </div>

            <div className="reports-activity-breakdown">
              <div>
                <span className="reports-breakdown-dot reports-breakdown-dot--income" />
                <span>Pemasukan</span>
                <strong>{formatNumber(report.income.transactionCount)}</strong>
              </div>
              <div>
                <span className="reports-breakdown-dot reports-breakdown-dot--expense" />
                <span>Pengeluaran</span>
                <strong>{formatNumber(report.expense.transactionCount)}</strong>
              </div>
            </div>

            {report.summary.transactionCount === 0 && (
              <div className="reports-empty-state">
                <FileBarChart size={25} aria-hidden="true" />
                <strong>Belum ada transaksi pada periode ini</strong>
                <p>
                  Coba pilih rentang tanggal lain atau catat transaksi baru
                  untuk mulai melihat laporan keuangan.
                </p>
              </div>
            )}

            <div className="reports-generated-at">
              Laporan dibuat pada {formatDateTime(report.generatedAt)}
            </div>
          </>
        ) : !error ? (
          <div className="reports-empty-state">
            <strong>Data laporan belum tersedia.</strong>
          </div>
        ) : null}
      </section>
    </section>
  );
}

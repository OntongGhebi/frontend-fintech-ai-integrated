import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  HeartPulse,
  Lightbulb,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { ApiRequestError, apiClient } from "../lib/api-client";
import "./FinancialWellBeingPage.css";

type CashFlowStatus = "POSITIVE" | "NEGATIVE" | "BREAK_EVEN" | "NO_INCOME_DATA";
type SignalSeverity = "INFO" | "WARNING" | "CRITICAL";
type RecommendationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "DEFERRED"
  | "APPLIED"
  | "EVALUATED";

interface FinancialSignal {
  code: string;
  severity: SignalSeverity;
  title: string;
  description: string;
}

interface TopCategory {
  categoryId: string;
  categoryName: string;
  totalAmount: string | number;
  transactionCount: number;
  percentage: string | number;
}

interface FinancialTrend {
  direction: "INCREASED" | "DECREASED" | "UNCHANGED" | "INSUFFICIENT_DATA";
  previousPeriod: string | null;
  currentPeriod: string | null;
  previousAmount: string | null;
  currentAmount: string | null;
  changeAmount: string | null;
  changePercentage: number | null;
}

interface MonthlyTrendItem {
  month: string;
  income: string | number;
  expense: string | number;
  netCashFlow: string | number;
  transactionCount: number;
  savingsRate: string | number;
}

interface FinancialAnalysis {
  period: { startDate: string; endDate: string };
  summary: {
    totalIncome: string | number;
    totalExpense: string | number;
    netCashFlow: string | number;
    transactionCount: number;
    savingsRate: string | number | null;
    expenseToIncomeRatio: string | number | null;
    cashFlowStatus: CashFlowStatus;
  };
  spendingPatterns: {
    totalExpense: string | number;
    transactionCount: number;
    topCategories: TopCategory[];
    topCategoryConcentration: string | number;
  };
  budgetHealth: {
    totalAllocation: string | number;
    totalSpent: string | number;
    remaining: string | number;
    utilizationPercentage: string | number | null;
    budgetCount: number;
    onTrackCount: number;
    nearLimitCount: number;
    overBudgetCount: number;
  };
  trends: {
    monthly: MonthlyTrendItem[];
    income: FinancialTrend;
    expense: FinancialTrend;
    netCashFlow: FinancialTrend;
  };
  signals: FinancialSignal[];
}

interface RecommendationAction {
  id: string;
  budgetId: string;
  targetMonth: string;
  currentAllocation: string | number;
  proposedAllocation: string | number;
  changeAmount: string | number;
  changePercentage: string | number;
  action: "INCREASE" | "DECREASE" | "MAINTAIN" | "REVIEW" | string;
  status: RecommendationStatus;
  reason: string;
  deferredUntil?: string | null;
  createdAt: string;
}

interface WellBeingResponse {
  generatedAt: string;
  currency: string;
  period: { month: string; startDate: string; endDate: string };
  analysis: FinancialAnalysis;
  recommendations: {
    targetMonth: string;
    total: number;
    statusCounts: Array<{ status: RecommendationStatus; count: number }>;
    actionCenter: RecommendationAction[];
  };
  dataSufficiency: {
    level: "SUFFICIENT" | "LIMITED" | "INSUFFICIENT" | string;
    transactionCount: number;
    budgetCount: number;
    messages: string[];
  };
}

function getCurrentMonth(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return year && month ? `${year}-${month}` : "";
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

function formatPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const amount = toAmount(value);
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(amount)}%`;
}

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return month;
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(year, monthNumber - 1, 1));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return "Server belum dapat dijangkau. Pastikan backend aktif dan koneksi Anda tersedia.";
    }
    if (error.status === 401) {
      return "Sesi Anda berakhir. Silakan login kembali.";
    }
    if (error.status === 403) {
      return "Anda tidak memiliki izin untuk melihat data Financial Well-being ini.";
    }
    if (error.status === 404) {
      return "Data Financial Well-being belum tersedia untuk periode yang dipilih.";
    }
    if (error.status === 429) {
      return "Terlalu banyak permintaan. Tunggu sebentar sebelum mencoba kembali.";
    }
    if (error.status >= 500) {
      return "Layanan sedang mengalami kendala. Silakan coba lagi beberapa saat.";
    }
    return error.message || "Data Financial Well-being tidak dapat dimuat.";
  }
  if (error instanceof TypeError) {
    return "Tidak dapat terhubung ke server. Periksa koneksi Anda.";
  }
  return "Terjadi kesalahan saat memuat Financial Well-being.";
}

function getCashFlowLabel(status: CashFlowStatus): string {
  switch (status) {
    case "POSITIVE":
      return "Arus kas positif";
    case "NEGATIVE":
      return "Arus kas negatif";
    case "BREAK_EVEN":
      return "Arus kas seimbang";
    default:
      return "Belum ada data pemasukan";
  }
}

function getTrendLabel(direction: FinancialTrend["direction"]): string {
  switch (direction) {
    case "INCREASED":
      return "Meningkat";
    case "DECREASED":
      return "Menurun";
    case "UNCHANGED":
      return "Stabil";
    default:
      return "Data belum cukup";
  }
}

function getSeverityLabel(severity: SignalSeverity): string {
  if (severity === "CRITICAL") return "Perlu perhatian";
  if (severity === "WARNING") return "Perlu dipantau";
  return "Informasi";
}

function getActionLabel(action: string): string {
  switch (action) {
    case "INCREASE":
      return "Tambah alokasi";
    case "DECREASE":
      return "Kurangi alokasi";
    case "MAINTAIN":
      return "Pertahankan";
    default:
      return "Tinjau kembali";
  }
}

function getStatusLabel(status: RecommendationStatus): string {
  switch (status) {
    case "PENDING":
      return "Menunggu tinjauan";
    case "ACCEPTED":
      return "Disetujui";
    case "REJECTED":
      return "Ditolak";
    case "DEFERRED":
      return "Ditunda";
    case "APPLIED":
      return "Diterapkan";
    case "EVALUATED":
      return "Dievaluasi";
    default:
      return "Status rekomendasi";
  }
}

export function FinancialWellBeingPage() {
  const [month, setMonth] = useState(getCurrentMonth);
  const [data, setData] = useState<WellBeingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const requestSequenceRef = useRef(0);

  const loadData = useCallback(async () => {
    const requestSequence = ++requestSequenceRef.current;
    setIsLoading(true);
    setError("");

    try {
      const response = await apiClient.get<WellBeingResponse>(
        `/financial-analysis/well-being?month=${encodeURIComponent(month)}`,
      );

      if (requestSequence !== requestSequenceRef.current) return;
      setData(response);
    } catch (loadError) {
      if (requestSequence !== requestSequenceRef.current) return;
      setError(getErrorMessage(loadError));
      setData(null);
    } finally {
      if (requestSequence === requestSequenceRef.current) {
        setIsLoading(false);
      }
    }
  }, [month]);

  useEffect(() => {
    void loadData();

    return () => {
      requestSequenceRef.current += 1;
    };
  }, [loadData]);

  const analysis = data?.analysis;
  const summary = analysis?.summary;
  const budgetHealth = analysis?.budgetHealth;
  const recommendations = data?.recommendations;
  const topCategories = analysis?.spendingPatterns.topCategories ?? [];
  const signals = analysis?.signals ?? [];
  const pendingRecommendations = useMemo(
    () =>
      (recommendations?.actionCenter ?? []).filter(
        (item) => item.status === "PENDING",
      ),
    [recommendations],
  );
  const categoryMax = Math.max(
    ...topCategories.map((item) => toAmount(item.totalAmount)),
    1,
  );
  const monthlyTrend = analysis?.trends.monthly.slice(-6) ?? [];
  const monthlyMax = Math.max(
    ...monthlyTrend.flatMap((item) => [
      toAmount(item.income),
      toAmount(item.expense),
    ]),
    1,
  );

  return (
    <div className="wellbeing-page">
      <section className="wellbeing-intro">
        <div className="wellbeing-intro-icon">
          <HeartPulse size={23} />
        </div>
        <div className="wellbeing-intro-copy">
          <span className="wellbeing-eyebrow">FINANCIAL WELL-BEING</span>
          <h2>Pahami kondisi keuangan, tentukan langkah berikutnya.</h2>
          <p>
            Ringkasan kesehatan arus kas, kebiasaan pengeluaran, dan kondisi
            anggaran dalam satu tempat.
          </p>
        </div>
        <div className="wellbeing-period-control">
          <label htmlFor="wellbeing-month">
            <CalendarDays size={16} /> Periode analisis
          </label>
          <input
            id="wellbeing-month"
            type="month"
            value={month}
            max={getCurrentMonth()}
            onChange={(event) => {
              const nextMonth = event.target.value;
              if (nextMonth && nextMonth <= getCurrentMonth()) {
                setMonth(nextMonth);
              }
            }}
            aria-describedby="wellbeing-period-help"
          />
          <small id="wellbeing-period-help">
            Analisis tersedia hingga bulan berjalan.
          </small>
        </div>
      </section>

      {error && (
        <div className="wellbeing-alert wellbeing-alert-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => void loadData()}>
            Coba lagi
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="wellbeing-state" role="status" aria-live="polite">
          <RefreshCw size={20} className="wellbeing-spin" />
          <span>Memuat analisis keuangan untuk {formatMonth(month)}...</span>
        </div>
      ) : data && analysis && summary && budgetHealth ? (
        <>
          <section className="wellbeing-section-heading">
            <div>
              <span className="wellbeing-eyebrow">OVERVIEW</span>
              <h3>Kondisi keuangan {formatMonth(data.period.month)}</h3>
            </div>
            <span
              className={`wellbeing-health-pill wellbeing-health-${summary.cashFlowStatus.toLowerCase()}`}
            >
              <span />
              {getCashFlowLabel(summary.cashFlowStatus)}
            </span>
          </section>

          <section
            className="wellbeing-metric-grid"
            aria-label="Ringkasan keuangan"
          >
            <article className="wellbeing-metric-card">
              <div className="wellbeing-metric-top">
                <span>Total pemasukan</span>
                <span className="wellbeing-metric-icon income">
                  <ArrowDownRight size={17} />
                </span>
              </div>
              <strong>
                {formatCurrency(summary.totalIncome, data.currency)}
              </strong>
              <small>Seluruh pemasukan pada periode ini</small>
            </article>
            <article className="wellbeing-metric-card">
              <div className="wellbeing-metric-top">
                <span>Total pengeluaran</span>
                <span className="wellbeing-metric-icon expense">
                  <ArrowUpRight size={17} />
                </span>
              </div>
              <strong>
                {formatCurrency(summary.totalExpense, data.currency)}
              </strong>
              <small>
                {formatPercent(summary.expenseToIncomeRatio)} dari pemasukan
              </small>
            </article>
            <article className="wellbeing-metric-card">
              <div className="wellbeing-metric-top">
                <span>Arus kas bersih</span>
                <span className="wellbeing-metric-icon cashflow">
                  <Activity size={17} />
                </span>
              </div>
              <strong
                className={
                  toAmount(summary.netCashFlow) < 0 ? "is-negative" : ""
                }
              >
                {formatCurrency(summary.netCashFlow, data.currency)}
              </strong>
              <small>
                {summary.transactionCount.toLocaleString("id-ID")} transaksi
                tercatat
              </small>
            </article>
            <article className="wellbeing-metric-card">
              <div className="wellbeing-metric-top">
                <span>Tingkat tabungan</span>
                <span className="wellbeing-metric-icon savings">
                  <ShieldCheck size={17} />
                </span>
              </div>
              <strong>{formatPercent(summary.savingsRate)}</strong>
              <small>Proporsi pemasukan yang tersisa</small>
            </article>
          </section>

          <section className="wellbeing-content-grid">
            <article className="wellbeing-panel wellbeing-spending-panel">
              <div className="wellbeing-panel-heading">
                <div>
                  <span className="wellbeing-eyebrow">SPENDING ANALYSIS</span>
                  <h3>Pola pengeluaran</h3>
                  <p>Kategori dengan kontribusi pengeluaran terbesar.</p>
                </div>
                <span className="wellbeing-panel-icon">
                  <Wallet size={19} />
                </span>
              </div>
              {topCategories.length > 0 ? (
                <div className="wellbeing-category-list">
                  {topCategories.slice(0, 5).map((category) => (
                    <div
                      className="wellbeing-category-item"
                      key={category.categoryId}
                    >
                      <div className="wellbeing-category-meta">
                        <strong>{category.categoryName}</strong>
                        <span>
                          {formatCurrency(category.totalAmount, data.currency)}
                        </span>
                      </div>
                      <div className="wellbeing-progress-track">
                        <span
                          style={{
                            width: `${Math.min(100, (toAmount(category.totalAmount) / categoryMax) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="wellbeing-category-foot">
                        <span>{category.transactionCount} transaksi</span>
                        <span>{formatPercent(category.percentage)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="wellbeing-empty-inline">
                  Belum ada pengeluaran yang dapat dianalisis pada periode ini.
                </div>
              )}
              <div className="wellbeing-panel-footnote">
                Konsentrasi kategori terbesar:{" "}
                <strong>
                  {formatPercent(
                    analysis.spendingPatterns.topCategoryConcentration,
                  )}
                </strong>
              </div>
            </article>

            <article className="wellbeing-panel wellbeing-budget-panel">
              <div className="wellbeing-panel-heading">
                <div>
                  <span className="wellbeing-eyebrow">BUDGET HEALTH</span>
                  <h3>Kesehatan anggaran</h3>
                  <p>Perbandingan alokasi dengan realisasi pengeluaran.</p>
                </div>
                <span className="wellbeing-panel-icon">
                  <Activity size={19} />
                </span>
              </div>
              <div className="wellbeing-budget-total">
                <strong>
                  {formatCurrency(budgetHealth.totalSpent, data.currency)}
                </strong>
                <span>
                  dari{" "}
                  {formatCurrency(budgetHealth.totalAllocation, data.currency)}
                </span>
              </div>
              <div className="wellbeing-progress-track wellbeing-budget-progress">
                <span
                  style={{
                    width: `${Math.min(100, Math.max(0, toAmount(budgetHealth.utilizationPercentage)))}%`,
                  }}
                />
              </div>
              <div className="wellbeing-budget-utilization">
                <span>Pemakaian anggaran</span>
                <strong>
                  {formatPercent(budgetHealth.utilizationPercentage)}
                </strong>
              </div>
              <div className="wellbeing-budget-stats">
                <div>
                  <span className="dot dot-safe" />
                  <strong>{budgetHealth.onTrackCount}</strong>
                  <small>Aman</small>
                </div>
                <div>
                  <span className="dot dot-warning" />
                  <strong>{budgetHealth.nearLimitCount}</strong>
                  <small>Mendekati batas</small>
                </div>
                <div>
                  <span className="dot dot-danger" />
                  <strong>{budgetHealth.overBudgetCount}</strong>
                  <small>Melebihi batas</small>
                </div>
              </div>
              <div className="wellbeing-budget-remaining">
                <span>Sisa alokasi</span>
                <strong>
                  {formatCurrency(budgetHealth.remaining, data.currency)}
                </strong>
              </div>
            </article>
          </section>

          <section className="wellbeing-panel wellbeing-trends-panel">
            <div className="wellbeing-panel-heading">
              <div>
                <span className="wellbeing-eyebrow">FINANCIAL TRENDS</span>
                <h3>Pergerakan keuangan</h3>
                <p>
                  Perbandingan pemasukan dan pengeluaran dalam beberapa bulan
                  terakhir.
                </p>
              </div>
              <span className="wellbeing-panel-icon">
                <Activity size={19} />
              </span>
            </div>
            {monthlyTrend.length > 0 ? (
              <>
                <div className="wellbeing-trend-legend">
                  <span>
                    <i className="trend-income" />
                    Pemasukan
                  </span>
                  <span>
                    <i className="trend-expense" />
                    Pengeluaran
                  </span>
                </div>
                <div className="wellbeing-monthly-chart">
                  {monthlyTrend.map((item) => (
                    <div className="wellbeing-month-column" key={item.month}>
                      <div className="wellbeing-month-bars">
                        <span
                          className="trend-bar trend-bar-income"
                          style={{
                            height: `${Math.max(3, (toAmount(item.income) / monthlyMax) * 100)}%`,
                          }}
                          title={`Pemasukan ${formatCurrency(item.income, data.currency)}`}
                        />
                        <span
                          className="trend-bar trend-bar-expense"
                          style={{
                            height: `${Math.max(3, (toAmount(item.expense) / monthlyMax) * 100)}%`,
                          }}
                          title={`Pengeluaran ${formatCurrency(item.expense, data.currency)}`}
                        />
                      </div>
                      <small>
                        {new Intl.DateTimeFormat("id-ID", {
                          month: "short",
                          timeZone: "Asia/Jakarta",
                        }).format(
                          new Date(
                            Number(item.month.slice(0, 4)),
                            Number(item.month.slice(5, 7)) - 1,
                            1,
                          ),
                        )}
                      </small>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="wellbeing-empty-inline">
                Belum tersedia data tren bulanan.
              </div>
            )}
            <div className="wellbeing-trend-summary">
              <div>
                <span>Pemasukan</span>
                <strong>
                  {getTrendLabel(analysis.trends.income.direction)}
                </strong>
                <small>
                  {formatPercent(analysis.trends.income.changePercentage)}{" "}
                  dibanding periode sebelumnya
                </small>
              </div>
              <div>
                <span>Pengeluaran</span>
                <strong>
                  {getTrendLabel(analysis.trends.expense.direction)}
                </strong>
                <small>
                  {formatPercent(analysis.trends.expense.changePercentage)}{" "}
                  dibanding periode sebelumnya
                </small>
              </div>
              <div>
                <span>Arus kas bersih</span>
                <strong>
                  {getTrendLabel(analysis.trends.netCashFlow.direction)}
                </strong>
                <small>
                  {formatPercent(analysis.trends.netCashFlow.changePercentage)}{" "}
                  dibanding periode sebelumnya
                </small>
              </div>
            </div>
          </section>

          <section className="wellbeing-panel wellbeing-signals-panel">
            <div className="wellbeing-panel-heading">
              <div>
                <span className="wellbeing-eyebrow">FINANCIAL SIGNALS</span>
                <h3>Hal yang perlu diperhatikan</h3>
                <p>Indikator yang dirangkum dari aktivitas keuangan Anda.</p>
              </div>
              <span className="wellbeing-panel-icon">
                <Lightbulb size={19} />
              </span>
            </div>
            {signals.length > 0 ? (
              <div className="wellbeing-signal-list">
                {signals.map((signal, index) => (
                  <div
                    className={`wellbeing-signal-item severity-${signal.severity.toLowerCase()}`}
                    key={`${signal.code}-${index}`}
                  >
                    <span className="wellbeing-signal-indicator">
                      <CircleHelp size={17} />
                    </span>
                    <div>
                      <div className="wellbeing-signal-title">
                        <strong>{signal.title}</strong>
                        <span>{getSeverityLabel(signal.severity)}</span>
                      </div>
                      <p>{signal.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="wellbeing-empty-inline wellbeing-positive-empty">
                <CheckCircle2 size={18} />
                Belum ada sinyal khusus yang perlu ditindaklanjuti pada periode
                ini.
              </div>
            )}
          </section>

          <section className="wellbeing-panel wellbeing-recommendations-panel">
            <div className="wellbeing-panel-heading">
              <div>
                <span className="wellbeing-eyebrow">NEXT ACTIONS</span>
                <h3>Rekomendasi anggaran</h3>
                <p>
                  Tinjau usulan penyesuaian alokasi untuk periode berikutnya.
                </p>
              </div>
              <span className="wellbeing-next-label">
                {pendingRecommendations.length} menunggu tinjauan
              </span>
            </div>
            {pendingRecommendations.length > 0 ? (
              <div className="wellbeing-recommendation-list">
                {pendingRecommendations.slice(0, 3).map((item) => (
                  <div className="wellbeing-recommendation-item" key={item.id}>
                    <div className="wellbeing-recommendation-main">
                      <strong>{getActionLabel(item.action)}</strong>
                      <span>{item.reason}</span>
                    </div>
                    <div className="wellbeing-recommendation-value">
                      <strong>
                        {formatCurrency(item.proposedAllocation, data.currency)}
                      </strong>
                      <small>Usulan alokasi</small>
                    </div>
                    <span className="wellbeing-status-pill">
                      {getStatusLabel(item.status)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="wellbeing-empty-inline">
                Tidak ada rekomendasi yang menunggu tinjauan saat ini.
              </div>
            )}
          </section>

          <section className="wellbeing-data-note">
            <div>
              <ShieldCheck size={18} />
              <strong>
                Kualitas data:{" "}
                {data.dataSufficiency.level === "SUFFICIENT"
                  ? "Memadai"
                  : data.dataSufficiency.level === "LIMITED"
                    ? "Terbatas"
                    : "Belum mencukupi"}
              </strong>
            </div>
            <p>
              {data.dataSufficiency.messages.length > 0
                ? data.dataSufficiency.messages.join(" ")
                : `Analisis menggunakan ${data.dataSufficiency.transactionCount} transaksi dan ${data.dataSufficiency.budgetCount} anggaran.`}
            </p>
          </section>
          <div className="wellbeing-refresh-row">
            <span>
              Diperbarui{" "}
              {new Intl.DateTimeFormat("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Jakarta",
              }).format(new Date(data.generatedAt))}
            </span>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={isLoading}
              aria-label="Perbarui analisis keuangan"
            >
              <RefreshCw
                size={14}
                className={isLoading ? "wellbeing-spin" : ""}
              />
              {isLoading ? "Memperbarui..." : "Perbarui analisis"}
            </button>
          </div>
        </>
      ) : !error ? (
        <div className="wellbeing-state">
          <CircleHelp size={20} />
          <span>Belum ada data Financial Well-being untuk periode ini.</span>
        </div>
      ) : null}
    </div>
  );
}

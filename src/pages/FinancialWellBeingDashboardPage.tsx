import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CircleHelp,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { ApiRequestError, apiClient } from "../lib/api-client";
import { DashboardPage } from "./DashboardPage";
import "./financial-wellbeing/FinancialWellBeingDashboardPage.css";

type CashFlowStatus = "POSITIVE" | "NEGATIVE" | "BREAK_EVEN" | "NO_INCOME_DATA";
type SignalSeverity = "INFO" | "WARNING" | "CRITICAL";
type RecommendationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "DEFERRED"
  | "APPLIED"
  | "EVALUATED";

type DataSufficiencyLevel = "SUFFICIENT" | "LIMITED" | "INSUFFICIENT";

interface FinancialAnalysisSignal {
  code: string;
  severity: SignalSeverity;
  title: string;
  description: string;
}

interface FinancialWellBeingResponse {
  generatedAt: string;
  currency: string;
  period: {
    month: string;
    startDate: string;
    endDate: string;
  };
  analysis: {
    period: {
      startDate: string;
      endDate: string;
    };
    summary: {
      totalIncome: string;
      totalExpense: string;
      netCashFlow: string;
      transactionCount: number;
      savingsRate: number | null;
      expenseToIncomeRatio: number | null;
      cashFlowStatus: CashFlowStatus;
    };
    spendingPatterns: {
      totalExpense: string;
      transactionCount: number;
      topCategories: Array<{
        categoryId: string;
        categoryName: string;
        totalAmount: string;
        transactionCount: number;
        percentage: number;
      }>;
      topCategoryConcentration: number;
    };
    budgetHealth: {
      totalAllocation: string;
      totalSpent: string;
      remaining: string;
      utilizationPercentage: number | null;
      budgetCount: number;
      onTrackCount: number;
      nearLimitCount: number;
      overBudgetCount: number;
    };
    signals: FinancialAnalysisSignal[];
  };
  recommendations: {
    targetMonth: string;
    total: number;
    statusCounts: Array<{
      status: RecommendationStatus;
      count: number;
    }>;
    actionCenter: Array<{
      id: string;
      budgetId: string;
      targetMonth: string;
      currentAllocation: string;
      proposedAllocation: string;
      changeAmount: string;
      changePercentage: number | null;
      action: "INCREASE" | "DECREASE" | "MAINTAIN" | "REVIEW";
      status: RecommendationStatus;
      reason: string | null;
      deferredUntil: string | null;
      createdAt: string;
    }>;
  };
  dataSufficiency: {
    level: DataSufficiencyLevel;
    transactionCount: number;
    budgetCount: number;
    messages: string[];
  };
}

const STATUS_LABELS: Record<RecommendationStatus, string> = {
  PENDING: "Menunggu keputusan",
  ACCEPTED: "Disetujui",
  REJECTED: "Ditolak",
  DEFERRED: "Ditunda",
  APPLIED: "Diterapkan",
  EVALUATED: "Dievaluasi",
};

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

function formatCurrency(value: string | number, currency = "IDR"): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Belum tersedia";
  }

  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}

function formatMonth(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;

  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(Number(match[1]), Number(match[2]) - 1, 1));
}

function formatAnalysisPeriod(startDate?: string, endDate?: string): string {
  if (!startDate || !endDate) return "Periode analisis";

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Periode analisis";
  }

  const formatter = new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return "Layanan belum dapat dijangkau. Pastikan server aplikasi sedang berjalan.";
    }
    return error.message || "Ringkasan kesehatan keuangan gagal dimuat.";
  }

  return error instanceof Error
    ? error.message
    : "Terjadi kesalahan saat memuat ringkasan kesehatan keuangan.";
}

function getCashFlowPresentation(status: CashFlowStatus) {
  switch (status) {
    case "POSITIVE":
      return {
        label: "Arus kas positif",
        description: "Pemasukan lebih besar daripada pengeluaran.",
        tone: "positive",
        icon: ArrowUpRight,
      };
    case "NEGATIVE":
      return {
        label: "Arus kas negatif",
        description: "Pengeluaran lebih besar daripada pemasukan.",
        tone: "negative",
        icon: ArrowDownRight,
      };
    case "BREAK_EVEN":
      return {
        label: "Arus kas seimbang",
        description: "Pemasukan dan pengeluaran berada pada nilai yang sama.",
        tone: "neutral",
        icon: Activity,
      };
    default:
      return {
        label: "Data pemasukan belum tersedia",
        description: "Belum cukup data untuk menilai arus kas periode ini.",
        tone: "muted",
        icon: CircleHelp,
      };
  }
}

function getSufficiencyPresentation(level: DataSufficiencyLevel) {
  switch (level) {
    case "SUFFICIENT":
      return { label: "Data memadai", tone: "good" };
    case "LIMITED":
      return { label: "Data terbatas", tone: "warning" };
    default:
      return { label: "Data belum mencukupi", tone: "muted" };
  }
}

function getStatusCount(
  counts: FinancialWellBeingResponse["recommendations"]["statusCounts"],
  status: RecommendationStatus,
): number {
  return counts.find((item) => item.status === status)?.count ?? 0;
}

export function FinancialWellBeingDashboardPage() {
  const [wellBeing, setWellBeing] = useState<FinancialWellBeingResponse | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const month = useMemo(() => getCurrentMonthKey(), []);

  useEffect(() => {
    let cancelled = false;

    async function loadWellBeing() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const result = await apiClient.get<FinancialWellBeingResponse>(
          `/financial-analysis/well-being?month=${encodeURIComponent(month)}`,
        );

        if (!cancelled) setWellBeing(result);
      } catch (error) {
        if (!cancelled) setErrorMessage(getErrorMessage(error));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadWellBeing();
    return () => {
      cancelled = true;
    };
  }, [month, reloadKey]);

  const summary = wellBeing?.analysis.summary;
  const budgetHealth = wellBeing?.analysis.budgetHealth;
  const recommendations = wellBeing?.recommendations;
  const sufficiency = wellBeing?.dataSufficiency;
  const cashFlow = summary
    ? getCashFlowPresentation(summary.cashFlowStatus)
    : null;
  const CashFlowIcon = cashFlow?.icon;
  const sufficiencyPresentation = sufficiency
    ? getSufficiencyPresentation(sufficiency.level)
    : null;

  const actionCount =
    recommendations?.actionCenter.filter((item) =>
      ["PENDING", "ACCEPTED", "DEFERRED"].includes(item.status),
    ).length ?? 0;

  return (
    <div className="financial-wellbeing-dashboard-page">
      <section className="fwb-overview" aria-labelledby="fwb-overview-title">
        <div className="fwb-heading-row">
          <div className="fwb-heading-copy">
            <span className="fwb-eyebrow">FINANCIAL WELL-BEING</span>
            <h2 id="fwb-overview-title">Kesehatan keuangan</h2>
            <p>
              Gambaran kondisi arus kas, kebiasaan pengeluaran, dan kesiapan
              anggaran Anda.
            </p>
          </div>
          <div className="fwb-heading-actions">
            <span
              className="fwb-period-chip"
              title={`Target rekomendasi: ${formatMonth(wellBeing?.period.month ?? month)}`}
            >
              {formatAnalysisPeriod(
                wellBeing?.analysis.period.startDate,
                wellBeing?.analysis.period.endDate,
              )}
            </span>
            <button
              type="button"
              className="fwb-refresh-button"
              onClick={() => setReloadKey((current) => current + 1)}
              disabled={isLoading}
              aria-label="Perbarui ringkasan kesehatan keuangan"
            >
              <RefreshCw size={15} className={isLoading ? "is-spinning" : ""} />
              <span>{isLoading ? "Memuat" : "Perbarui"}</span>
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="fwb-error" role="alert">
            <AlertCircle size={19} />
            <div>
              <strong>Ringkasan belum tersedia</strong>
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

        <div className="fwb-metric-grid" aria-busy={isLoading}>
          <article className="fwb-metric-card fwb-metric-card--cashflow">
            <div className="fwb-metric-topline">
              <span>Arus kas bersih</span>
              <span className="fwb-metric-icon">
                <Wallet size={17} />
              </span>
            </div>
            <strong className="fwb-metric-value">
              {isLoading && !summary
                ? "Memuat…"
                : summary
                  ? formatCurrency(summary.netCashFlow, wellBeing?.currency)
                  : "—"}
            </strong>
            {cashFlow && CashFlowIcon && (
              <span
                className={`fwb-status-line fwb-status-line--${cashFlow.tone}`}
              >
                <CashFlowIcon size={14} /> {cashFlow.label}
              </span>
            )}
          </article>

          <article className="fwb-metric-card">
            <div className="fwb-metric-topline">
              <span>Rasio tabungan</span>
              <span className="fwb-metric-icon">
                <ShieldCheck size={17} />
              </span>
            </div>
            <strong className="fwb-metric-value">
              {summary
                ? formatPercent(summary.savingsRate)
                : isLoading
                  ? "Memuat…"
                  : "—"}
            </strong>
            <span className="fwb-metric-caption">
              Dihitung dari arus kas bersih terhadap pemasukan.
            </span>
          </article>

          <article className="fwb-metric-card">
            <div className="fwb-metric-topline">
              <span>Pengeluaran</span>
              <span className="fwb-metric-icon fwb-metric-icon--expense">
                <ArrowDownRight size={17} />
              </span>
            </div>
            <strong className="fwb-metric-value">
              {summary
                ? formatCurrency(summary.totalExpense, wellBeing?.currency)
                : isLoading
                  ? "Memuat…"
                  : "—"}
            </strong>
            <span className="fwb-metric-caption">
              {wellBeing
                ? `${wellBeing.analysis.spendingPatterns.transactionCount.toLocaleString("id-ID")} transaksi pengeluaran`
                : "Total pengeluaran periode ini"}
            </span>
          </article>

          <article className="fwb-metric-card">
            <div className="fwb-metric-topline">
              <span>Penggunaan anggaran</span>
              <span className="fwb-metric-icon">
                <Activity size={17} />
              </span>
            </div>
            <strong className="fwb-metric-value">
              {budgetHealth
                ? formatPercent(budgetHealth.utilizationPercentage)
                : isLoading
                  ? "Memuat…"
                  : "—"}
            </strong>
            <span className="fwb-metric-caption">
              {budgetHealth
                ? `${budgetHealth.overBudgetCount} dari ${budgetHealth.budgetCount} anggaran terlampaui`
                : "Proporsi alokasi yang telah digunakan"}
            </span>
          </article>
        </div>

        <div className="fwb-detail-grid">
          <article className="fwb-panel fwb-budget-health">
            <div className="fwb-panel-heading">
              <div>
                <span className="fwb-panel-overline">BUDGET HEALTH</span>
                <h3>Kondisi anggaran</h3>
              </div>
              <span className="fwb-panel-icon">
                <Wallet size={18} />
              </span>
            </div>
            {budgetHealth ? (
              <>
                <div className="fwb-budget-amounts">
                  <div>
                    <span>Terpakai</span>
                    <strong>
                      {formatCurrency(
                        budgetHealth.totalSpent,
                        wellBeing?.currency,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Total alokasi</span>
                    <strong>
                      {formatCurrency(
                        budgetHealth.totalAllocation,
                        wellBeing?.currency,
                      )}
                    </strong>
                  </div>
                </div>
                <div
                  className="fwb-progress-track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.max(
                    0,
                    Math.min(100, budgetHealth.utilizationPercentage ?? 0),
                  )}
                >
                  <span
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(100, budgetHealth.utilizationPercentage ?? 0),
                      )}%`,
                    }}
                  />
                </div>
                <div className="fwb-budget-statuses">
                  <span>
                    <i className="fwb-dot fwb-dot--good" /> Sesuai rencana
                    <strong>{budgetHealth.onTrackCount}</strong>
                  </span>
                  <span>
                    <i className="fwb-dot fwb-dot--warning" /> Mendekati batas
                    <strong>{budgetHealth.nearLimitCount}</strong>
                  </span>
                  <span>
                    <i className="fwb-dot fwb-dot--danger" /> Terlampaui
                    <strong>{budgetHealth.overBudgetCount}</strong>
                  </span>
                </div>
              </>
            ) : (
              <p className="fwb-muted-copy">
                {isLoading
                  ? "Memuat kondisi anggaran…"
                  : "Belum ada data anggaran untuk periode ini."}
              </p>
            )}
          </article>

          <article className="fwb-panel fwb-recommendation-summary">
            <div className="fwb-panel-heading">
              <div>
                <span className="fwb-panel-overline">BUDGET ACTION CENTER</span>
                <h3>Rekomendasi anggaran</h3>
              </div>
              <span className="fwb-recommendation-total">
                {recommendations?.total ?? (isLoading ? "…" : 0)}
              </span>
            </div>
            <p className="fwb-recommendation-intro">
              {actionCount > 0
                ? `${actionCount} rekomendasi aktif ditampilkan pada ringkasan ini.`
                : "Belum ada rekomendasi yang membutuhkan tindakan."}
            </p>
            <div className="fwb-recommendation-status-list">
              {(
                [
                  "PENDING",
                  "ACCEPTED",
                  "DEFERRED",
                  "APPLIED",
                ] as RecommendationStatus[]
              ).map((status) => (
                <div className="fwb-recommendation-status" key={status}>
                  <span>{STATUS_LABELS[status]}</span>
                  <strong>
                    {recommendations
                      ? getStatusCount(recommendations.statusCounts, status)
                      : isLoading
                        ? "—"
                        : 0}
                  </strong>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="fwb-bottom-grid">
          <article className="fwb-panel fwb-signals-panel">
            <div className="fwb-panel-heading">
              <div>
                <span className="fwb-panel-overline">FINANCIAL SIGNALS</span>
                <h3>Hal yang perlu diperhatikan</h3>
              </div>
              <span className="fwb-signal-count">
                {wellBeing?.analysis.signals.length ?? 0}
              </span>
            </div>
            {wellBeing?.analysis.signals.length ? (
              <div className="fwb-signal-list">
                {wellBeing.analysis.signals.map((signal, index) => (
                  <div
                    className={`fwb-signal-item fwb-signal-item--${signal.severity.toLowerCase()}`}
                    key={`${signal.code}-${index}`}
                  >
                    <span className="fwb-signal-indicator">
                      <AlertCircle size={16} />
                    </span>
                    <div>
                      <strong>{signal.title}</strong>
                      <p>{signal.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="fwb-empty-inline">
                <CheckCircle2 size={17} />
                <span>
                  {isLoading
                    ? "Memuat indikator keuangan…"
                    : "Tidak ada indikator khusus yang perlu diperhatikan pada periode ini."}
                </span>
              </div>
            )}
          </article>

          <article className="fwb-panel fwb-top-categories-panel">
            <div className="fwb-panel-heading">
              <div>
                <span className="fwb-panel-overline">SPENDING PATTERNS</span>
                <h3>Kategori pengeluaran terbesar</h3>
              </div>
              <span className="fwb-signal-count">
                {wellBeing
                  ? formatPercent(
                      wellBeing.analysis.spendingPatterns
                        .topCategoryConcentration,
                    )
                  : "—"}
              </span>
            </div>
            {wellBeing?.analysis.spendingPatterns.topCategories.length ? (
              <div className="fwb-top-category-list">
                {wellBeing.analysis.spendingPatterns.topCategories
                  .slice(0, 3)
                  .map((category, index) => (
                    <div
                      className="fwb-top-category-item"
                      key={category.categoryId}
                    >
                      <span
                        className={`fwb-category-rank fwb-category-rank--${index + 1}`}
                      >
                        {index + 1}
                      </span>
                      <div className="fwb-top-category-copy">
                        <strong>{category.categoryName}</strong>
                        <span>
                          {category.transactionCount.toLocaleString("id-ID")}{" "}
                          transaksi · {formatPercent(category.percentage)}
                        </span>
                      </div>
                      <b>
                        {formatCurrency(
                          category.totalAmount,
                          wellBeing.currency,
                        )}
                      </b>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="fwb-muted-copy">
                {isLoading
                  ? "Memuat pola pengeluaran…"
                  : "Belum ada pengeluaran yang tercatat pada periode ini."}
              </p>
            )}
            <p className="fwb-category-footnote">
              Persentase di bagian atas menunjukkan porsi kategori terbesar
              terhadap total pengeluaran.
            </p>
          </article>

          <article className="fwb-panel fwb-data-panel">
            <div className="fwb-panel-heading">
              <div>
                <span className="fwb-panel-overline">DATA QUALITY</span>
                <h3>Kecukupan data</h3>
              </div>
              {sufficiencyPresentation && (
                <span
                  className={`fwb-sufficiency-badge fwb-sufficiency-badge--${sufficiencyPresentation.tone}`}
                >
                  {sufficiencyPresentation.label}
                </span>
              )}
            </div>
            {sufficiency ? (
              <>
                <div className="fwb-data-counts">
                  <div>
                    <strong>{sufficiency.transactionCount}</strong>
                    <span>Transaksi</span>
                  </div>
                  <div>
                    <strong>{sufficiency.budgetCount}</strong>
                    <span>Anggaran</span>
                  </div>
                </div>
                {sufficiency.messages.length > 0 ? (
                  <ul className="fwb-data-messages">
                    {sufficiency.messages.map((message, index) => (
                      <li key={`${index}-${message}`}>{message}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="fwb-muted-copy">
                    Data yang tersedia dapat digunakan untuk menyusun gambaran
                    keuangan periode ini.
                  </p>
                )}
              </>
            ) : (
              <p className="fwb-muted-copy">
                {isLoading
                  ? "Memeriksa kecukupan data…"
                  : "Informasi kecukupan data belum tersedia."}
              </p>
            )}
          </article>
        </div>
      </section>

      <DashboardPage />
    </div>
  );
}

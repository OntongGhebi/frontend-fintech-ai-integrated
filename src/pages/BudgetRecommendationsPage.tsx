import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CalendarClock,
  Check,
  Ban,
  X,
  CheckCircle2,
  Clock3,
  Info,
  Lightbulb,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
  LoaderCircle,
} from "lucide-react";

import { ApiRequestError, apiClient } from "../lib/api-client";
import "./BudgetRecommendationsPage.css";

type RecommendationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "DEFERRED"
  | "APPLIED"
  | "EVALUATED";

type RecommendationAction = "INCREASE" | "DECREASE" | "MAINTAIN" | "REVIEW";
type StatusFilter = "ALL" | RecommendationStatus;
type LifecycleDialog =
  | { type: "reject"; recommendation: BudgetRecommendation }
  | { type: "defer"; recommendation: BudgetRecommendation }
  | { type: "apply"; recommendation: BudgetRecommendation }
  | { type: "evaluate"; recommendation: BudgetRecommendation }
  | null;

type MonthlySpending = {
  month: string;
  amount: string | number;
  transactionCount: number;
};

interface RecommendationEvaluation {
  targetMonth?: string;
  actualSpend?: string | number;
  proposedAllocation?: string | number;
  previousAllocation?: string | number;
  variance?: string | number;
  utilizationPercentage?: string | number;
  transactionCount?: number;
  evaluatedAt?: string;
}

interface BudgetRecommendation {
  id: string;
  budgetId: string;
  budgetName: string;
  categoryId: string | null;
  categoryName: string | null;
  targetMonth: string;
  action: RecommendationAction;
  status: RecommendationStatus;
  currentAllocation: string | number;
  proposedAllocation: string | number;
  changeAmount: string | number;
  changePercentage: number | string | null;
  averageMonthlySpend: string | number;
  transactionCount: number;
  monthsWithActivity: number;
  spendingTrend: string | null;
  monthlySpending: MonthlySpending[];
  reason: string;
  guardrails: string[];
  aiExplanation?: string | null;
  aiWhyItMatters?: string | null;
  aiSuggestedActions?: string[];
  generatedAt: string;
  reviewedAt?: string | null;
  deferredUntil?: string | null;
  rejectionReason?: string | null;
  appliedAt?: string | null;
  evaluatedAt?: string | null;
  evaluationStatus?: string | null;
  evaluation?: RecommendationEvaluation | null;
}

interface RecommendationListResponse {
  count: number;
  recommendations: BudgetRecommendation[];
}

interface GenerateRecommendationsResponse {
  generatedAt: string;
  currency: string;
  status: "GENERATED" | "NO_RECOMMENDATIONS";
  targetMonth: string;
  recommendations: BudgetRecommendation[];
  message?: string;
}

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "Semua" },
  { value: "PENDING", label: "Menunggu" },
  { value: "ACCEPTED", label: "Disetujui" },
  { value: "REJECTED", label: "Ditolak" },
  { value: "DEFERRED", label: "Ditunda" },
  { value: "APPLIED", label: "Diterapkan" },
  { value: "EVALUATED", label: "Dievaluasi" },
];

const STATUS_LABELS: Record<RecommendationStatus, string> = {
  PENDING: "Menunggu keputusan",
  ACCEPTED: "Disetujui",
  REJECTED: "Ditolak",
  DEFERRED: "Ditunda",
  APPLIED: "Sudah diterapkan",
  EVALUATED: "Sudah dievaluasi",
};

const ACTION_LABELS: Record<RecommendationAction, string> = {
  INCREASE: "Tambah alokasi",
  DECREASE: "Kurangi alokasi",
  MAINTAIN: "Pertahankan alokasi",
  REVIEW: "Perlu ditinjau",
};

function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: string | number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatPercent(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return `${toNumber(value).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
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

function getNextMonthKey(): string {
  const current = getCurrentMonthKey();
  if (!current) return "";
  const [year, month] = current.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(value: string): string {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(year, month - 1, 1));
}

function getLastDayBeforeMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return "";
  return new Date(Date.UTC(year, month - 1, 0)).toISOString().slice(0, 10);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function getEvaluationStatusLabel(value: string | null | undefined): string {
  const labels: Record<string, string> = {
    WITHIN_ALLOCATION: "Sesuai alokasi",
    OVER_ALLOCATION: "Melebihi alokasi",
    NO_ACTIVITY: "Belum ada aktivitas",
  };
  return value
    ? (labels[value] ?? "Hasil evaluasi tersedia")
    : "Hasil evaluasi tersedia";
}

function isTargetMonthCompleted(targetMonth: string): boolean {
  return Boolean(targetMonth) && targetMonth < getCurrentMonthKey();
}

function formatVariance(value: string | number | undefined): string {
  if (value === undefined || value === null) return "—";
  const amount = toNumber(value);
  return `${amount > 0 ? "+" : ""}${formatCurrency(amount)}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return "Server belum dapat dijangkau. Pastikan backend aktif dan URL API sudah benar.";
    }
    return error.message || "Permintaan rekomendasi anggaran gagal diproses.";
  }
  return error instanceof Error
    ? error.message
    : "Terjadi kesalahan saat memproses rekomendasi anggaran.";
}

function getTrendLabel(value: string | null): string {
  if (!value) return "Belum tersedia";
  const labels: Record<string, string> = {
    INCREASING: "Cenderung meningkat",
    INCREASE: "Cenderung meningkat",
    DECREASING: "Cenderung menurun",
    DECREASE: "Cenderung menurun",
    STABLE: "Relatif stabil",
    VOLATILE: "Berfluktuasi",
    INSUFFICIENT_DATA: "Data belum cukup",
  };
  return labels[value] ?? value.replaceAll("_", " ").toLowerCase();
}

function actionIcon(action: RecommendationAction) {
  if (action === "INCREASE") return <TrendingUp size={17} />;
  if (action === "DECREASE") return <TrendingDown size={17} />;
  if (action === "MAINTAIN") return <CheckCircle2 size={17} />;
  return <Info size={17} />;
}

export function BudgetRecommendationsPage() {
  const [selectedMonth, setSelectedMonth] = useState(() => getNextMonthKey());
  const [recommendations, setRecommendations] = useState<
    BudgetRecommendation[]
  >([]);
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [lifecycleDialog, setLifecycleDialog] = useState<LifecycleDialog>(null);
  const [dialogReason, setDialogReason] = useState("");
  const [deferDate, setDeferDate] = useState("");
  const [minimumDeferDate, setMinimumDeferDate] = useState("");
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);

  const loadRecommendations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ month: selectedMonth });
      const response = await apiClient.get<RecommendationListResponse>(
        `/financial-analysis/budget-recommendations?${query.toString()}`,
      );
      setRecommendations(
        Array.isArray(response.recommendations) ? response.recommendations : [],
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setRecommendations([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    void loadRecommendations();
  }, [loadRecommendations, reloadKey]);

  useEffect(() => {
    setMinimumDeferDate(
      new Date(Date.now() + 86400000).toLocaleDateString("en-CA", {
        timeZone: "Asia/Jakarta",
      }),
    );
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<RecommendationStatus, number> = {
      PENDING: 0,
      ACCEPTED: 0,
      REJECTED: 0,
      DEFERRED: 0,
      APPLIED: 0,
      EVALUATED: 0,
    };
    recommendations.forEach((item) => {
      counts[item.status] += 1;
    });
    return counts;
  }, [recommendations]);

  const filteredRecommendations = useMemo(() => {
    if (selectedStatus === "ALL") return recommendations;
    return recommendations.filter((item) => item.status === selectedStatus);
  }, [recommendations, selectedStatus]);

  const canGenerate = selectedMonth >= getCurrentMonthKey();
  const hasRecommendations = recommendations.length > 0;

  const handleGenerate = async () => {
    if (isGenerating || !canGenerate || hasRecommendations) return;

    setIsGenerating(true);
    setError(null);
    setNotice(null);

    try {
      const query = new URLSearchParams({ month: selectedMonth });
      const response = await apiClient.post<GenerateRecommendationsResponse>(
        `/financial-analysis/budget-recommendations/generate?${query.toString()}`,
      );

      if (response.status === "NO_RECOMMENDATIONS") {
        setNotice(
          response.message ||
            "Belum ada rekomendasi yang dapat dibuat untuk bulan tersebut.",
        );
      } else {
        setNotice(
          `Rekomendasi untuk ${formatMonth(response.targetMonth)} berhasil dibuat.`,
        );
      }

      await loadRecommendations();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsGenerating(false);
    }
  };

  const closeLifecycleDialog = () => {
    if (isProcessingId) return;
    setLifecycleDialog(null);
    setDialogReason("");
    setDeferDate("");
  };

  const refreshAfterLifecycle = async (message: string) => {
    setLifecycleDialog(null);
    setDialogReason("");
    setDeferDate("");
    setNotice(message);
    await loadRecommendations();
  };

  const handleAccept = async (item: BudgetRecommendation) => {
    if (isProcessingId) return;
    setIsProcessingId(item.id);
    setError(null);
    setNotice(null);
    try {
      await apiClient.patch(
        `/financial-analysis/budget-recommendations/${item.id}/accept`,
      );
      await refreshAfterLifecycle(
        `Rekomendasi “${item.budgetName}” berhasil disetujui.`,
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!lifecycleDialog || lifecycleDialog.type !== "reject" || isProcessingId)
      return;
    const item = lifecycleDialog.recommendation;
    setIsProcessingId(item.id);
    setError(null);
    setNotice(null);
    try {
      await apiClient.patch(
        `/financial-analysis/budget-recommendations/${item.id}/reject`,
        dialogReason.trim() ? { reason: dialogReason.trim() } : {},
      );
      await refreshAfterLifecycle(
        `Rekomendasi “${item.budgetName}” berhasil ditolak.`,
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleDefer = async () => {
    if (!lifecycleDialog || lifecycleDialog.type !== "defer" || isProcessingId)
      return;
    const item = lifecycleDialog.recommendation;
    if (!deferDate) {
      setError("Pilih tanggal tindak lanjut terlebih dahulu.");
      return;
    }
    const today =
      getCurrentMonthKey() +
      "-" +
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
      }).format(new Date());
    const targetStart = `${item.targetMonth}-01`;
    if (deferDate <= today || deferDate >= targetStart) {
      setError(
        `Tanggal tindak lanjut harus setelah hari ini dan sebelum ${formatMonth(item.targetMonth)}.`,
      );
      return;
    }
    setIsProcessingId(item.id);
    setError(null);
    setNotice(null);
    try {
      const deferredUntil = new Date(
        `${deferDate}T09:00:00+07:00`,
      ).toISOString();
      await apiClient.patch(
        `/financial-analysis/budget-recommendations/${item.id}/defer`,
        { deferredUntil },
      );
      await refreshAfterLifecycle(
        `Rekomendasi “${item.budgetName}” ditunda hingga ${formatDate(deferredUntil)}.`,
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleApply = async () => {
    if (!lifecycleDialog || lifecycleDialog.type !== "apply" || isProcessingId)
      return;
    const item = lifecycleDialog.recommendation;
    setIsProcessingId(item.id);
    setError(null);
    setNotice(null);
    try {
      await apiClient.post(
        `/financial-analysis/budget-recommendations/${item.id}/apply`,
      );
      await refreshAfterLifecycle(
        `Rekomendasi “${item.budgetName}” berhasil diterapkan ke alokasi anggaran.`,
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleEvaluate = async () => {
    if (
      !lifecycleDialog ||
      lifecycleDialog.type !== "evaluate" ||
      isProcessingId
    ) {
      return;
    }

    const item = lifecycleDialog.recommendation;
    if (
      item.status !== "APPLIED" ||
      !isTargetMonthCompleted(item.targetMonth)
    ) {
      setLifecycleDialog(null);
      setError(
        "Evaluasi hanya tersedia untuk rekomendasi yang sudah diterapkan setelah bulan target berakhir.",
      );
      return;
    }

    setIsProcessingId(item.id);
    setError(null);
    setNotice(null);

    try {
      await apiClient.post(
        `/financial-analysis/budget-recommendations/${item.id}/evaluate`,
      );
      await refreshAfterLifecycle(
        `Evaluasi rekomendasi “${item.budgetName}” untuk ${formatMonth(item.targetMonth)} berhasil disimpan.`,
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsProcessingId(null);
    }
  };

  const openDialog = (dialog: Exclude<LifecycleDialog, null>) => {
    setError(null);
    setNotice(null);
    setDialogReason("");
    setDeferDate("");
    setLifecycleDialog(dialog);
  };

  return (
    <main className="budget-recommendations-page">
      <header className="recommendations-page-heading">
        <div>
          <span className="recommendations-eyebrow">
            FINANCIAL WELL-BEING / NEXT ACTIONS
          </span>
          <h2>Rekomendasi anggaran</h2>
          <p>
            Tinjau usulan penyesuaian anggaran berdasarkan pola pengeluaran dan
            kapasitas keuangan.
          </p>
        </div>
        <div className="recommendations-heading-actions">
          <label className="recommendations-month-picker">
            <CalendarDays size={16} aria-hidden="true" />
            <span className="sr-only">Pilih bulan target rekomendasi</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => {
                setSelectedMonth(event.target.value);
                setSelectedStatus("ALL");
                setNotice(null);
              }}
            />
          </label>
          <button
            type="button"
            className="recommendations-icon-button"
            onClick={() => setReloadKey((value) => value + 1)}
            disabled={isLoading || isGenerating}
            aria-label="Muat ulang rekomendasi"
            title="Muat ulang"
          >
            <RefreshCw size={16} className={isLoading ? "is-spinning" : ""} />
          </button>
          <button
            type="button"
            className="recommendations-generate-button"
            onClick={() => void handleGenerate()}
            disabled={
              !canGenerate ||
              hasRecommendations ||
              Boolean(error) ||
              isLoading ||
              isGenerating
            }
          >
            {isGenerating ? (
              <RefreshCw size={16} className="is-spinning" />
            ) : (
              <Sparkles size={16} />
            )}
            <span>
              {isGenerating
                ? "Menganalisis…"
                : hasRecommendations
                  ? "Rekomendasi tersedia"
                  : "Buat rekomendasi"}
            </span>
          </button>
        </div>
      </header>

      {error && (
        <div
          className="recommendations-alert recommendations-alert--error"
          role="alert"
        >
          <AlertCircle size={18} />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            disabled={isLoading}
          >
            Coba lagi
          </button>
        </div>
      )}

      {notice && (
        <div
          className="recommendations-alert recommendations-alert--success"
          role="status"
        >
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Tutup pemberitahuan"
            onClick={() => setNotice(null)}
          >
            ×
          </button>
        </div>
      )}

      <section
        className="recommendations-summary-grid"
        aria-label="Ringkasan rekomendasi"
      >
        <article className="recommendations-summary-card">
          <span className="recommendations-summary-icon recommendations-summary-icon--total">
            <Lightbulb size={17} />
          </span>
          <div>
            <small>Total rekomendasi</small>
            <strong>{isLoading ? "—" : recommendations.length}</strong>
          </div>
        </article>
        <article className="recommendations-summary-card">
          <span className="recommendations-summary-icon recommendations-summary-icon--pending">
            <Clock3 size={17} />
          </span>
          <div>
            <small>Menunggu keputusan</small>
            <strong>{isLoading ? "—" : statusCounts.PENDING}</strong>
          </div>
        </article>
        <article className="recommendations-summary-card">
          <span className="recommendations-summary-icon recommendations-summary-icon--accepted">
            <CheckCircle2 size={17} />
          </span>
          <div>
            <small>Disetujui</small>
            <strong>{isLoading ? "—" : statusCounts.ACCEPTED}</strong>
          </div>
        </article>
        <article className="recommendations-summary-card">
          <span className="recommendations-summary-icon recommendations-summary-icon--applied">
            <Wallet size={17} />
          </span>
          <div>
            <small>Sudah diterapkan</small>
            <strong>
              {isLoading ? "—" : statusCounts.APPLIED + statusCounts.EVALUATED}
            </strong>
          </div>
        </article>
      </section>

      <section
        className="recommendations-list-section"
        aria-labelledby="recommendations-list-title"
      >
        <div className="recommendations-list-heading">
          <div>
            <span className="recommendations-section-kicker">
              RECOMMENDATION CENTER
            </span>
            <h3 id="recommendations-list-title">Daftar rekomendasi</h3>
            <p>
              Periode target: <strong>{formatMonth(selectedMonth)}</strong>
            </p>
          </div>
          <span className="recommendations-result-count">
            {filteredRecommendations.length} dari {recommendations.length}{" "}
            rekomendasi
          </span>
        </div>

        <div
          className="recommendations-filter-row"
          role="tablist"
          aria-label="Filter status rekomendasi"
        >
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              role="tab"
              aria-selected={selectedStatus === filter.value}
              className={selectedStatus === filter.value ? "is-active" : ""}
              onClick={() => setSelectedStatus(filter.value)}
            >
              {filter.label}
              {filter.value !== "ALL" && (
                <span>{statusCounts[filter.value]}</span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="recommendations-state">
            <RefreshCw size={19} className="is-spinning" /> Memuat rekomendasi
            anggaran…
          </div>
        ) : filteredRecommendations.length > 0 ? (
          <div className="recommendations-card-list">
            {filteredRecommendations.map((item) => {
              const change = toNumber(item.changeAmount);
              const actionClass = item.action.toLowerCase();
              const statusClass = item.status.toLowerCase();

              return (
                <article className="recommendation-item-card" key={item.id}>
                  <div className="recommendation-item-topline">
                    <div className="recommendation-item-identity">
                      <span
                        className={`recommendation-action-icon recommendation-action-icon--${actionClass}`}
                      >
                        {actionIcon(item.action)}
                      </span>
                      <div>
                        <span className="recommendation-category">
                          {item.categoryName || "Tanpa kategori"}
                        </span>
                        <h4>{item.budgetName || "Anggaran"}</h4>
                      </div>
                    </div>
                    <div className="recommendation-item-badges">
                      <span
                        className={`recommendation-action-badge recommendation-action-badge--${actionClass}`}
                      >
                        {ACTION_LABELS[item.action]}
                      </span>
                      <span
                        className={`recommendation-status-badge recommendation-status-badge--${statusClass}`}
                      >
                        {STATUS_LABELS[item.status]}
                      </span>
                    </div>
                  </div>

                  <div className="recommendation-allocation-grid">
                    <div>
                      <span>Alokasi saat ini</span>
                      <strong>{formatCurrency(item.currentAllocation)}</strong>
                    </div>
                    <div>
                      <span>Usulan alokasi</span>
                      <strong>{formatCurrency(item.proposedAllocation)}</strong>
                    </div>
                    <div className="recommendation-change-value">
                      <span>Perubahan</span>
                      <strong
                        className={
                          change > 0
                            ? "is-increase"
                            : change < 0
                              ? "is-decrease"
                              : ""
                        }
                      >
                        {change > 0 ? "+" : ""}
                        {formatCurrency(change)}
                      </strong>
                      <small>{formatPercent(item.changePercentage)}</small>
                    </div>
                  </div>

                  <div className="recommendation-reason-block">
                    <span className="recommendation-detail-label">
                      Pertimbangan rekomendasi
                    </span>
                    <p>{item.reason || "Tidak ada penjelasan tambahan."}</p>
                  </div>

                  <div className="recommendation-context-grid">
                    <div>
                      <span>Rata-rata pengeluaran</span>
                      <strong>
                        {formatCurrency(item.averageMonthlySpend)}
                      </strong>
                    </div>
                    <div>
                      <span>Transaksi dianalisis</span>
                      <strong>
                        {item.transactionCount.toLocaleString("id-ID")}
                      </strong>
                    </div>
                    <div>
                      <span>Bulan aktif</span>
                      <strong>{item.monthsWithActivity}</strong>
                    </div>
                    <div>
                      <span>Tren pengeluaran</span>
                      <strong>{getTrendLabel(item.spendingTrend)}</strong>
                    </div>
                  </div>

                  {item.guardrails.length > 0 && (
                    <div className="recommendation-guardrails">
                      <span>
                        <Info size={14} /> Batasan yang dipertimbangkan
                      </span>
                      <ul>
                        {item.guardrails.map((guardrail, index) => (
                          <li key={`${item.id}-guardrail-${index}`}>
                            {guardrail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <footer className="recommendation-item-footer">
                    <span>
                      <CalendarDays size={14} /> Target{" "}
                      {formatMonth(item.targetMonth)}
                    </span>
                    <span>Dibuat {formatDate(item.generatedAt)}</span>
                    {item.deferredUntil && (
                      <span>
                        <Clock3 size={14} /> Ditunda hingga{" "}
                        {formatDate(item.deferredUntil)}
                      </span>
                    )}
                    {item.rejectionReason && (
                      <span className="recommendation-rejection-reason">
                        Alasan penolakan: {item.rejectionReason}
                      </span>
                    )}
                  </footer>

                  {item.status === "EVALUATED" && item.evaluation && (
                    <section
                      className="recommendation-evaluation-panel"
                      aria-label="Hasil evaluasi rekomendasi"
                    >
                      <div className="recommendation-evaluation-heading">
                        <div>
                          <span className="recommendation-detail-label">
                            HASIL PEMANTAUAN
                          </span>
                          <h5>
                            {getEvaluationStatusLabel(item.evaluationStatus)}
                          </h5>
                        </div>
                        <span
                          className={`recommendation-evaluation-status recommendation-evaluation-status--${(item.evaluationStatus || "available").toLowerCase()}`}
                        >
                          <CheckCircle2 size={14} />
                          Evaluasi selesai
                        </span>
                      </div>
                      <div className="recommendation-evaluation-grid">
                        <div>
                          <span>Pengeluaran aktual</span>
                          <strong>
                            {formatCurrency(item.evaluation.actualSpend ?? 0)}
                          </strong>
                        </div>
                        <div>
                          <span>Alokasi usulan</span>
                          <strong>
                            {formatCurrency(
                              item.evaluation.proposedAllocation ??
                                item.proposedAllocation,
                            )}
                          </strong>
                        </div>
                        <div>
                          <span>Alokasi sebelumnya</span>
                          <strong>
                            {formatCurrency(
                              item.evaluation.previousAllocation ??
                                item.currentAllocation,
                            )}
                          </strong>
                        </div>
                        <div>
                          <span>Selisih pengeluaran</span>
                          <strong>
                            {formatVariance(item.evaluation.variance)}
                          </strong>
                        </div>
                        <div>
                          <span>Penggunaan alokasi</span>
                          <strong>
                            {formatPercent(
                              item.evaluation.utilizationPercentage,
                            )}
                          </strong>
                        </div>
                        <div>
                          <span>Jumlah transaksi</span>
                          <strong>
                            {(
                              item.evaluation.transactionCount ?? 0
                            ).toLocaleString("id-ID")}
                          </strong>
                        </div>
                      </div>
                      <p className="recommendation-evaluation-footnote">
                        Dievaluasi pada{" "}
                        {formatDate(
                          item.evaluatedAt || item.evaluation.evaluatedAt,
                        )}
                        .
                        {item.evaluationStatus === "NO_ACTIVITY"
                          ? " Tidak ditemukan transaksi pengeluaran pada kategori ini selama bulan target."
                          : item.evaluationStatus === "WITHIN_ALLOCATION"
                            ? " Pengeluaran aktual tidak melebihi alokasi yang diterapkan."
                            : item.evaluationStatus === "OVER_ALLOCATION"
                              ? " Pengeluaran aktual melampaui alokasi yang diterapkan."
                              : ""}
                      </p>
                    </section>
                  )}

                  {item.status === "APPLIED" && (
                    <div className="recommendation-lifecycle-actions recommendation-evaluation-actions">
                      {isTargetMonthCompleted(item.targetMonth) ? (
                        <>
                          <button
                            type="button"
                            className="recommendation-action-button recommendation-action-button--apply"
                            onClick={() =>
                              openDialog({
                                type: "evaluate",
                                recommendation: item,
                              })
                            }
                            disabled={Boolean(isProcessingId)}
                          >
                            {isProcessingId === item.id ? (
                              <LoaderCircle size={15} className="is-spinning" />
                            ) : (
                              <CheckCircle2 size={15} />
                            )}
                            Evaluasi hasil
                          </button>
                          <span className="recommendation-evaluation-hint">
                            Bandingkan pengeluaran aktual dengan alokasi yang
                            diterapkan.
                          </span>
                        </>
                      ) : (
                        <span className="recommendation-evaluation-hint">
                          Evaluasi tersedia setelah{" "}
                          {formatMonth(item.targetMonth)} berakhir.
                        </span>
                      )}
                    </div>
                  )}

                  {(item.status === "PENDING" ||
                    item.status === "DEFERRED" ||
                    item.status === "ACCEPTED") && (
                    <div className="recommendation-lifecycle-actions">
                      {(item.status === "PENDING" ||
                        item.status === "DEFERRED") && (
                        <>
                          <button
                            type="button"
                            className="recommendation-action-button recommendation-action-button--accept"
                            onClick={() => void handleAccept(item)}
                            disabled={Boolean(isProcessingId)}
                          >
                            {isProcessingId === item.id ? (
                              <LoaderCircle size={15} className="is-spinning" />
                            ) : (
                              <Check size={15} />
                            )}{" "}
                            Setujui
                          </button>
                          <button
                            type="button"
                            className="recommendation-action-button"
                            onClick={() =>
                              openDialog({
                                type: "defer",
                                recommendation: item,
                              })
                            }
                            disabled={Boolean(isProcessingId)}
                          >
                            <CalendarClock size={15} /> Tunda
                          </button>
                          <button
                            type="button"
                            className="recommendation-action-button recommendation-action-button--reject"
                            onClick={() =>
                              openDialog({
                                type: "reject",
                                recommendation: item,
                              })
                            }
                            disabled={Boolean(isProcessingId)}
                          >
                            <Ban size={15} /> Tolak
                          </button>
                        </>
                      )}
                      {item.status === "ACCEPTED" &&
                        (item.action === "INCREASE" ||
                          item.action === "DECREASE") && (
                          <button
                            type="button"
                            className="recommendation-action-button recommendation-action-button--apply"
                            onClick={() =>
                              openDialog({
                                type: "apply",
                                recommendation: item,
                              })
                            }
                            disabled={Boolean(isProcessingId)}
                          >
                            <Check size={15} /> Terapkan perubahan
                          </button>
                        )}
                      {item.status === "ACCEPTED" &&
                        item.action !== "INCREASE" &&
                        item.action !== "DECREASE" && (
                          <span className="recommendation-no-apply-note">
                            Tidak ada perubahan alokasi yang perlu diterapkan
                            untuk rekomendasi ini.
                          </span>
                        )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="recommendations-empty-state">
            <span className="recommendations-empty-icon">
              <Lightbulb size={23} />
            </span>
            <h4>
              {selectedStatus === "ALL"
                ? "Belum ada rekomendasi anggaran"
                : "Tidak ada rekomendasi dengan status ini"}
            </h4>
            <p>
              {selectedStatus === "ALL"
                ? `Belum ada rekomendasi tersimpan untuk ${formatMonth(selectedMonth)}. Buat analisis agar sistem dapat menyusun usulan alokasi berdasarkan riwayat keuangan.`
                : "Coba pilih status lain untuk melihat rekomendasi pada periode ini."}
            </p>
            {selectedStatus !== "ALL" ? (
              <button
                type="button"
                className="recommendations-secondary-button"
                onClick={() => setSelectedStatus("ALL")}
              >
                Tampilkan semua
              </button>
            ) : (
              <button
                type="button"
                className="recommendations-generate-button"
                onClick={() => void handleGenerate()}
                disabled={!canGenerate || Boolean(error) || isGenerating}
              >
                {isGenerating ? (
                  <RefreshCw size={16} className="is-spinning" />
                ) : (
                  <Sparkles size={16} />
                )}
                <span>
                  {isGenerating ? "Menganalisis…" : "Buat rekomendasi"}
                </span>
              </button>
            )}
            {!canGenerate && selectedStatus === "ALL" && (
              <small className="recommendations-hint">
                Pembuatan rekomendasi hanya tersedia untuk bulan berjalan atau
                bulan mendatang.
              </small>
            )}
          </div>
        )}
      </section>

      {lifecycleDialog && (
        <div
          className="recommendation-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeLifecycleDialog();
          }}
        >
          <section
            className="recommendation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recommendation-dialog-title"
          >
            <header>
              <div>
                <span className="recommendations-section-kicker">
                  TINDAK LANJUT REKOMENDASI
                </span>
                <h3 id="recommendation-dialog-title">
                  {lifecycleDialog.type === "reject"
                    ? "Tolak rekomendasi"
                    : lifecycleDialog.type === "defer"
                      ? "Tunda rekomendasi"
                      : lifecycleDialog.type === "evaluate"
                        ? "Evaluasi hasil rekomendasi"
                        : "Terapkan perubahan anggaran"}
                </h3>
              </div>
              <button
                type="button"
                className="recommendation-dialog-close"
                onClick={closeLifecycleDialog}
                disabled={Boolean(isProcessingId)}
                aria-label="Tutup dialog"
              >
                <X size={18} />
              </button>
            </header>
            <p className="recommendation-dialog-description">
              {lifecycleDialog.type === "reject"
                ? `Anda akan menolak usulan untuk ${lifecycleDialog.recommendation.budgetName}. Alasan penolakan bersifat opsional.`
                : lifecycleDialog.type === "defer"
                  ? `Pilih tanggal untuk meninjau kembali usulan ${lifecycleDialog.recommendation.budgetName}. Tanggal harus sebelum ${formatMonth(lifecycleDialog.recommendation.targetMonth)}.`
                  : lifecycleDialog.type === "evaluate"
                    ? `Sistem akan membandingkan pengeluaran aktual kategori ${lifecycleDialog.recommendation.categoryName || lifecycleDialog.recommendation.budgetName} selama ${formatMonth(lifecycleDialog.recommendation.targetMonth)} dengan alokasi yang diterapkan. Hasil evaluasi akan disimpan dan dapat ditinjau kembali.`
                    : `Alokasi ${lifecycleDialog.recommendation.budgetName} akan diubah dari ${formatCurrency(lifecycleDialog.recommendation.currentAllocation)} menjadi ${formatCurrency(lifecycleDialog.recommendation.proposedAllocation)}. Perubahan ini akan memperbarui anggaran.`}
            </p>

            {lifecycleDialog.type === "reject" && (
              <label className="recommendation-dialog-field">
                <span>
                  Alasan penolakan <small>(opsional)</small>
                </span>
                <textarea
                  value={dialogReason}
                  onChange={(event) => setDialogReason(event.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder="Tuliskan alasan agar keputusan ini lebih mudah ditinjau…"
                />
                <small>{dialogReason.length}/500 karakter</small>
              </label>
            )}

            {lifecycleDialog.type === "defer" && (
              <label className="recommendation-dialog-field">
                <span>Tanggal tindak lanjut</span>
                <input
                  type="date"
                  value={deferDate}
                  min={minimumDeferDate}
                  max={getLastDayBeforeMonth(
                    lifecycleDialog.recommendation.targetMonth,
                  )}
                  onChange={(event) => setDeferDate(event.target.value)}
                />
              </label>
            )}

            {lifecycleDialog.type === "apply" && (
              <div className="recommendation-apply-summary">
                <div>
                  <span>Alokasi saat ini</span>
                  <strong>
                    {formatCurrency(
                      lifecycleDialog.recommendation.currentAllocation,
                    )}
                  </strong>
                </div>
                <div>
                  <span>Alokasi setelah diterapkan</span>
                  <strong>
                    {formatCurrency(
                      lifecycleDialog.recommendation.proposedAllocation,
                    )}
                  </strong>
                </div>
              </div>
            )}

            {lifecycleDialog.type === "evaluate" && (
              <div className="recommendation-apply-summary">
                <div>
                  <span>Bulan target</span>
                  <strong>
                    {formatMonth(lifecycleDialog.recommendation.targetMonth)}
                  </strong>
                </div>
                <div>
                  <span>Alokasi yang diterapkan</span>
                  <strong>
                    {formatCurrency(
                      lifecycleDialog.recommendation.proposedAllocation,
                    )}
                  </strong>
                </div>
              </div>
            )}

            <footer>
              <button
                type="button"
                className="recommendations-secondary-button"
                onClick={closeLifecycleDialog}
                disabled={Boolean(isProcessingId)}
              >
                Batal
              </button>
              <button
                type="button"
                className={`recommendations-generate-button recommendation-dialog-submit${lifecycleDialog.type === "reject" ? " is-danger" : ""}`}
                onClick={() => {
                  if (lifecycleDialog.type === "reject") void handleReject();
                  else if (lifecycleDialog.type === "defer") void handleDefer();
                  else if (lifecycleDialog.type === "evaluate")
                    void handleEvaluate();
                  else void handleApply();
                }}
                disabled={
                  Boolean(isProcessingId) ||
                  (lifecycleDialog.type === "defer" && !deferDate)
                }
              >
                {isProcessingId ? (
                  <LoaderCircle size={15} className="is-spinning" />
                ) : lifecycleDialog.type === "reject" ? (
                  <Ban size={15} />
                ) : lifecycleDialog.type === "defer" ? (
                  <Clock3 size={15} />
                ) : lifecycleDialog.type === "evaluate" ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <Check size={15} />
                )}
                {isProcessingId
                  ? "Memproses…"
                  : lifecycleDialog.type === "reject"
                    ? "Ya, tolak"
                    : lifecycleDialog.type === "defer"
                      ? "Simpan penundaan"
                      : lifecycleDialog.type === "evaluate"
                        ? "Mulai evaluasi"
                        : "Ya, terapkan perubahan"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}

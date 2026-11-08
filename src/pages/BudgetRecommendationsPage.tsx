import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Info,
  Lightbulb,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
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

type MonthlySpending = {
  month: string;
  amount: string | number;
  transactionCount: number;
};

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

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(date);
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
                  </footer>
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

      <aside className="recommendations-phase-note">
        <span>
          <Info size={16} />
        </span>
        <p>
          Halaman ini digunakan untuk meninjau rekomendasi. Keputusan menerima,
          menolak, menunda, dan menerapkan rekomendasi akan tersedia pada tahap
          pengelolaan berikutnya.
        </p>
      </aside>
    </main>
  );
}

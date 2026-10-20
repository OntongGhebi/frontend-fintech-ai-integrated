import { useEffect, useState } from "react";

import { apiClient, ApiRequestError } from "../lib/api-client";
import "./DashboardPage.css";

interface DashboardSummary {
  currency: string;
  totalIncome: string;
  totalExpense: string;
  netCashFlow: string;
  transactionCount: number;
}

interface DashboardOverview {
  currency: string;
  summary: DashboardSummary;
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

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return "Tidak dapat terhubung ke backend. Pastikan server API sedang berjalan dan konfigurasi URL sudah benar.";
    }

    return error.message || "Dashboard gagal dimuat dari server.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Terjadi kesalahan yang tidak diketahui saat memuat dashboard.";
}

function getCurrentPeriodLabel(): string {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // const loadOverview = useCallback(async () => {
  //   setIsLoading(true);
  //   setErrorMessage(null);

  //   try {
  //     const response =
  //       await apiClient.get<DashboardOverview>("/dashboard/overview");

  //     if (!response?.summary) {
  //       throw new Error(
  //         "Respons dashboard tidak memiliki objek summary yang diharapkan.",
  //       );
  //     }

  //     setOverview(response);
  //   } catch (error: unknown) {
  //     setErrorMessage(getErrorMessage(error));
  //   } finally {
  //     setIsLoading(false);
  //   }
  // }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchOverview = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await apiClient.get<DashboardOverview>(
          "/dashboard/overview",
        );

        if (!response?.summary) {
          throw new Error(
            "Respons dashboard tidak memiliki objek summary yang diharapkan.",
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
    };

    void fetchOverview();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const currency = overview?.currency ?? overview?.summary.currency ?? "IDR";
  const summary = overview?.summary;

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
      description: "Jumlah transaksi pada periode ringkasan",
      icon: "#",
      tone: "neutral",
    },
  ];

  return (
    <section className="dashboard-page">
      <div className="dashboard-heading">
        <div className="dashboard-heading-copy">
          <span className="eyebrow">OVERVIEW</span>
          <h1>Ringkasan keuangan</h1>
          <p>Pantau pemasukan, pengeluaran, dan arus kas dari satu tempat.</p>
        </div>

        <div className="dashboard-heading-actions">
          <span className="dashboard-period">
            <span className="period-dot" aria-hidden="true" />
            {getCurrentPeriodLabel()}
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
          <span className="eyebrow">FINANCIAL WORKSPACE</span>
          <h2>Aktivitas keuangan Anda</h2>
        </div>
      </div>

      <div className="dashboard-next-steps">
        <div className="dashboard-next-steps-mark" aria-hidden="true">
          <span>✳</span>
        </div>
        <div className="dashboard-next-steps-copy">
          <h3>Semua data dalam satu workspace</h3>
          <p>
            Ringkasan di atas berasal dari API dashboard. Visualisasi arus kas,
            rincian akun, kategori transaksi, dan performa anggaran akan
            ditambahkan pada fase integrasi berikutnya.
          </p>
        </div>
      </div>
    </section>
  );
}

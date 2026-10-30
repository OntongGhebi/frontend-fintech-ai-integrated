import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RefreshCw,
  XCircle,
} from "lucide-react";

import { ApiRequestError, apiClient } from "../lib/api-client";
import "./SubscriptionHistorySection.css";

interface SubscriptionEvent {
  id: string;
  eventType: string;
  oldStatus?: string | null;
  newStatus?: string | null;
  createdAt: string;
  subscription?: {
    id?: string;
    billingInterval?: string | null;
    plan?: {
      code?: string;
      name?: string;
    } | null;
  } | null;
}

interface SubscriptionHistoryResponse {
  data?: SubscriptionEvent[];
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasNextPage?: boolean;
    hasPreviousPage?: boolean;
  };
}

const PAGE_SIZE = 10;

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return "Sesi Anda berakhir. Silakan login kembali.";
    }

    if (error.status === 403) {
      return "Anda tidak memiliki izin untuk melihat riwayat subscription.";
    }

    if (error.status >= 500) {
      return "Server sedang mengalami kendala. Silakan coba lagi.";
    }

    return error.message || "Riwayat subscription gagal dimuat.";
  }

  if (error instanceof TypeError) {
    return "Tidak dapat terhubung ke backend. Periksa koneksi dan konfigurasi API.";
  }

  return "Terjadi kesalahan saat memuat riwayat subscription.";
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) {
    return "Waktu tidak tersedia";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function statusLabel(value?: string | null): string {
  if (!value) return "—";

  const labels: Record<string, string> = {
    TRIALING: "Masa trial",
    ACTIVE: "Aktif",
    PAST_DUE: "Menunggu pembayaran",
    CANCELED: "Dibatalkan",
    EXPIRED: "Kedaluwarsa",
    PAUSED: "Dijeda",
  };

  return labels[value.toUpperCase()] ?? value;
}

function eventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    TRIAL_STARTED: "Trial dimulai",
    TRIAL_EXPIRED: "Trial berakhir",
    SUBSCRIBED: "Subscription dimulai",
    RENEWED: "Subscription diperpanjang",
    UPGRADED: "Paket ditingkatkan",
    DOWNGRADED: "Paket diubah",
    PAYMENT_FAILED: "Pembayaran gagal",
    CANCELED: "Pembatalan subscription",
    PAUSED: "Subscription dijeda",
    RESUMED: "Subscription dilanjutkan",
    EXPIRED: "Subscription berakhir",
  };

  return labels[eventType.toUpperCase()] ?? eventType.replaceAll("_", " ");
}

function EventIcon({ eventType }: { eventType: string }) {
  const normalized = eventType.toUpperCase();

  if (normalized.includes("CANCEL") || normalized.includes("FAIL")) {
    return <XCircle size={17} aria-hidden="true" />;
  }

  if (normalized.includes("TRIAL") || normalized.includes("PAUSE")) {
    return <Clock3 size={17} aria-hidden="true" />;
  }

  if (normalized.includes("RESUME") || normalized.includes("RENEW")) {
    return <CheckCircle2 size={17} aria-hidden="true" />;
  }

  return <CalendarClock size={17} aria-hidden="true" />;
}

export function SubscriptionHistorySection() {
  const [events, setEvents] = useState<SubscriptionEvent[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await apiClient.get<SubscriptionHistoryResponse>(
        `subscriptions/history?page=${page}&limit=${PAGE_SIZE}`,
      );

      setEvents(Array.isArray(response.data) ? response.data : []);
      setTotal(response.meta?.total ?? 0);
      setTotalPages(response.meta?.totalPages ?? 0);
    } catch (requestError) {
      setEvents([]);
      setTotal(0);
      setTotalPages(0);
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, reloadKey]);

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <section
      className="subscription-history"
      aria-labelledby="subscription-history-title"
    >
      <header className="subscription-history-header">
        <div>
          <span className="subscription-section-eyebrow">
            AKTIVITAS LANGGANAN
          </span>

          <h3 id="subscription-history-title">Riwayat subscription</h3>
        </div>

        <button
          type="button"
          className="subscription-secondary-button"
          onClick={() => setReloadKey((current) => current + 1)}
          disabled={isLoading}
        >
          {isLoading ? (
            <RefreshCw size={15} className="subscription-history-spin" />
          ) : (
            <RefreshCw size={15} />
          )}
          <span>Perbarui</span>
        </button>
      </header>

      {isLoading ? (
        <div className="subscription-history-state" role="status">
          <span className="subscription-history-loader" />
          <strong>Memuat riwayat subscription</strong>
          <p>Mohon tunggu sebentar.</p>
        </div>
      ) : error ? (
        <div
          className="subscription-history-state subscription-history-error"
          role="alert"
        >
          <AlertCircle size={25} aria-hidden="true" />
          <strong>Riwayat gagal dimuat</strong>
          <p>{error}</p>

          <button
            type="button"
            className="subscription-primary-button"
            onClick={() => setReloadKey((current) => current + 1)}
          >
            Coba lagi
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="subscription-history-state">
          <CalendarClock size={27} aria-hidden="true" />
          <strong>Belum ada aktivitas subscription</strong>
          <p>
            Perubahan subscription akan tercatat di sini setelah aktivitas
            dilakukan.
          </p>
        </div>
      ) : (
        <>
          <ol className="subscription-history-list">
            {events.map((event) => (
              <li className="subscription-history-item" key={event.id}>
                <span className="subscription-history-icon">
                  <EventIcon eventType={event.eventType} />
                </span>

                <div className="subscription-history-content">
                  <div className="subscription-history-title-row">
                    <strong>{eventLabel(event.eventType)}</strong>

                    <time dateTime={event.createdAt}>
                      {formatDateTime(event.createdAt)}
                    </time>
                  </div>

                  <p>
                    {event.subscription?.plan?.name ?? "Subscription"}
                    {event.subscription?.billingInterval
                      ? ` · ${event.subscription.billingInterval}`
                      : ""}
                  </p>

                  {(event.oldStatus || event.newStatus) && (
                    <div className="subscription-history-transition">
                      {event.oldStatus ? (
                        <span>{statusLabel(event.oldStatus)}</span>
                      ) : (
                        <span>Status awal</span>
                      )}

                      <span aria-hidden="true">→</span>

                      <strong>{statusLabel(event.newStatus)}</strong>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <footer className="subscription-history-pagination">
            <span>
              Menampilkan {rangeStart}–{rangeEnd} dari {total} aktivitas
            </span>

            {totalPages > 1 && (
              <div>
                <button
                  type="button"
                  aria-label="Halaman sebelumnya"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft size={17} />
                </button>

                <span>
                  {page} / {totalPages}
                </span>

                <button
                  type="button"
                  aria-label="Halaman berikutnya"
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  disabled={page >= totalPages}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            )}
          </footer>
        </>
      )}
    </section>
  );
}

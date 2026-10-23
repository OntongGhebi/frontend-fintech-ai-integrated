import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

import { ApiRequestError, apiClient } from "../lib/api-client";
import "./PaymentsPage.css";

type PaymentStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "CANCELED"
  | string;

interface PaymentSubscription {
  id?: string;
  plan?: {
    name?: string;
    code?: string;
  } | null;
}

interface PaymentRecord {
  id: string;
  subscriptionId?: string;
  amount: number | string;
  currency?: string;
  status: PaymentStatus;
  provider?: string;
  providerPaymentId?: string | null;
  paidAt?: string | null;
  failedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  subscription?: PaymentSubscription | null;
}

interface PaymentHistoryMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

interface PaymentHistoryPayload {
  data?: PaymentRecord[] | { items?: PaymentRecord[] };
  items?: PaymentRecord[];
  payments?: PaymentRecord[];
  meta?: PaymentHistoryMeta;
  pagination?: PaymentHistoryMeta;
}

interface CurrentSubscription {
  id: string;
  status: string;
  plan?: {
    name?: string;
    code?: string;
  } | null;
}

interface CurrentSubscriptionPayload {
  data?: CurrentSubscription | null;
  subscription?: CurrentSubscription | null;
}

interface CheckoutResponse {
  payment: {
    id: string;
    subscriptionId?: string;
    amount?: number | string;
    currency?: string;
    status?: string;
    provider?: string;
    createdAt?: string;
  };
  checkout: {
    provider: string;
    snapToken?: string;
    redirectUrl: string;
  };
}

const PAGE_SIZE = 10;

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return "Sesi Anda berakhir. Silakan login kembali.";
    }

    if (error.status === 403) {
      return "Anda tidak memiliki izin untuk melihat atau melakukan pembayaran ini.";
    }

    if (error.status === 404) {
      return error.message || "Data yang diminta tidak ditemukan.";
    }

    if (error.status === 409) {
      return (
        error.message ||
        "Pembayaran tidak dapat diproses dalam kondisi saat ini."
      );
    }

    if (error.status >= 500) {
      return "Server sedang mengalami kendala. Silakan coba lagi.";
    }

    return error.message || "Permintaan pembayaran gagal.";
  }

  if (error instanceof TypeError) {
    return "Tidak dapat terhubung ke backend. Periksa koneksi dan konfigurasi API.";
  }

  return "Terjadi kesalahan yang tidak terduga. Silakan coba lagi.";
}

function unwrapPayments(payload: PaymentHistoryPayload): PaymentRecord[] {
  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (payload.data && !Array.isArray(payload.data)) {
    return payload.data.items ?? [];
  }

  return payload.items ?? payload.payments ?? [];
}

function unwrapCurrentSubscription(
  payload: CurrentSubscription | CurrentSubscriptionPayload | null,
): CurrentSubscription | null {
  if (!payload) return null;

  if ("data" in payload) return payload.data ?? null;
  if ("subscription" in payload) return payload.subscription ?? null;

  return payload as CurrentSubscription;
}

function getPagination(
  payload: PaymentHistoryPayload,
  currentPage: number,
): PaymentHistoryMeta {
  const meta = payload.meta ?? payload.pagination;

  return {
    page: meta?.page ?? currentPage,
    limit: meta?.limit ?? PAGE_SIZE,
    total: meta?.total,
    totalPages: meta?.totalPages,
  };
}

function formatAmount(amount: number | string, currency = "IDR"): string {
  const numericAmount =
    typeof amount === "number" ? amount : Number.parseFloat(amount);

  if (!Number.isFinite(numericAmount)) {
    return `${amount} ${currency}`;
  }

  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(numericAmount);
  } catch {
    return `${numericAmount.toLocaleString("id-ID")} ${currency}`;
  }
}

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function getStatusLabel(status: PaymentStatus): string {
  switch (status.toUpperCase()) {
    case "PENDING":
      return "Menunggu pembayaran";
    case "PAID":
      return "Berhasil";
    case "FAILED":
      return "Gagal";
    case "REFUNDED":
      return "Dikembalikan";
    case "CANCELED":
      return "Dibatalkan";
    default:
      return status;
  }
}

function getStatusClass(status: PaymentStatus): string {
  switch (status.toUpperCase()) {
    case "PAID":
      return "payment-status-paid";
    case "PENDING":
      return "payment-status-pending";
    case "FAILED":
      return "payment-status-failed";
    case "REFUNDED":
      return "payment-status-refunded";
    case "CANCELED":
      return "payment-status-canceled";
    default:
      return "payment-status-neutral";
  }
}

function StatusIcon({ status }: { status: PaymentStatus }) {
  switch (status.toUpperCase()) {
    case "PAID":
      return <CheckCircle2 size={16} aria-hidden="true" />;
    case "PENDING":
      return <Clock3 size={16} aria-hidden="true" />;
    case "FAILED":
    case "CANCELED":
      return <XCircle size={16} aria-hidden="true" />;
    case "REFUNDED":
      return <ArrowDownLeft size={16} aria-hidden="true" />;
    default:
      return <CreditCard size={16} aria-hidden="true" />;
  }
}

/**
 * Allow only official Midtrans web checkout hosts.
 * A checkout response does not prove that the payment has been completed.
 */
function isAllowedMidtransCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      ["app.midtrans.com", "app.sandbox.midtrans.com"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [subscription, setSubscription] = useState<CurrentSubscription | null>(
    null,
  );
  const [pagination, setPagination] = useState<PaymentHistoryMeta>({
    page: 1,
    limit: PAGE_SIZE,
  });

  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const loadPayments = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      const [historyResult, subscriptionResult] = await Promise.all([
        apiClient.get<PaymentHistoryPayload>(
          `payments/history?page=${page}&limit=${PAGE_SIZE}`,
        ),
        apiClient
          .get<CurrentSubscription | CurrentSubscriptionPayload | null>(
            "subscriptions/me",
          )
          .then(unwrapCurrentSubscription)
          .catch((error: unknown) => {
            if (error instanceof ApiRequestError && error.status === 404) {
              return null;
            }

            throw error;
          }),
      ]);

      setPayments(unwrapPayments(historyResult));
      setPagination(getPagination(historyResult, page));
      setSubscription(subscriptionResult);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments, reloadKey]);

  const totalPaid = useMemo(
    () =>
      payments.reduce((total, payment) => {
        if (payment.status.toUpperCase() !== "PAID") return total;

        const amount =
          typeof payment.amount === "number"
            ? payment.amount
            : Number.parseFloat(payment.amount);

        return total + (Number.isFinite(amount) ? amount : 0);
      }, 0),
    [payments],
  );

  const pendingCount = useMemo(
    () =>
      payments.filter((payment) => payment.status.toUpperCase() === "PENDING")
        .length,
    [payments],
  );

  const currentSubscriptionCanBePaid =
    Boolean(subscription?.id) &&
    ["ACTIVE", "PAST_DUE", "TRIALING"].includes(
      subscription?.status.toUpperCase() ?? "",
    );

  async function handleCheckout() {
    if (!subscription?.id || isCheckingOut) return;

    setCheckoutError("");

    if (
      !window.confirm(
        "Lanjutkan ke halaman pembayaran Midtrans untuk subscription saat ini?",
      )
    ) {
      return;
    }

    setIsCheckingOut(true);

    try {
      const result = await apiClient.post<CheckoutResponse>(
        "payments/checkout",
        {
          subscriptionId: subscription.id,
        },
      );

      const redirectUrl = result?.checkout?.redirectUrl;

      if (
        typeof redirectUrl !== "string" ||
        !isAllowedMidtransCheckoutUrl(redirectUrl)
      ) {
        throw new Error(
          "Backend mengembalikan URL checkout Midtrans yang tidak valid.",
        );
      }

      // Status pembayaran tetap ditentukan backend setelah verifikasi.
      window.location.assign(redirectUrl);
    } catch (error) {
      setCheckoutError(
        error instanceof Error &&
          !(error instanceof ApiRequestError) &&
          error.message.includes("URL checkout")
          ? error.message
          : getErrorMessage(error),
      );
      setIsCheckingOut(false);
    }
  }

  const totalPages =
    pagination.totalPages ??
    (typeof pagination.total === "number"
      ? Math.max(1, Math.ceil(pagination.total / PAGE_SIZE))
      : null);

  const totalLabel =
    typeof pagination.total === "number"
      ? `${pagination.total} pembayaran`
      : `${payments.length} pembayaran pada halaman ini`;

  return (
    <section className="payments-page" aria-labelledby="payments-title">
      <header className="payments-page-heading">
        <div>
          <span className="payments-eyebrow">BILLING CENTER</span>
          <h2 id="payments-title">Payments</h2>
          <p>
            Kelola pembayaran subscription dan periksa riwayat transaksi
            Midtrans Anda.
          </p>
        </div>

        <button
          type="button"
          className="payments-secondary-button"
          onClick={() => setReloadKey((value) => value + 1)}
          disabled={isLoading}
        >
          {isLoading ? (
            <LoaderCircle
              size={16}
              className="payments-spin"
              aria-hidden="true"
            />
          ) : (
            <RefreshCw size={16} aria-hidden="true" />
          )}
          <span>Muat ulang</span>
        </button>
      </header>

      {checkoutError && (
        <div className="payments-alert" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{checkoutError}</span>
        </div>
      )}

      <section className="payments-checkout-panel">
        <div className="payments-checkout-copy">
          <span className="payments-checkout-icon">
            <CreditCard size={23} aria-hidden="true" />
          </span>

          <div>
            <span className="payments-section-eyebrow">
              PEMBAYARAN SUBSCRIPTION
            </span>
            <h3>Kelola pembayaran Anda</h3>
            <p>
              Checkout diproses melalui Midtrans. Status pembayaran akan
              diperbarui oleh backend setelah notifikasi pembayaran
              terverifikasi.
            </p>
          </div>
        </div>

        {currentSubscriptionCanBePaid ? (
          <div className="payments-checkout-action">
            <button
              type="button"
              className="payments-primary-button"
              onClick={() => void handleCheckout()}
              disabled={isCheckingOut}
            >
              {isCheckingOut ? (
                <LoaderCircle
                  size={17}
                  className="payments-spin"
                  aria-hidden="true"
                />
              ) : (
                <ExternalLink size={17} aria-hidden="true" />
              )}
              <span>
                {isCheckingOut
                  ? "Menyiapkan checkout..."
                  : "Lanjut ke Midtrans"}
              </span>
            </button>
          </div>
        ) : (
          <Link
            to="/subscription"
            className="payments-primary-button payments-link-button"
          >
            <CreditCard size={17} aria-hidden="true" />
            <span>Lihat subscription</span>
          </Link>
        )}
      </section>

      {pendingCount > 0 && !isLoading && !loadError && (
        <div className="payments-alert" role="status">
          <Clock3 size={18} aria-hidden="true" />
          <span>
            Ada {pendingCount} pembayaran yang masih menunggu konfirmasi pada
            halaman ini. Muat ulang riwayat untuk memeriksa status terbaru.
            Status hanya berubah setelah backend menerima atau memverifikasi
            pembaruan pembayaran.
          </span>
        </div>
      )}

      <div className="payments-summary-grid">
        <article className="payments-summary-card">
          <span className="payments-summary-icon payments-summary-icon-paid">
            <CheckCircle2 size={19} aria-hidden="true" />
          </span>
          <div>
            <span>Total pembayaran berhasil di halaman ini</span>
            <strong>{formatAmount(totalPaid)}</strong>
          </div>
        </article>

        <article className="payments-summary-card">
          <span className="payments-summary-icon payments-summary-icon-pending">
            <Clock3 size={19} aria-hidden="true" />
          </span>
          <div>
            <span>Pembayaran menunggu di halaman ini</span>
            <strong>{pendingCount}</strong>
          </div>
        </article>

        <article className="payments-summary-card">
          <span className="payments-summary-icon payments-summary-icon-total">
            <CalendarDays size={19} aria-hidden="true" />
          </span>
          <div>
            <span>Riwayat</span>
            <strong>{totalLabel}</strong>
          </div>
        </article>
      </div>

      <section className="payments-history-panel">
        <header className="payments-history-header">
          <div>
            <h3>Riwayat pembayaran</h3>
            <p>Daftar transaksi pembayaran yang tercatat di backend.</p>
          </div>

          <span className="payments-secure-label">
            <ShieldCheck size={15} aria-hidden="true" />
            Midtrans
          </span>
        </header>

        {isLoading ? (
          <div className="payments-state" role="status">
            <LoaderCircle
              size={29}
              className="payments-spin"
              aria-hidden="true"
            />
            <strong>Memuat riwayat pembayaran</strong>
            <p>Mohon tunggu sebentar.</p>
          </div>
        ) : loadError ? (
          <div className="payments-state payments-state-error" role="alert">
            <AlertCircle size={28} aria-hidden="true" />
            <strong>Riwayat pembayaran gagal dimuat</strong>
            <p>{loadError}</p>
            <button
              type="button"
              className="payments-primary-button"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              Coba lagi
            </button>
          </div>
        ) : payments.length === 0 ? (
          <div className="payments-state">
            <span className="payments-empty-icon">
              <CreditCard size={26} aria-hidden="true" />
            </span>
            <strong>Belum ada riwayat pembayaran</strong>
            <p>
              Pembayaran yang dibuat akan muncul di sini setelah tercatat oleh
              backend.
            </p>
          </div>
        ) : (
          <>
            <div className="payments-table-wrap">
              <table className="payments-table">
                <thead>
                  <tr>
                    <th scope="col">Pembayaran</th>
                    <th scope="col">Tanggal</th>
                    <th scope="col">Jumlah</th>
                    <th scope="col">Status</th>
                    <th scope="col">Provider</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        <div className="payments-id-cell">
                          <span className="payments-row-icon">
                            <CreditCard size={17} aria-hidden="true" />
                          </span>
                          <div>
                            <strong>
                              {payment.subscription?.plan?.name ??
                                "Subscription"}
                            </strong>
                            <span title={payment.id}>
                              ID: {payment.id.slice(0, 8)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="payments-date">
                          {formatDate(payment.createdAt)}
                        </span>
                      </td>
                      <td>
                        <strong className="payments-amount">
                          {formatAmount(
                            payment.amount,
                            payment.currency || "IDR",
                          )}
                        </strong>
                      </td>
                      <td>
                        <span
                          className={`payments-status ${getStatusClass(
                            payment.status,
                          )}`}
                        >
                          <StatusIcon status={payment.status} />
                          {getStatusLabel(payment.status)}
                        </span>
                      </td>
                      <td>
                        <span className="payments-provider">
                          {payment.provider || "Midtrans"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer className="payments-pagination">
              <span>
                Halaman {page}
                {totalPages ? ` dari ${totalPages}` : ""}
              </span>

              <div>
                <button
                  type="button"
                  className="payments-secondary-button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1 || isLoading}
                >
                  Sebelumnya
                </button>

                <button
                  type="button"
                  className="payments-secondary-button"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={
                    isLoading ||
                    (totalPages !== null
                      ? page >= totalPages
                      : payments.length < PAGE_SIZE)
                  }
                >
                  Berikutnya
                  <ArrowUpRight size={15} aria-hidden="true" />
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </section>
  );
}

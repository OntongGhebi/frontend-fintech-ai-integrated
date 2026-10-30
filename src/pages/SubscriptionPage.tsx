import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Check,
  Clock3,
  CreditCard,
  Crown,
  LoaderCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

import { ApiRequestError, apiClient } from "../lib/api-client";
import { SubscriptionHistorySection } from "./SubscriptionHistorySection";
import "./SubscriptionPage.css";
import "./SubscriptionPage.refinement.css";

type SubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "EXPIRED"
  | "PAUSED"
  | string;

interface SubscriptionPlan {
  id?: string;
  code?: string;
  name?: string;
  description?: string | null;
}

interface Subscription {
  id: string;
  status: SubscriptionStatus;
  billingInterval?: string | null;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string | null;
  plan?: SubscriptionPlan | null;
  createdAt?: string;
  updatedAt?: string;
}

interface SubscriptionPayload {
  data?: Subscription | null;
  subscription?: Subscription | null;
}

type Feedback = {
  kind: "success" | "error";
  message: string;
};

function unwrapSubscriptionPayload(
  payload: Subscription | SubscriptionPayload | null,
): Subscription | null {
  if (!payload) return null;
  if ("data" in payload) return payload.data ?? null;
  if ("subscription" in payload) return payload.subscription ?? null;
  return payload as Subscription;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401)
      return "Sesi Anda berakhir. Silakan login kembali.";
    if (error.status === 403)
      return "Anda tidak memiliki izin untuk melakukan tindakan ini.";
    if (error.status === 409) {
      return (
        error.message ||
        "Tindakan tidak dapat dilakukan pada status subscription saat ini."
      );
    }
    if (error.status >= 500)
      return "Server sedang mengalami kendala. Silakan coba lagi.";
    return error.message || "Permintaan tidak dapat diproses.";
  }
  if (error instanceof TypeError) {
    return "Tidak dapat terhubung ke backend. Periksa koneksi dan konfigurasi API.";
  }
  return "Terjadi kesalahan yang tidak terduga. Silakan coba lagi.";
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function getStatusLabel(status?: SubscriptionStatus): string {
  switch (status?.toUpperCase()) {
    case "TRIALING":
      return "Masa trial";
    case "ACTIVE":
      return "Aktif";
    case "PAST_DUE":
      return "Menunggu pembayaran";
    case "CANCELED":
      return "Dibatalkan";
    case "EXPIRED":
      return "Kedaluwarsa";
    case "PAUSED":
      return "Dijeda";
    default:
      return status || "Tidak diketahui";
  }
}

function getStatusClass(status?: SubscriptionStatus): string {
  switch (status?.toUpperCase()) {
    case "ACTIVE":
      return "subscription-status-active";
    case "TRIALING":
      return "subscription-status-trialing";
    case "PAST_DUE":
      return "subscription-status-warning";
    case "CANCELED":
    case "EXPIRED":
      return "subscription-status-inactive";
    case "PAUSED":
      return "subscription-status-paused";
    default:
      return "subscription-status-neutral";
  }
}

function getDaysRemaining(value?: string | null): number | null {
  if (!value) return null;
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return null;
  return Math.max(0, Math.ceil((target - Date.now()) / 86_400_000));
}

export function SubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busyAction, setBusyAction] = useState<"cancel" | "resume" | null>(
    null,
  );
  const [reloadKey, setReloadKey] = useState(0);

  const loadSubscription = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const payload = await apiClient
        .get<Subscription | SubscriptionPayload | null>("subscriptions/me")
        .catch((error: unknown) => {
          if (error instanceof ApiRequestError && error.status === 404)
            return null;
          throw error;
        });
      setSubscription(unwrapSubscriptionPayload(payload));
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSubscription();
  }, [loadSubscription, reloadKey]);

  const activeSubscription = useMemo(
    () =>
      Boolean(
        subscription &&
        ["TRIALING", "ACTIVE", "PAST_DUE", "PAUSED"].includes(
          subscription.status.toUpperCase(),
        ),
      ),
    [subscription],
  );
  const trialDaysRemaining = getDaysRemaining(subscription?.trialEndsAt);
  const canCancel = Boolean(
    subscription &&
    ["TRIALING", "ACTIVE"].includes(subscription.status.toUpperCase()) &&
    !subscription.cancelAtPeriodEnd,
  );
  const canResume = Boolean(
    subscription &&
    subscription.cancelAtPeriodEnd &&
    ["TRIALING", "ACTIVE"].includes(subscription.status.toUpperCase()),
  );

  async function handleCancelSubscription() {
    if (!subscription || busyAction || !canCancel) return;
    const isTrial = subscription.status.toUpperCase() === "TRIALING";
    const message = isTrial
      ? "Trial akan dibatalkan. Setelah dibatalkan, akses trial mungkin tidak dapat dipulihkan. Lanjutkan?"
      : "Pembatalan akan dijadwalkan sesuai periode berlangganan saat ini. Lanjutkan?";
    if (!window.confirm(message)) return;

    setBusyAction("cancel");
    setFeedback(null);
    try {
      await apiClient.patch("subscriptions/me/cancel");
      setFeedback({
        kind: "success",
        message: isTrial
          ? "Permintaan pembatalan trial berhasil diproses."
          : "Pembatalan subscription berhasil dijadwalkan.",
      });
      await loadSubscription();
    } catch (error) {
      setFeedback({ kind: "error", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleResumeSubscription() {
    if (!subscription || busyAction || !canResume) return;
    if (
      !window.confirm(
        "Batalkan jadwal pembatalan subscription dan lanjutkan langganan?",
      )
    )
      return;

    setBusyAction("resume");
    setFeedback(null);
    try {
      await apiClient.patch("subscriptions/me/resume");
      setFeedback({
        kind: "success",
        message: "Subscription berhasil dilanjutkan.",
      });
      await loadSubscription();
    } catch (error) {
      setFeedback({ kind: "error", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="subscription-page" aria-label="Subscription akun">
      {feedback && (
        <div
          className={`subscription-feedback subscription-feedback-${feedback.kind}`}
          role={feedback.kind === "error" ? "alert" : "status"}
        >
          {feedback.kind === "error" ? (
            <AlertCircle size={18} aria-hidden="true" />
          ) : (
            <BadgeCheck size={18} aria-hidden="true" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {loadError && (
        <div
          className="subscription-feedback subscription-feedback-error"
          role="alert"
        >
          <AlertCircle size={18} aria-hidden="true" />
          <span>{loadError}</span>
          <button
            type="button"
            className="subscription-inline-retry"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            Coba lagi
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="subscription-loading" role="status">
          <LoaderCircle
            size={30}
            className="subscription-spin"
            aria-hidden="true"
          />
          <strong>Memuat subscription</strong>
          <p>Mengambil informasi paket yang sedang berjalan.</p>
        </div>
      ) : (
        <>
          {(!loadError || subscription) && (
            <section
              className="subscription-current-panel"
              aria-labelledby="subscription-current-title"
            >
              <div className="subscription-current-main">
                <div className="subscription-current-icon">
                  <Crown size={24} aria-hidden="true" />
                </div>
                <div className="subscription-current-copy">
                  <span className="subscription-section-eyebrow">
                    LANGGANAN SAAT INI
                  </span>
                  <h3 id="subscription-current-title">
                    {subscription?.plan?.name ??
                      (subscription ? "Paket pengguna" : "Belum berlangganan")}
                  </h3>
                  <p>
                    {subscription?.plan?.description ??
                      (subscription
                        ? "Informasi paket tersedia pada detail subscription."
                        : "Pilih paket yang sesuai untuk mulai menggunakan fitur Fintech AI.")}
                  </p>
                  {!subscription && (
                    <Link
                      to="/plans"
                      className="subscription-primary-button subscription-plans-cta"
                    >
                      Lihat pilihan paket
                    </Link>
                  )}
                </div>
              </div>

              {subscription ? (
                <div className="subscription-current-details">
                  <span
                    className={`subscription-status ${getStatusClass(subscription.status)}`}
                  >
                    {getStatusLabel(subscription.status)}
                  </span>

                  <div className="subscription-detail-grid">
                    <div>
                      <span>Mulai periode</span>
                      <strong>
                        {formatDate(
                          subscription.trialStartedAt ??
                            subscription.currentPeriodStart ??
                            subscription.createdAt,
                        )}
                      </strong>
                    </div>
                    <div>
                      <span>
                        {subscription.status.toUpperCase() === "TRIALING"
                          ? "Trial berakhir"
                          : "Periode berakhir"}
                      </span>
                      <strong>
                        {formatDate(
                          subscription.trialEndsAt ??
                            subscription.currentPeriodEnd,
                        )}
                      </strong>
                    </div>
                    {subscription.status.toUpperCase() === "TRIALING" &&
                      trialDaysRemaining !== null && (
                        <div>
                          <span>Sisa trial</span>
                          <strong>{trialDaysRemaining} hari</strong>
                        </div>
                      )}
                  </div>

                  {subscription.cancelAtPeriodEnd && (
                    <div className="subscription-cancellation-notice">
                      <Clock3 size={17} aria-hidden="true" />
                      <span>
                        Akses subscription tetap berlaku sampai{" "}
                        {formatDate(subscription.currentPeriodEnd)}.
                      </span>
                    </div>
                  )}

                  <div className="subscription-current-actions">
                    {canCancel && (
                      <button
                        type="button"
                        className="subscription-danger-button"
                        onClick={() => void handleCancelSubscription()}
                        disabled={busyAction !== null}
                      >
                        {busyAction === "cancel" ? (
                          <LoaderCircle
                            size={16}
                            className="subscription-spin"
                          />
                        ) : (
                          <CreditCard size={16} />
                        )}
                        <span>
                          {busyAction === "cancel"
                            ? "Memproses..."
                            : "Batalkan subscription"}
                        </span>
                      </button>
                    )}
                    {canResume && (
                      <button
                        type="button"
                        className="subscription-primary-button"
                        onClick={() => void handleResumeSubscription()}
                        disabled={busyAction !== null}
                      >
                        {busyAction === "resume" ? (
                          <LoaderCircle
                            size={16}
                            className="subscription-spin"
                          />
                        ) : (
                          <Check size={16} />
                        )}
                        <span>
                          {busyAction === "resume"
                            ? "Memproses..."
                            : "Lanjutkan subscription"}
                        </span>
                      </button>
                    )}
                  </div>
                  {!activeSubscription && (
                    <Link
                      to="/plans"
                      className="subscription-secondary-button subscription-plans-cta"
                    >
                      Lihat paket lainnya
                    </Link>
                  )}
                </div>
              ) : (
                <div className="subscription-no-current">
                  <span className="subscription-status subscription-status-neutral">
                    Belum berlangganan
                  </span>
                  <p>Belum ada paket aktif pada akun ini.</p>
                </div>
              )}
            </section>
          )}

          <SubscriptionHistorySection />
        </>
      )}
    </section>
  );
}

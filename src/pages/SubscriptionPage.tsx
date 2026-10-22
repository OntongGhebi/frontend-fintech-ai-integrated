import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  CalendarDays,
  Check,
  Clock3,
  CreditCard,
  Crown,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { ApiRequestError, apiClient } from "../lib/api-client";
import "./SubscriptionPage.css";

type SubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "EXPIRED"
  | "PAUSED"
  | string;

type PlanFeature =
  | string
  | {
      code?: string;
      featureCode?: string;
      name?: string;
      description?: string;
      enabled?: boolean;
      limitValue?: number | null;
      limitPeriod?: string | null;
    };

interface Plan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  price: string | number;
  currency: string;
  billingInterval?: string | null;
  isActive?: boolean;
  features?: PlanFeature[];
}

interface Subscription {
  id: string;
  userId?: string;
  planId?: string;
  status: SubscriptionStatus;
  billingInterval?: string | null;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string | null;
  plan?: Plan | null;
  createdAt?: string;
  updatedAt?: string;
}

interface PlansPayload {
  data?: Plan[];
  items?: Plan[];
  plans?: Plan[];
}

interface SubscriptionPayload {
  data?: Subscription | null;
  subscription?: Subscription | null;
}

type Feedback = {
  kind: "success" | "error";
  message: string;
};

function unwrapPlanPayload(payload: Plan[] | PlansPayload): Plan[] {
  if (Array.isArray(payload)) return payload;
  return payload.data ?? payload.items ?? payload.plans ?? [];
}

function unwrapSubscriptionPayload(
  payload: Subscription | SubscriptionPayload | null,
): Subscription | null {
  if (!payload) return null;

  if ("data" in payload) {
    return payload.data ?? null;
  }

  if ("subscription" in payload) {
    return payload.subscription ?? null;
  }

  return payload as Subscription;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return "Sesi Anda berakhir. Silakan login kembali.";
    }

    if (error.status === 403) {
      return "Anda tidak memiliki izin untuk melakukan tindakan ini.";
    }

    if (error.status === 409) {
      return (
        error.message ||
        "Tindakan tidak dapat dilakukan karena kondisi subscription saat ini."
      );
    }

    if (error.status >= 500) {
      return "Server sedang mengalami kendala. Silakan coba lagi.";
    }

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

function formatPrice(price: string | number, currency = "IDR"): string {
  const numericPrice =
    typeof price === "number" ? price : Number.parseFloat(price);

  if (!Number.isFinite(numericPrice)) {
    return `${price} ${currency}`;
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(numericPrice);
}

function formatInterval(interval?: string | null): string {
  if (!interval) return "periode";

  const normalized = interval.toLowerCase();

  if (normalized.includes("month")) return "bulan";
  if (normalized.includes("year") || normalized.includes("annual")) {
    return "tahun";
  }
  if (normalized.includes("week")) return "minggu";
  if (normalized.includes("day")) return "hari";

  return normalized;
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

function getFeatureLabel(feature: PlanFeature): string | null {
  if (typeof feature === "string") {
    return feature;
  }

  if (feature.enabled === false) return null;

  const label =
    feature.name ?? feature.description ?? feature.featureCode ?? feature.code;

  if (!label) return null;

  if (typeof feature.limitValue === "number" && feature.limitValue >= 0) {
    const period = feature.limitPeriod
      ? ` / ${feature.limitPeriod.toLowerCase()}`
      : "";

    return `${label}: ${feature.limitValue}${period}`;
  }

  return label;
}

function getDaysRemaining(value?: string | null): number | null {
  if (!value) return null;

  const target = new Date(value).getTime();

  if (Number.isNaN(target)) return null;

  return Math.max(0, Math.ceil((target - Date.now()) / 86_400_000));
}

export function SubscriptionPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busyAction, setBusyAction] = useState<
    "trial" | "cancel" | "resume" | null
  >(null);
  const [selectedPlanCode, setSelectedPlanCode] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadSubscriptionData = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      const plansRequest = apiClient.get<Plan[] | PlansPayload>("plans");

      const subscriptionRequest = apiClient
        .get<Subscription | SubscriptionPayload | null>("subscriptions/me")
        .then((payload) => unwrapSubscriptionPayload(payload))
        .catch((error: unknown) => {
          if (error instanceof ApiRequestError && error.status === 404) {
            return null;
          }

          throw error;
        });

      const [plansResponse, currentSubscription] = await Promise.all([
        plansRequest,
        subscriptionRequest,
      ]);

      setPlans(
        unwrapPlanPayload(plansResponse).filter(
          (plan) => plan.isActive !== false,
        ),
      );
      setSubscription(currentSubscription);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSubscriptionData();
  }, [loadSubscriptionData, reloadKey]);

  const activeSubscription = useMemo(() => {
    if (!subscription) return false;

    return ["TRIALING", "ACTIVE", "PAST_DUE", "PAUSED"].includes(
      subscription.status.toUpperCase(),
    );
  }, [subscription]);

  const currentPlanCode = subscription?.plan?.code ?? null;

  const trialDaysRemaining = getDaysRemaining(subscription?.trialEndsAt);

  async function handleStartTrial(plan: Plan) {
    if (busyAction) return;

    const confirmed = window.confirm(
      `Mulai trial untuk paket ${plan.name}? Backend hanya mengizinkan satu kali trial per pengguna.`,
    );

    if (!confirmed) return;

    setBusyAction("trial");
    setSelectedPlanCode(plan.code);
    setFeedback(null);
    setLoadError("");

    try {
      await apiClient.post("subscriptions/trial", {
        planCode: plan.code,
      });

      setFeedback({
        kind: "success",
        message: `Permintaan trial paket ${plan.name} berhasil diproses.`,
      });

      await loadSubscriptionData();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setBusyAction(null);
      setSelectedPlanCode(null);
    }
  }

  async function handleCancelSubscription() {
    if (!subscription || busyAction) return;

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

      await loadSubscriptionData();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleResumeSubscription() {
    if (!subscription || busyAction) return;

    if (
      !window.confirm(
        "Batalkan jadwal pembatalan subscription dan lanjutkan langganan?",
      )
    ) {
      return;
    }

    setBusyAction("resume");
    setFeedback(null);

    try {
      await apiClient.patch("subscriptions/me/resume");

      setFeedback({
        kind: "success",
        message: "Subscription berhasil dilanjutkan.",
      });

      await loadSubscriptionData();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setBusyAction(null);
    }
  }

  const canStartTrial =
    !activeSubscription &&
    subscription?.status.toUpperCase() !== "CANCELED" &&
    subscription?.status.toUpperCase() !== "EXPIRED";

  const canCancel =
    Boolean(subscription) &&
    ["TRIALING", "ACTIVE", "PAST_DUE"].includes(
      subscription?.status.toUpperCase() ?? "",
    ) &&
    !subscription?.cancelAtPeriodEnd;

  const canResume =
    Boolean(subscription) &&
    subscription?.cancelAtPeriodEnd === true &&
    ["ACTIVE", "PAST_DUE"].includes(subscription?.status.toUpperCase() ?? "");

  return (
    <section
      className="subscription-page"
      aria-labelledby="subscription-page-title"
    >
      <header className="subscription-page-heading">
        <div>
          <span className="subscription-eyebrow">PLAN & BILLING</span>
          <h2 id="subscription-page-title">Subscription</h2>
          <p>Kelola paket, akses fitur, dan status langganan akun Anda.</p>
        </div>

        <button
          type="button"
          className="subscription-secondary-button"
          onClick={() => setReloadKey((value) => value + 1)}
          disabled={isLoading}
        >
          {isLoading ? (
            <LoaderCircle size={16} className="subscription-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          <span>Muat ulang</span>
        </button>
      </header>

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
          <strong>Memuat informasi subscription</strong>
          <p>Mengambil paket dan status langganan Anda.</p>
        </div>
      ) : (
        <>
          <section className="subscription-current-panel">
            <div className="subscription-current-main">
              <div className="subscription-current-icon">
                <Crown size={24} aria-hidden="true" />
              </div>

              <div className="subscription-current-copy">
                <span className="subscription-section-eyebrow">
                  LANGGANAN SAAT INI
                </span>
                <h3>
                  {subscription?.plan?.name ??
                    (subscription ? "Paket pengguna" : "Belum berlangganan")}
                </h3>
                <p>
                  {subscription?.plan?.description ??
                    (subscription
                      ? "Informasi paket tersedia pada detail subscription."
                      : "Pilih paket untuk mulai menggunakan fitur premium.")}
                </p>
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
                      Pembatalan dijadwalkan. Akses berlaku sampai{" "}
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
                        <LoaderCircle size={16} className="subscription-spin" />
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
                        <LoaderCircle size={16} className="subscription-spin" />
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
              </div>
            ) : (
              <div className="subscription-no-current">
                <span className="subscription-status subscription-status-neutral">
                  Belum berlangganan
                </span>
                <p>
                  Pilih salah satu paket di bawah untuk memulai trial jika akun
                  Anda memenuhi syarat.
                </p>
              </div>
            )}
          </section>

          <section
            className="subscription-plans-section"
            aria-labelledby="subscription-plans-title"
          >
            <div className="subscription-section-heading">
              <div>
                <span className="subscription-section-eyebrow">
                  PILIHAN PAKET
                </span>
                <h3 id="subscription-plans-title">Paket yang tersedia</h3>
                <p>
                  Harga dan fitur ditampilkan berdasarkan informasi dari
                  backend.
                </p>
              </div>
              <span className="subscription-secure-note">
                <ShieldCheck size={15} aria-hidden="true" />
                Paket resmi
              </span>
            </div>

            {plans.length === 0 ? (
              <div className="subscription-empty-plans">
                <AlertCircle size={26} aria-hidden="true" />
                <strong>Belum ada paket yang tersedia</strong>
                <p>
                  Backend belum mengembalikan paket aktif. Coba muat ulang atau
                  periksa konfigurasi data paket.
                </p>
              </div>
            ) : (
              <div className="subscription-plans-grid">
                {plans.map((plan) => {
                  const isCurrentPlan =
                    Boolean(currentPlanCode) && currentPlanCode === plan.code;

                  const features = (plan.features ?? [])
                    .map(getFeatureLabel)
                    .filter((feature): feature is string => Boolean(feature));

                  return (
                    <article
                      className={`subscription-plan-card${
                        isCurrentPlan ? " subscription-plan-current" : ""
                      }`}
                      key={plan.id}
                    >
                      {isCurrentPlan && (
                        <span className="subscription-current-plan-label">
                          Paket saat ini
                        </span>
                      )}

                      <div className="subscription-plan-icon">
                        {plan.code.toLowerCase().includes("pro") ? (
                          <Sparkles size={21} aria-hidden="true" />
                        ) : (
                          <CreditCard size={21} aria-hidden="true" />
                        )}
                      </div>

                      <h4>{plan.name}</h4>
                      <p className="subscription-plan-description">
                        {plan.description ||
                          "Paket untuk kebutuhan keuangan Anda."}
                      </p>

                      <div className="subscription-plan-price">
                        <strong>
                          {formatPrice(plan.price, plan.currency || "IDR")}
                        </strong>
                        <span>/ {formatInterval(plan.billingInterval)}</span>
                      </div>

                      <div className="subscription-plan-divider" />

                      <span className="subscription-features-label">
                        Fitur paket
                      </span>

                      {features.length > 0 ? (
                        <ul className="subscription-feature-list">
                          {features.map((feature, index) => (
                            <li key={`${plan.id}-${index}`}>
                              <Check size={16} aria-hidden="true" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="subscription-no-features">
                          Detail fitur belum tersedia.
                        </p>
                      )}

                      <div className="subscription-plan-action">
                        {isCurrentPlan ? (
                          <button
                            type="button"
                            className="subscription-secondary-button subscription-full-width"
                            disabled
                          >
                            <BadgeCheck size={16} aria-hidden="true" />
                            Paket saat ini
                          </button>
                        ) : canStartTrial ? (
                          <button
                            type="button"
                            className="subscription-primary-button subscription-full-width"
                            onClick={() => void handleStartTrial(plan)}
                            disabled={busyAction !== null}
                          >
                            {busyAction === "trial" &&
                            selectedPlanCode === plan.code ? (
                              <LoaderCircle
                                size={16}
                                className="subscription-spin"
                              />
                            ) : (
                              <CalendarDays size={16} aria-hidden="true" />
                            )}
                            <span>
                              {busyAction === "trial" &&
                              selectedPlanCode === plan.code
                                ? "Memproses..."
                                : "Mulai trial"}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="subscription-secondary-button subscription-full-width"
                            disabled
                            title="Trial hanya dapat dimulai jika tidak ada subscription aktif dan akun memenuhi syarat."
                          >
                            {activeSubscription
                              ? "Subscription aktif"
                              : "Trial tidak tersedia"}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  BadgeCheck,
  CalendarDays,
  Check,
  CreditCard,
  LoaderCircle,
  Sparkles,
} from "lucide-react";

import { ApiRequestError, apiClient } from "../lib/api-client";
import "./SubscriptionPage.css";
import "./SubscriptionPage.refinement.css";

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

interface PlansPayload {
  data?: Plan[];
  items?: Plan[];
  plans?: Plan[];
}

interface Subscription {
  id: string;
  status: string;
  plan?: { code?: string; name?: string } | null;
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
        "Trial tidak dapat dimulai pada kondisi subscription saat ini."
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

function getFeatureLabel(feature: PlanFeature): string | null {
  if (typeof feature === "string") {
    return feature;
  }

  if (feature.enabled === false) {
    return null;
  }

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

export function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [isStartingTrial, setIsStartingTrial] = useState(false);

  const [selectedPlanCode, setSelectedPlanCode] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      const plansRequest = apiClient.get<Plan[] | PlansPayload>("plans");

      const subscriptionRequest = apiClient
        .get<Subscription | SubscriptionPayload | null>("subscriptions/me")
        .then(unwrapSubscriptionPayload)
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
    void loadData();
  }, [loadData, reloadKey]);

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

  const currentPlanCode = subscription?.plan?.code ?? null;

  const canStartTrial =
    !activeSubscription &&
    subscription?.status.toUpperCase() !== "CANCELED" &&
    subscription?.status.toUpperCase() !== "EXPIRED";

  async function handleStartTrial(plan: Plan) {
    if (isStartingTrial || !canStartTrial) return;

    const confirmed = window.confirm(
      `Mulai trial untuk paket ${plan.name}? Backend hanya mengizinkan satu kali trial per pengguna.`,
    );

    if (!confirmed) return;

    setIsStartingTrial(true);
    setSelectedPlanCode(plan.code);
    setFeedback(null);

    try {
      await apiClient.post("subscriptions/trial", {
        planCode: plan.code,
      });

      setFeedback({
        kind: "success",
        message: `Trial paket ${plan.name} berhasil dimulai.`,
      });

      await loadData();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setIsStartingTrial(false);
      setSelectedPlanCode(null);
    }
  }

  return (
    <section
      className="subscription-page plans-page"
      aria-labelledby="plans-page-title"
    >
      <header className="subscription-section-heading plans-page-heading">
        <div>
          <span className="subscription-section-eyebrow">AVAILABLE PLANS</span>

          <h2 id="plans-page-title">Paket yang tersedia</h2>

          <p>
            Harga dan fitur ditampilkan berdasarkan informasi paket yang
            tersedia.
          </p>
        </div>

        <Link to="/subscription" className="subscription-secondary-button">
          Lihat subscription
        </Link>
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

          <strong>Memuat pilihan paket</strong>

          <p>Mengambil daftar paket yang tersedia.</p>
        </div>
      ) : plans.length === 0 ? (
        <div className="subscription-empty-plans">
          <AlertCircle size={26} aria-hidden="true" />

          <strong>Belum ada paket yang tersedia</strong>

          <p>
            Backend belum mengembalikan paket aktif. Silakan coba lagi nanti.
          </p>
        </div>
      ) : (
        <section
          className="subscription-plans-section"
          aria-labelledby="plans-page-title"
        >
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
                    {plan.description || "Paket untuk kebutuhan keuangan Anda."}
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
                      <Link
                        to="/subscription"
                        className="subscription-secondary-button subscription-full-width"
                      >
                        <BadgeCheck size={16} aria-hidden="true" />
                        Paket saat ini
                      </Link>
                    ) : canStartTrial ? (
                      <button
                        type="button"
                        className="subscription-primary-button subscription-full-width"
                        onClick={() => void handleStartTrial(plan)}
                        disabled={isStartingTrial}
                      >
                        {isStartingTrial && selectedPlanCode === plan.code ? (
                          <LoaderCircle
                            size={16}
                            className="subscription-spin"
                          />
                        ) : (
                          <CalendarDays size={16} aria-hidden="true" />
                        )}

                        <span>
                          {isStartingTrial && selectedPlanCode === plan.code
                            ? "Memproses..."
                            : "Mulai trial"}
                        </span>
                      </button>
                    ) : (
                      <Link
                        to="/subscription"
                        className="subscription-secondary-button subscription-full-width"
                      >
                        {activeSubscription
                          ? "Kelola subscription"
                          : "Trial tidak tersedia"}
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {!isLoading && subscription && (
        <p className="subscription-plans-footnote">
          Status subscription saat ini: <strong>{subscription.status}</strong>.
          Pengelolaan langganan dapat dilakukan melalui halaman{" "}
          <Link to="/subscription">Subscription</Link>.
        </p>
      )}
    </section>
  );
}

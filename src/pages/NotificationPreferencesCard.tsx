import { useCallback, useEffect, useState } from "react";
import {
  BellRing,
  CheckCircle2,
  LoaderCircle,
  Mail,
  MessageCircle,
  RefreshCw,
  Save,
  Wallet,
  CalendarDays,
  CalendarRange,
  CalendarCheck,
  AlertCircle,
} from "lucide-react";

import { ApiRequestError, apiClient } from "../lib/api-client";
import "./NotificationPreferencesCard.css";

export interface NotificationPreferences {
  id: string;
  userId: string;
  telegramEnabled: boolean;
  emailEnabled: boolean;
  budgetAlertEnabled: boolean;
  dailySummaryEnabled: boolean;
  weeklySummaryEnabled: boolean;
  monthlySummaryEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

type PreferenceKey =
  | "telegramEnabled"
  | "emailEnabled"
  | "budgetAlertEnabled"
  | "dailySummaryEnabled"
  | "weeklySummaryEnabled"
  | "monthlySummaryEnabled";

type PreferenceValues = Pick<NotificationPreferences, PreferenceKey>;

const PREFERENCE_OPTIONS: {
  key: PreferenceKey;
  title: string;
  description: string;
  icon: typeof BellRing;
}[] = [
  {
    key: "emailEnabled",
    title: "Notifikasi email",
    description:
      "Izinkan sistem mengirim notifikasi yang mendukung kanal email.",
    icon: Mail,
  },
  {
    key: "telegramEnabled",
    title: "Notifikasi Telegram",
    description:
      "Izinkan sistem mengirim notifikasi melalui integrasi Telegram yang telah dikonfigurasi.",
    icon: MessageCircle,
  },
  {
    key: "budgetAlertEnabled",
    title: "Peringatan anggaran",
    description:
      "Aktifkan preferensi untuk peringatan terkait penggunaan anggaran.",
    icon: Wallet,
  },
  {
    key: "dailySummaryEnabled",
    title: "Ringkasan harian",
    description: "Aktifkan preferensi untuk ringkasan keuangan harian.",
    icon: CalendarDays,
  },
  {
    key: "weeklySummaryEnabled",
    title: "Ringkasan mingguan",
    description: "Aktifkan preferensi untuk ringkasan keuangan mingguan.",
    icon: CalendarRange,
  },
  {
    key: "monthlySummaryEnabled",
    title: "Ringkasan bulanan",
    description: "Aktifkan preferensi untuk ringkasan keuangan bulanan.",
    icon: CalendarCheck,
  },
];

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return "Sesi Anda berakhir. Silakan masuk kembali.";
    }

    if (error.status >= 500) {
      return "Server sedang mengalami kendala. Silakan coba kembali.";
    }

    return error.message || "Preferensi notifikasi gagal diproses.";
  }

  if (error instanceof TypeError) {
    return "Tidak dapat terhubung ke backend. Periksa koneksi dan konfigurasi API.";
  }

  return "Terjadi kesalahan saat memproses preferensi notifikasi.";
}

function toPreferenceValues(
  preferences: NotificationPreferences,
): PreferenceValues {
  return {
    telegramEnabled: preferences.telegramEnabled,
    emailEnabled: preferences.emailEnabled,
    budgetAlertEnabled: preferences.budgetAlertEnabled,
    dailySummaryEnabled: preferences.dailySummaryEnabled,
    weeklySummaryEnabled: preferences.weeklySummaryEnabled,
    monthlySummaryEnabled: preferences.monthlySummaryEnabled,
  };
}

function getChangedPreferences(
  original: PreferenceValues,
  draft: PreferenceValues,
): Partial<PreferenceValues> {
  const changes: Partial<PreferenceValues> = {};

  for (const key of Object.keys(draft) as PreferenceKey[]) {
    if (original[key] !== draft[key]) {
      changes[key] = draft[key];
    }
  }

  return changes;
}

export function NotificationPreferencesCard() {
  const [savedPreferences, setSavedPreferences] =
    useState<PreferenceValues | null>(null);
  const [draftPreferences, setDraftPreferences] =
    useState<PreferenceValues | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const hasChanges =
    savedPreferences !== null &&
    draftPreferences !== null &&
    Object.keys(getChangedPreferences(savedPreferences, draftPreferences))
      .length > 0;

  const loadPreferences = useCallback(async () => {
    setIsLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await apiClient.get<NotificationPreferences>(
        "notifications/preferences",
      );

      const values = toPreferenceValues(response);

      setSavedPreferences(values);
      setDraftPreferences(values);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  function handleToggle(key: PreferenceKey, checked: boolean) {
    setDraftPreferences((current) =>
      current ? { ...current, [key]: checked } : current,
    );

    setNotice("");
    setError("");
  }

  function handleReset() {
    if (!savedPreferences) return;

    setDraftPreferences({ ...savedPreferences });
    setNotice("");
    setError("");
  }

  async function handleSave() {
    if (!savedPreferences || !draftPreferences || !hasChanges || isSaving) {
      return;
    }

    const changes = getChangedPreferences(savedPreferences, draftPreferences);

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const updated = await apiClient.patch<NotificationPreferences>(
        "notifications/preferences",
        changes,
      );

      const values = toPreferenceValues(updated);

      setSavedPreferences(values);
      setDraftPreferences(values);
      setNotice("Preferensi notifikasi berhasil disimpan.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section
      className="notification-preferences-card"
      aria-labelledby="notification-preferences-title"
    >
      <header className="notification-preferences-heading">
        <div className="notification-preferences-heading-icon">
          <BellRing size={20} aria-hidden="true" />
        </div>

        <div className="notification-preferences-heading-copy">
          <h3 id="notification-preferences-title">Preferensi notifikasi</h3>
          <p>Tentukan kanal dan ringkasan keuangan yang ingin Anda aktifkan.</p>
        </div>

        <button
          type="button"
          className="notification-preferences-refresh"
          onClick={() => void loadPreferences()}
          disabled={isLoading || isSaving}
          aria-label="Muat ulang preferensi notifikasi"
          title="Muat ulang"
        >
          <RefreshCw
            size={16}
            className={isLoading ? "notification-preferences-spinning" : ""}
          />
        </button>
      </header>

      {error && (
        <div
          className="notification-preferences-message notification-preferences-message-error"
          role="alert"
        >
          <AlertCircle size={17} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div
          className="notification-preferences-message notification-preferences-message-success"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2 size={17} aria-hidden="true" />
          <span>{notice}</span>
        </div>
      )}

      {isLoading ? (
        <div className="notification-preferences-loading" role="status">
          <LoaderCircle
            size={22}
            className="notification-preferences-spinning"
            aria-hidden="true"
          />
          <span>Memuat preferensi notifikasi…</span>
        </div>
      ) : !draftPreferences || !savedPreferences ? (
        <div className="notification-preferences-load-error">
          <p>Preferensi belum dapat ditampilkan.</p>
          <button
            type="button"
            className="notification-preferences-button"
            onClick={() => void loadPreferences()}
          >
            Coba lagi
          </button>
        </div>
      ) : (
        <>
          <div className="notification-preferences-options">
            {PREFERENCE_OPTIONS.map((option) => {
              const OptionIcon = option.icon;
              const checked = draftPreferences[option.key];

              return (
                <div
                  className="notification-preference-option"
                  key={option.key}
                >
                  <span
                    className="notification-preference-option-icon"
                    aria-hidden="true"
                  >
                    <OptionIcon size={19} />
                  </span>

                  <div className="notification-preference-option-copy">
                    <strong>{option.title}</strong>
                    <p>{option.description}</p>
                  </div>

                  <label
                    className="notification-preference-toggle"
                    aria-label={option.title}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        handleToggle(option.key, event.target.checked)
                      }
                      disabled={isSaving}
                    />
                    <span className="notification-preference-toggle-track" />
                  </label>
                </div>
              );
            })}
          </div>

          <footer className="notification-preferences-footer">
            <span className="notification-preferences-change-status">
              {hasChanges
                ? "Ada perubahan yang belum disimpan."
                : "Semua perubahan sudah tersimpan."}
            </span>

            <div className="notification-preferences-actions">
              <button
                type="button"
                className="notification-preferences-button notification-preferences-button-secondary"
                onClick={handleReset}
                disabled={!hasChanges || isSaving}
              >
                Batalkan
              </button>

              <button
                type="button"
                className="notification-preferences-button notification-preferences-button-primary"
                onClick={() => void handleSave()}
                disabled={!hasChanges || isSaving}
              >
                <Save size={15} aria-hidden="true" />
                {isSaving ? "Menyimpan…" : "Simpan preferensi"}
              </button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BellRing,
  Check,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { ApiRequestError, apiClient } from "../../lib/api-client";
import "./BudgetAlertsPanel.css";

type NotificationChannel = "IN_APP" | "EMAIL" | "TELEGRAM";

interface BudgetAlert {
  id: string;
  budgetId: string;
  thresholdPercentage: number;
  channel: NotificationChannel;
  isEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface BudgetAlertsPanelProps {
  budgetId: string;
  budgetName: string;
}

interface AlertFormState {
  thresholdPercentage: string;
  channel: NotificationChannel;
}

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  IN_APP: "Notifikasi aplikasi",
  EMAIL: "Email",
  TELEGRAM: "Telegram",
};

const DEFAULT_FORM: AlertFormState = {
  thresholdPercentage: "80",
  channel: "IN_APP",
};

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return "Tidak dapat terhubung ke backend. Periksa koneksi API.";
    }

    if (error.status === 401) {
      return "Sesi akun berakhir. Silakan masuk kembali.";
    }

    return error.message || "Terjadi kesalahan saat mengelola alert.";
  }

  if (error instanceof Error) return error.message;

  return "Terjadi kesalahan yang tidak diketahui.";
}

function parseAlerts(response: unknown): BudgetAlert[] {
  if (Array.isArray(response)) return response as BudgetAlert[];

  if (typeof response === "object" && response !== null) {
    const record = response as Record<string, unknown>;

    if (Array.isArray(record["data"])) {
      return record["data"] as BudgetAlert[];
    }

    if (Array.isArray(record["items"])) {
      return record["items"] as BudgetAlert[];
    }

    if (Array.isArray(record["alerts"])) {
      return record["alerts"] as BudgetAlert[];
    }
  }

  throw new Error("Format respons budget alerts tidak sesuai kontrak API.");
}

export function BudgetAlertsPanel({
  budgetId,
  budgetName,
}: BudgetAlertsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [busyAlertId, setBusyAlertId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<BudgetAlert | null>(null);
  const [form, setForm] = useState<AlertFormState>(DEFAULT_FORM);
  const [formError, setFormError] = useState("");

  const loadAlerts = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await apiClient.get<unknown>(
        `/budgets/${encodeURIComponent(budgetId)}/alerts`,
      );

      setAlerts(parseAlerts(response));
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [budgetId]);

  useEffect(() => {
    if (isExpanded) {
      void loadAlerts();
    }
  }, [isExpanded, loadAlerts]);

  const openCreateForm = () => {
    setEditingAlert(null);
    setForm(DEFAULT_FORM);
    setFormError("");
    setSuccess("");
    setIsFormOpen(true);
  };

  const openEditForm = (alert: BudgetAlert) => {
    setEditingAlert(alert);
    setForm({
      thresholdPercentage: String(alert.thresholdPercentage),
      channel: alert.channel,
    });
    setFormError("");
    setSuccess("");
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving) return;

    setIsFormOpen(false);
    setEditingAlert(null);
    setForm(DEFAULT_FORM);
    setFormError("");
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const threshold = Number(form.thresholdPercentage);

    if (!Number.isInteger(threshold) || threshold < 1 || threshold > 100) {
      setFormError("Ambang alert harus berupa bilangan bulat 1–100.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    setError("");
    setSuccess("");

    try {
      const payload = {
        thresholdPercentage: threshold,
        channel: form.channel,
      };

      if (editingAlert) {
        await apiClient.patch(
          `/budget-alerts/${encodeURIComponent(editingAlert.id)}`,
          payload,
        );
        setSuccess("Konfigurasi alert berhasil diperbarui.");
      } else {
        await apiClient.post(
          `/budgets/${encodeURIComponent(budgetId)}/alerts`,
          payload,
        );
        setSuccess("Alert budget berhasil dibuat.");
      }

      setIsFormOpen(false);
      setEditingAlert(null);
      setForm(DEFAULT_FORM);

      await loadAlerts();
    } catch (saveError: unknown) {
      setFormError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (alert: BudgetAlert) => {
    if (busyAlertId) return;

    setBusyAlertId(alert.id);
    setError("");
    setSuccess("");

    try {
      await apiClient.patch(
        `/budget-alerts/${encodeURIComponent(alert.id)}/enabled`,
        { isEnabled: !alert.isEnabled },
      );

      setAlerts((current) =>
        current.map((item) =>
          item.id === alert.id
            ? { ...item, isEnabled: !alert.isEnabled }
            : item,
        ),
      );

      setSuccess(
        !alert.isEnabled
          ? "Alert berhasil diaktifkan."
          : "Alert berhasil dinonaktifkan.",
      );
    } catch (toggleError: unknown) {
      setError(getErrorMessage(toggleError));
      await loadAlerts();
    } finally {
      setBusyAlertId(null);
    }
  };

  const handleDelete = async (alert: BudgetAlert) => {
    if (busyAlertId) return;

    const confirmed = window.confirm(
      `Hapus alert ${alert.thresholdPercentage}% untuk budget "${budgetName}" melalui ${CHANNEL_LABELS[alert.channel]}?`,
    );

    if (!confirmed) return;

    setBusyAlertId(alert.id);
    setError("");
    setSuccess("");

    try {
      await apiClient.delete(`/budget-alerts/${encodeURIComponent(alert.id)}`);

      setAlerts((current) => current.filter((item) => item.id !== alert.id));

      setSuccess("Alert berhasil dihapus.");
    } catch (deleteError: unknown) {
      setError(getErrorMessage(deleteError));
    } finally {
      setBusyAlertId(null);
    }
  };

  return (
    <section className="budget-alerts-panel">
      <button
        type="button"
        className="budget-alerts-toggle"
        aria-expanded={isExpanded}
        onClick={() => {
          setIsExpanded((current) => !current);
          setError("");
          setSuccess("");
        }}
      >
        <span className="budget-alerts-toggle-icon">
          <BellRing size={17} />
        </span>

        <span className="budget-alerts-toggle-text">
          <strong>Budget alerts</strong>
          <small>
            {alerts.filter((alert) => alert.isEnabled).length} alert aktif
          </small>
        </span>

        <span className="budget-alerts-toggle-action">
          {isExpanded ? "Tutup" : "Kelola"}
        </span>
      </button>

      {isExpanded && (
        <div className="budget-alerts-content">
          <div className="budget-alerts-heading">
            <div>
              <h4>Pengingat anggaran</h4>
              <p>
                Atur kapan kamu ingin mendapat pemberitahuan saat penggunaan
                budget mencapai ambang tertentu.
              </p>
            </div>

            <button
              type="button"
              className="budget-alerts-add-button"
              onClick={openCreateForm}
              disabled={isLoading || Boolean(busyAlertId) || isSaving}
            >
              <Plus size={15} />
              <span>Tambah alert</span>
            </button>
          </div>

          {error && (
            <div
              className="budget-alerts-message budget-alerts-message--error"
              role="alert"
            >
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              className="budget-alerts-message budget-alerts-message--success"
              role="status"
            >
              <Check size={16} />
              <span>{success}</span>
            </div>
          )}

          {isLoading ? (
            <div className="budget-alerts-loading" role="status">
              <LoaderCircle size={18} className="budget-alerts-spinner" />
              <span>Memuat alert...</span>
            </div>
          ) : alerts.length === 0 ? (
            <div className="budget-alerts-empty">
              <Bell size={20} />
              <p>Belum ada alert untuk budget ini.</p>
              <span>
                Tambahkan alert agar kamu dapat memantau penggunaan anggaran.
              </span>
            </div>
          ) : (
            <div className="budget-alerts-list">
              {alerts.map((alert) => (
                <article className="budget-alert-item" key={alert.id}>
                  <div className="budget-alert-item-main">
                    <span className="budget-alert-threshold">
                      {alert.thresholdPercentage}%
                    </span>

                    <div className="budget-alert-item-details">
                      <strong>{CHANNEL_LABELS[alert.channel]}</strong>
                      <span>
                        {alert.isEnabled ? "Aktif" : "Nonaktif"} · Penggunaan
                        budget {alert.thresholdPercentage}%
                      </span>
                    </div>
                  </div>

                  <div className="budget-alert-item-actions">
                    <button
                      type="button"
                      className={`budget-alert-enable-button ${
                        alert.isEnabled ? "is-enabled" : ""
                      }`}
                      onClick={() => void handleToggle(alert)}
                      disabled={Boolean(busyAlertId) || isSaving}
                      aria-label={
                        alert.isEnabled ? "Nonaktifkan alert" : "Aktifkan alert"
                      }
                      title={
                        alert.isEnabled ? "Nonaktifkan alert" : "Aktifkan alert"
                      }
                    >
                      {busyAlertId === alert.id ? (
                        <LoaderCircle
                          size={16}
                          className="budget-alerts-spinner"
                        />
                      ) : alert.isEnabled ? (
                        <Check size={16} />
                      ) : (
                        <Bell size={16} />
                      )}
                    </button>

                    <button
                      type="button"
                      className="budget-alert-edit-button"
                      onClick={() => openEditForm(alert)}
                      disabled={Boolean(busyAlertId) || isSaving}
                      aria-label="Edit alert"
                      title="Edit alert"
                    >
                      <Pencil size={15} />
                    </button>

                    <button
                      type="button"
                      className="budget-alert-delete-button"
                      onClick={() => void handleDelete(alert)}
                      disabled={Boolean(busyAlertId) || isSaving}
                      aria-label="Hapus alert"
                      title="Hapus alert"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {isFormOpen && (
            <div
              className="budget-alert-form-overlay"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !isSaving) {
                  closeForm();
                }
              }}
            >
              <section
                className="budget-alert-form-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="budget-alert-form-title"
              >
                <div className="budget-alert-form-heading">
                  <div>
                    <span className="budget-alert-form-eyebrow">
                      {editingAlert ? "EDIT ALERT" : "NEW ALERT"}
                    </span>
                    <h3 id="budget-alert-form-title">
                      {editingAlert ? "Ubah budget alert" : "Buat budget alert"}
                    </h3>
                  </div>

                  <button
                    type="button"
                    className="budget-alert-form-close"
                    onClick={closeForm}
                    disabled={isSaving}
                    aria-label="Tutup form"
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleSave}>
                  <label className="budget-alert-field">
                    <span>Ambang penggunaan (%)</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      required
                      value={form.thresholdPercentage}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          thresholdPercentage: event.target.value,
                        }))
                      }
                      placeholder="80"
                    />
                    <small>
                      Contoh: 80 berarti alert disetel pada penggunaan budget
                      80%.
                    </small>
                  </label>

                  <label className="budget-alert-field">
                    <span>Channel notifikasi</span>
                    <select
                      required
                      value={form.channel}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          channel: event.target.value as NotificationChannel,
                        }))
                      }
                    >
                      <option value="IN_APP">Notifikasi aplikasi</option>
                      <option value="EMAIL">Email</option>
                      <option value="TELEGRAM">Telegram</option>
                    </select>
                  </label>

                  {formError && (
                    <div
                      className="budget-alert-message budget-alert-message--error"
                      role="alert"
                    >
                      <AlertTriangle size={16} />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div className="budget-alert-form-actions">
                    <button
                      type="button"
                      className="budget-alert-form-cancel"
                      onClick={closeForm}
                      disabled={isSaving}
                    >
                      Batal
                    </button>

                    <button
                      type="submit"
                      className="budget-alert-form-submit"
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <LoaderCircle
                            size={16}
                            className="budget-alerts-spinner"
                          />
                          Menyimpan...
                        </>
                      ) : (
                        <>
                          <Check size={16} />
                          Simpan alert
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

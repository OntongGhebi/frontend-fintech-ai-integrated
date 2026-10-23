import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, LoaderCircle, X } from "lucide-react";

import { ApiRequestError, apiClient } from "../../lib/api-client";
import "./BudgetFormModal.css";

export type BudgetPeriod = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "CUSTOM";

export interface BudgetFormCategory {
  id: string;
  name: string;
  type: string;
  isActive?: boolean;
}

export interface BudgetFormValues {
  id: string;
  name: string;
  amount: string;
  period: BudgetPeriod;
  startDate: string;
  endDate: string | null;
  categoryId: string | null;
  status?: "ACTIVE" | "PAUSED" | "COMPLETED";
  category?: {
    id?: string;
    name?: string;
  } | null;
}

interface BudgetFormModalProps {
  budget?: BudgetFormValues | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

interface CategoryResponse {
  data?: unknown;
}

interface FormState {
  name: string;
  amount: string;
  period: BudgetPeriod;
  startDate: string;
  endDate: string;
  categoryId: string;
}

const PERIOD_OPTIONS: Array<{ value: BudgetPeriod; label: string }> = [
  { value: "DAILY", label: "Harian" },
  { value: "WEEKLY", label: "Mingguan" },
  { value: "MONTHLY", label: "Bulanan" },
  { value: "YEARLY", label: "Tahunan" },
  { value: "CUSTOM", label: "Periode khusus" },
];

function todayLocal(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function unwrapCategories(payload: unknown): BudgetFormCategory[] {
  let value = payload;

  if (typeof value === "object" && value !== null && "data" in value) {
    value = (value as CategoryResponse).data;
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is BudgetFormCategory =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as BudgetFormCategory).id === "string" &&
      typeof (item as BudgetFormCategory).name === "string",
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 400) {
      return error.message || "Periksa kembali data budget yang diisi.";
    }

    if (error.status === 401) {
      return "Sesi Anda berakhir. Silakan masuk kembali.";
    }

    if (error.status === 409) {
      return (
        error.message ||
        "Budget dengan data tersebut bertentangan dengan data yang ada."
      );
    }

    return error.message || "Permintaan gagal diproses.";
  }

  return error instanceof Error
    ? error.message
    : "Terjadi kesalahan yang tidak diketahui.";
}

function getInitialForm(budget?: BudgetFormValues | null): FormState {
  return {
    name: budget?.name ?? "",
    amount: budget?.amount != null ? String(budget.amount) : "",
    period: budget?.period ?? "MONTHLY",
    startDate: budget?.startDate ? budget.startDate.slice(0, 10) : todayLocal(),
    endDate: budget?.endDate ? budget.endDate.slice(0, 10) : "",
    categoryId: budget?.categoryId ?? budget?.category?.id ?? "",
  };
}

function validateForm(form: FormState): string | null {
  if (!form.name.trim()) {
    return "Nama budget wajib diisi.";
  }

  if (form.name.trim().length > 100) {
    return "Nama budget maksimal 100 karakter.";
  }

  // Backend menerima nominal sebagai string desimal dengan maksimal
  // empat angka di belakang koma.
  if (!/^\d+(\.\d{1,4})?$/.test(form.amount.trim())) {
    return "Nominal harus berupa angka positif dengan maksimal 4 angka desimal.";
  }

  if (Number(form.amount) <= 0 || !Number.isFinite(Number(form.amount))) {
    return "Nominal budget harus lebih besar dari nol.";
  }

  if (!form.startDate) {
    return "Tanggal mulai wajib diisi.";
  }

  if (form.endDate && form.endDate < form.startDate) {
    return "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.";
  }

  if (!PERIOD_OPTIONS.some((option) => option.value === form.period)) {
    return "Periode budget tidak valid.";
  }

  return null;
}

export function BudgetFormModal({
  budget,
  onClose,
  onSaved,
}: BudgetFormModalProps) {
  const isEditing = Boolean(budget?.id);

  const [form, setForm] = useState<FormState>(() => getInitialForm(budget));
  const [categories, setCategories] = useState<BudgetFormCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoryError, setCategoryError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      setLoadingCategories(true);
      setCategoryError("");

      try {
        const response = await apiClient.get<unknown>(
          "categories?type=EXPENSE",
        );

        if (cancelled) return;

        setCategories(
          unwrapCategories(response).filter(
            (category) => category.isActive !== false,
          ),
        );
      } catch (error) {
        if (cancelled) return;

        setCategoryError(
          getErrorMessage(error) || "Kategori pengeluaran gagal dimuat.",
        );
      } finally {
        if (!cancelled) {
          setLoadingCategories(false);
        }
      }
    }

    void loadCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateField<K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const validationError = validateForm(form);

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);

    const payload = {
      name: form.name.trim(),
      amount: form.amount.trim(),
      period: form.period,
      startDate: form.startDate,
      endDate: form.endDate || null,
      categoryId: form.categoryId || null,
    };

    try {
      if (isEditing && budget?.id) {
        await apiClient.patch(
          `budgets/${encodeURIComponent(budget.id)}`,
          payload,
        );
      } else {
        const createPayload = {
          name: payload.name,
          amount: payload.amount,
          period: payload.period,
          startDate: payload.startDate,
          ...(payload.endDate ? { endDate: payload.endDate } : {}),
          ...(payload.categoryId ? { categoryId: payload.categoryId } : {}),
        };

        await apiClient.post("budgets", createPayload);
      }

      await onSaved();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="budget-form-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <section
        className="budget-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-form-title"
      >
        <header className="budget-form-header">
          <div>
            <span className="budget-form-eyebrow">MANAJEMEN ANGGARAN</span>
            <h2 id="budget-form-title">
              {isEditing ? "Edit budget" : "Buat budget baru"}
            </h2>
            <p>
              Atur batas pengeluaran agar kondisi keuangan tetap terkontrol.
            </p>
          </div>

          <button
            type="button"
            className="budget-form-close"
            aria-label="Tutup formulir"
            onClick={onClose}
            disabled={saving}
          >
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} noValidate>
          {formError && (
            <div className="budget-form-error" role="alert">
              <AlertCircle size={18} />
              <span>{formError}</span>
            </div>
          )}

          <div className="budget-form-field">
            <label htmlFor="budget-name">Nama budget</label>
            <input
              id="budget-name"
              name="name"
              type="text"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Contoh: Kebutuhan bulanan"
              maxLength={100}
              autoFocus
              required
              disabled={saving}
            />
            <span className="budget-form-hint">Maksimal 100 karakter.</span>
          </div>

          <div className="budget-form-field">
            <label htmlFor="budget-amount">Batas pengeluaran (IDR)</label>
            <div className="budget-form-amount">
              <span>Rp</span>
              <input
                id="budget-amount"
                name="amount"
                type="number"
                inputMode="decimal"
                min="0.0001"
                step="0.0001"
                value={form.amount}
                onChange={(event) => updateField("amount", event.target.value)}
                placeholder="1500000"
                required
                disabled={saving}
              />
            </div>
            <span className="budget-form-hint">
              Masukkan nominal tanpa pemisah ribuan.
            </span>
          </div>

          <div className="budget-form-field">
            <label htmlFor="budget-period">Periode</label>
            <select
              id="budget-period"
              name="period"
              value={form.period}
              onChange={(event) =>
                updateField("period", event.target.value as BudgetPeriod)
              }
              required
              disabled={saving}
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="budget-form-dates">
            <div className="budget-form-field">
              <label htmlFor="budget-start-date">Tanggal mulai</label>
              <input
                id="budget-start-date"
                name="startDate"
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  updateField("startDate", event.target.value)
                }
                required
                disabled={saving}
              />
            </div>

            <div className="budget-form-field">
              <label htmlFor="budget-end-date">
                Tanggal selesai
                <span className="budget-form-optional">Opsional</span>
              </label>
              <input
                id="budget-end-date"
                name="endDate"
                type="date"
                min={form.startDate || undefined}
                value={form.endDate}
                onChange={(event) => updateField("endDate", event.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div className="budget-form-field">
            <label htmlFor="budget-category">Kategori pengeluaran</label>
            <select
              id="budget-category"
              name="categoryId"
              value={form.categoryId}
              onChange={(event) =>
                updateField("categoryId", event.target.value)
              }
              disabled={saving || loadingCategories}
            >
              <option value="">Semua kategori</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            {loadingCategories && (
              <span className="budget-form-hint">Memuat kategori...</span>
            )}

            {!loadingCategories && categoryError && (
              <span className="budget-form-inline-error" role="status">
                {categoryError} Anda masih dapat menyimpan budget tanpa
                kategori.
              </span>
            )}

            {!loadingCategories &&
              !categoryError &&
              categories.length === 0 && (
                <span className="budget-form-hint">
                  Belum ada kategori pengeluaran aktif. Budget tetap dapat
                  dibuat tanpa kategori.
                </span>
              )}
          </div>

          <footer className="budget-form-footer">
            <button
              type="button"
              className="budget-form-button secondary"
              onClick={onClose}
              disabled={saving}
            >
              Batal
            </button>

            <button
              type="submit"
              className="budget-form-button primary"
              disabled={saving}
            >
              {saving ? (
                <>
                  <LoaderCircle size={17} className="budget-form-spinner" />
                  Menyimpan...
                </>
              ) : isEditing ? (
                "Simpan perubahan"
              ) : (
                "Buat budget"
              )}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

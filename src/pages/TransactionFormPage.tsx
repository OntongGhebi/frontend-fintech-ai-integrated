import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { ApiRequestError, apiClient } from "../lib/api-client";
import "./TransactionFormPage.css";
import "./TransactionDetailPage.css";

type TransactionType = "INCOME" | "EXPENSE";

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  deletedAt?: string | null;
}

interface CategoryListResponse {
  data: Category[];
}

interface CreatedTransaction {
  id: string;
  type: TransactionType;
  amount: string;
  currency: string;
  transactionDate: string;
}

interface TransactionFormValues {
  type: TransactionType;
  accountId: string;
  categoryId: string;
  amount: string;
  description: string;
  transactionDate: string;
}

function getLocalDateTimeValue(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  ].join("T");
}

function toJakartaIsoDateTime(value: string): string {
  // Backend menerima ISO 8601 dengan offset Asia/Jakarta.
  // Input datetime-local tidak menyertakan offset, jadi tambahkan +07:00.
  return `${value}:00+07:00`;
}

function isValidJakartaDateTime(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return "Sesi Anda berakhir. Silakan login kembali.";
    }

    if (error.status === 400 || error.status === 422) {
      return error.message || "Periksa kembali data yang kamu masukkan.";
    }

    if (error.status === 403) {
      return "Kamu tidak memiliki izin untuk membuat transaksi ini.";
    }

    if (error.status >= 500) {
      return "Server sedang mengalami kendala. Coba lagi beberapa saat.";
    }

    return error.message || "Transaksi tidak dapat disimpan.";
  }

  if (error instanceof TypeError) {
    return "Tidak dapat terhubung ke backend. Periksa koneksi dan konfigurasi API.";
  }

  return "Terjadi kesalahan saat menyimpan transaksi.";
}

function formatCurrency(value: string | number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

const INITIAL_FORM: TransactionFormValues = {
  type: "EXPENSE",
  accountId: "",
  categoryId: "",
  amount: "",
  description: "",
  transactionDate: getLocalDateTimeValue(),
};

export function TransactionFormPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<TransactionFormValues>(INITIAL_FORM);
  const submitLock = useRef(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [fieldError, setFieldError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadOptions() {
      setIsLoadingOptions(true);
      setLoadError("");

      try {
        const [accountResponse, categoryResponse] = await Promise.all([
          apiClient.get<Account[]>("accounts"),
          apiClient.get<CategoryListResponse>("categories"),
        ]);

        if (!isMounted) return;

        setAccounts(
          accountResponse.filter(
            (account) => account.isActive && account.currency === "IDR",
          ),
        );

        setCategories(categoryResponse.data);
      } catch (error) {
        if (isMounted) {
          setLoadError(getErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsLoadingOptions(false);
        }
      }
    }

    void loadOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  const eligibleCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.isActive &&
          !category.deletedAt &&
          category.type === form.type,
      ),
    [categories, form.type],
  );

  const selectedAccount = accounts.find(
    (account) => account.id === form.accountId,
  );

  function updateField<K extends keyof TransactionFormValues>(
    key: K,
    value: TransactionFormValues[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldError("");
    setSubmitError("");
  }

  function handleTypeChange(type: TransactionType) {
    setForm((current) => ({
      ...current,
      type,
      categoryId: "",
    }));
    setFieldError("");
    setSubmitError("");
  }

  function validateForm(): string {
    if (!form.accountId) {
      return "Pilih akun untuk transaksi ini.";
    }

    if (!selectedAccount) {
      return "Akun yang dipilih tidak tersedia atau tidak aktif.";
    }

    if (!form.amount.trim()) {
      return "Nominal transaksi wajib diisi.";
    }

    // Maksimum 4 angka di belakang koma; hindari angka negatif, nol,
    // notasi eksponensial, dan pemisah ribuan yang ambigu.
    if (!/^\d+(\.\d{1,4})?$/.test(form.amount.trim())) {
      return "Masukkan nominal positif dengan maksimal 4 angka desimal, tanpa pemisah ribuan.";
    }

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return "Nominal transaksi harus lebih besar dari 0.";
    }

    if (amount > 999999999999999.9999) {
      return "Nominal transaksi melebihi batas maksimum.";
    }

    if (!form.transactionDate) {
      return "Tanggal dan waktu transaksi wajib diisi.";
    }

    if (!isValidJakartaDateTime(form.transactionDate)) {
      return "Tanggal dan waktu transaksi tidak valid.";
    }

    if (form.description.length > 500) {
      return "Deskripsi maksimal 500 karakter.";
    }

    if (
      form.categoryId &&
      !eligibleCategories.some((category) => category.id === form.categoryId)
    ) {
      return "Kategori yang dipilih tidak sesuai dengan tipe transaksi.";
    }

    return "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    setSubmitError("");

    const validationError = validateForm();

    if (validationError) {
      setFieldError(validationError);
      return;
    }

    submitLock.current = true;
    setIsSubmitting(true);

    try {
      const created = await apiClient.post<CreatedTransaction>("transactions", {
        accountId: form.accountId,
        ...(form.categoryId ? { categoryId: form.categoryId } : {}),
        type: form.type,
        amount: Number(form.amount),
        currency: "IDR",
        ...(form.description.trim()
          ? { description: form.description.trim() }
          : {}),
        transactionDate: toJakartaIsoDateTime(form.transactionDate),
      });

      navigate(`/transactions/${encodeURIComponent(created.id)}`, {
        replace: true,
        state: { transactionCreated: true },
      });
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <section
      className="transaction-form-page"
      aria-label="Form tambah transaksi"
    >
      <Link
        to="/transactions"
        className="transaction-back-icon-button"
        aria-label="Kembali ke daftar transaksi"
        title="Kembali ke daftar transaksi"
      >
        <ArrowLeft size={20} aria-hidden="true" />
      </Link>

      {loadError && (
        <div
          className="transaction-form-alert transaction-form-alert--error"
          role="alert"
        >
          <div>
            <strong>Data form belum dapat dimuat</strong>
            <p>{loadError}</p>
          </div>
          <button
            type="button"
            className="transaction-form-button transaction-form-button--secondary"
            onClick={() => window.location.reload()}
          >
            Muat ulang
          </button>
        </div>
      )}

      <div className="transaction-form-layout">
        <form
          className="transaction-form-card"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className="transaction-form-card-heading">
            <div>
              <h3>Informasi transaksi</h3>
              <p>Isi detail transaksi dengan benar sebelum menyimpan.</p>
            </div>
            <span className="transaction-form-currency-badge">IDR</span>
          </div>

          <fieldset
            className="transaction-form-type-picker"
            disabled={isSubmitting}
          >
            <legend>Tipe transaksi</legend>

            <button
              type="button"
              className={`transaction-type-option transaction-type-option--income${form.type === "INCOME" ? " is-selected" : ""}`}
              aria-pressed={form.type === "INCOME"}
              onClick={() => handleTypeChange("INCOME")}
            >
              <span className="transaction-type-option-icon" aria-hidden="true">
                ↗
              </span>
              <span>
                <strong>Pemasukan</strong>
                <small>Uang masuk ke akun</small>
              </span>
              <span
                className="transaction-type-option-check"
                aria-hidden="true"
              >
                {form.type === "INCOME" ? "✓" : ""}
              </span>
            </button>

            <button
              type="button"
              className={`transaction-type-option transaction-type-option--expense${form.type === "EXPENSE" ? " is-selected" : ""}`}
              aria-pressed={form.type === "EXPENSE"}
              onClick={() => handleTypeChange("EXPENSE")}
            >
              <span className="transaction-type-option-icon" aria-hidden="true">
                ↘
              </span>
              <span>
                <strong>Pengeluaran</strong>
                <small>Uang keluar dari akun</small>
              </span>
              <span
                className="transaction-type-option-check"
                aria-hidden="true"
              >
                {form.type === "EXPENSE" ? "✓" : ""}
              </span>
            </button>
          </fieldset>

          <div className="transaction-form-amount-panel">
            <label htmlFor="transaction-amount">Nominal transaksi</label>
            <div className="transaction-form-amount-input">
              <span>Rp</span>
              <input
                id="transaction-amount"
                name="amount"
                type="number"
                inputMode="decimal"
                min="0.0001"
                max="999999999999999.9999"
                step="0.0001"
                placeholder="0"
                value={form.amount}
                onChange={(event) => updateField("amount", event.target.value)}
                disabled={isSubmitting}
                required
                aria-describedby="transaction-amount-hint"
              />
            </div>
            <small id="transaction-amount-hint">
              Gunakan angka tanpa pemisah ribuan. Contoh: 75000 atau 1250.50.
            </small>
            {form.amount.trim() &&
              /^\d+(\.\d{1,4})?$/.test(form.amount.trim()) &&
              Number(form.amount) > 0 && (
                <div className="transaction-form-amount-preview">
                  Pratinjau: <strong>{formatCurrency(form.amount)}</strong>
                </div>
              )}
          </div>

          <div className="transaction-form-fields">
            <div className="transaction-form-field">
              <label htmlFor="transaction-account">
                Akun <span aria-hidden="true">*</span>
              </label>
              <select
                id="transaction-account"
                name="accountId"
                value={form.accountId}
                onChange={(event) =>
                  updateField("accountId", event.target.value)
                }
                disabled={
                  isLoadingOptions || isSubmitting || Boolean(loadError)
                }
                required
              >
                <option value="">
                  {isLoadingOptions ? "Memuat akun..." : "Pilih akun"}
                </option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.currency}
                  </option>
                ))}
              </select>
              {!isLoadingOptions && accounts.length === 0 && !loadError && (
                <small className="transaction-form-field-note">
                  Belum ada akun IDR aktif. Buat atau aktifkan akun terlebih
                  dahulu.
                </small>
              )}
            </div>

            <div className="transaction-form-field">
              <label htmlFor="transaction-category">Kategori</label>
              <select
                id="transaction-category"
                name="categoryId"
                value={form.categoryId}
                onChange={(event) =>
                  updateField("categoryId", event.target.value)
                }
                disabled={
                  isLoadingOptions ||
                  isSubmitting ||
                  Boolean(loadError) ||
                  eligibleCategories.length === 0
                }
              >
                <option value="">Tanpa kategori</option>
                {eligibleCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <small className="transaction-form-field-note">
                {eligibleCategories.length === 0
                  ? `Belum ada kategori ${form.type === "INCOME" ? "pemasukan" : "pengeluaran"} aktif. Kategori bisa ditambahkan nanti.`
                  : "Kategori mengikuti tipe transaksi yang dipilih."}
              </small>
            </div>

            <div className="transaction-form-field">
              <label htmlFor="transaction-date">
                Tanggal dan waktu <span aria-hidden="true">*</span>
              </label>
              <input
                id="transaction-date"
                name="transactionDate"
                type="datetime-local"
                value={form.transactionDate}
                onChange={(event) =>
                  updateField("transactionDate", event.target.value)
                }
                disabled={isSubmitting}
                required
              />
              <small className="transaction-form-field-note">
                Zona waktu aplikasi: Asia/Jakarta (UTC+07:00).
              </small>
            </div>

            <div className="transaction-form-field">
              <label htmlFor="transaction-description">Deskripsi</label>
              <textarea
                id="transaction-description"
                name="description"
                rows={4}
                maxLength={500}
                placeholder={
                  form.type === "INCOME"
                    ? "Contoh: Gaji bulanan, proyek freelance..."
                    : "Contoh: Makan siang, transportasi, belanja..."
                }
                value={form.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                disabled={isSubmitting}
              />
              <div className="transaction-form-character-count">
                {form.description.length}/500 karakter
              </div>
            </div>
          </div>

          {fieldError && (
            <div
              className="transaction-form-alert transaction-form-alert--error"
              role="alert"
            >
              {fieldError}
            </div>
          )}

          {submitError && (
            <div
              className="transaction-form-alert transaction-form-alert--error"
              role="alert"
            >
              <div>
                <strong>Transaksi gagal disimpan</strong>
                <p>{submitError}</p>
              </div>
            </div>
          )}

          <div className="transaction-form-actions">
            <Link
              to="/transactions"
              className="transaction-form-button transaction-form-button--secondary"
              aria-disabled={isSubmitting}
              onClick={(event) => {
                if (isSubmitting) event.preventDefault();
              }}
            >
              Batal
            </Link>
            <button
              type="submit"
              className="transaction-form-button transaction-form-button--primary"
              disabled={
                isSubmitting ||
                isLoadingOptions ||
                Boolean(loadError) ||
                accounts.length === 0
              }
            >
              {isSubmitting ? (
                <>
                  <span
                    className="transaction-form-spinner"
                    aria-hidden="true"
                  />
                  Menyimpan...
                </>
              ) : (
                "Simpan transaksi"
              )}
            </button>
          </div>
        </form>

        <aside className="transaction-form-side-panel">
          <div className="transaction-form-tip-icon" aria-hidden="true">
            ✦
          </div>
          <h3>Catatan keuangan yang lebih rapi</h3>
          <p>
            Catat transaksi sedekat mungkin dengan waktu terjadinya agar laporan
            keuangan lebih akurat.
          </p>

          <ul>
            <li>
              <span>✓</span>
              Pilih akun tempat uang masuk atau keluar.
            </li>
            <li>
              <span>✓</span>
              Gunakan kategori yang sesuai agar analitik lebih bermakna.
            </li>
            <li>
              <span>✓</span>
              Pastikan tanggal dan nominal sudah benar sebelum menyimpan.
            </li>
          </ul>

          <div className="transaction-form-side-note">
            <span aria-hidden="true">ⓘ</span>
            <p>
              Transfer antar-akun akan menggunakan form transfer khusus pada
              tahap berikutnya agar kedua sisi transaksi tetap konsisten.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

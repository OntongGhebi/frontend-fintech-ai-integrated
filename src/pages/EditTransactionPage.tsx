import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, LoaderCircle, Save } from "lucide-react";

import { ApiRequestError, apiClient } from "../lib/api-client";
import "./EditTransactionPage.css";
import "./TransactionFormPage.css";
import "./TransactionDetailPage.css";

type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";

interface Transaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  type: TransactionType;
  amount: string;
  currency: string;
  description: string | null;
  transactionDate: string;
  source: string;
  status: "ACTIVE" | "VOIDED";
  transferGroupId: string | null;
}

interface Account {
  id: string;
  name: string;
  currency: string;
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE" | "OTHER";
  isActive: boolean;
  deletedAt?: string | null;
}

interface CategoryListResponse {
  data: Category[];
}

interface FormValues {
  accountId: string;
  categoryId: string;
  amount: string;
  description: string;
  transactionDate: string;
}

function formatCurrency(value: string | number): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "—";
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 4,
  }).format(amount);
}

function getJakartaDateTimeValue(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function toJakartaIsoDateTime(value: string): string {
  // Input datetime-local represents a wall-clock time, not UTC.
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
    if (error.status === 0) {
      return "Tidak dapat terhubung ke backend. Periksa server API dan konfigurasi URL.";
    }

    return error.message || "Permintaan gagal diproses.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Terjadi kesalahan yang tidak diketahui.";
}

function getTypeLabel(type: TransactionType): string {
  if (type === "INCOME") return "Pemasukan";
  if (type === "EXPENSE") return "Pengeluaran";
  return "Transfer";
}

export function EditTransactionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const saveLock = useRef(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<FormValues>({
    accountId: "",
    categoryId: "",
    amount: "",
    description: "",
    transactionDate: "",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      if (!id) {
        setErrorMessage("ID transaksi tidak ditemukan.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [transactionResponse, accountsResponse, categoriesResponse] =
          await Promise.all([
            apiClient.get<Transaction>(
              `/transactions/${encodeURIComponent(id)}`,
            ),
            apiClient.get<Account[]>("/accounts"),
            apiClient.get<CategoryListResponse>("/categories"),
          ]);

        if (cancelled) return;

        setTransaction(transactionResponse);
        setAccounts(
          accountsResponse.filter((account) => account.currency === "IDR"),
        );
        setCategories(categoriesResponse.data ?? []);

        setForm({
          accountId: transactionResponse.accountId,
          categoryId: transactionResponse.categoryId ?? "",
          amount: String(transactionResponse.amount),
          description: transactionResponse.description ?? "",
          transactionDate: getJakartaDateTimeValue(
            transactionResponse.transactionDate,
          ),
        });
      } catch (error: unknown) {
        if (!cancelled) {
          setErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [id, loadKey]);

  const availableCategories = useMemo(() => {
    if (!transaction || transaction.type === "TRANSFER") {
      return [];
    }

    return categories.filter((category) => {
      const isAvailable = category.isActive && !category.deletedAt;

      return isAvailable && category.type === transaction.type;
    });
  }, [categories, transaction]);

  const selectedAccount = accounts.find(
    (account) => account.id === form.accountId,
  );

  const isEditable =
    transaction?.status === "ACTIVE" && transaction?.type !== "TRANSFER";

  function updateField<K extends keyof FormValues>(
    field: K,
    value: FormValues[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!id || !transaction || !isEditable) {
      setErrorMessage("Transaksi ini tidak dapat diedit.");
      return;
    }

    if (saveLock.current || isSaving) return;

    const amountText = form.amount.trim();
    if (!/^\d+(\.\d{1,4})?$/.test(amountText)) {
      setErrorMessage("Nominal hanya boleh memiliki maksimal 4 angka desimal.");
      return;
    }

    const amount = Number(amountText);

    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage("Nominal harus lebih besar dari 0.");
      return;
    }

    if (!form.accountId) {
      setErrorMessage("Pilih rekening transaksi.");
      return;
    }

    if (amount > 999999999999999.9999) {
      setErrorMessage("Nominal transaksi melebihi batas maksimum.");
      return;
    }

    if (
      !selectedAccount ||
      selectedAccount.currency !== "IDR" ||
      (!selectedAccount.isActive && form.accountId !== transaction.accountId)
    ) {
      setErrorMessage("Pilih rekening IDR yang aktif.");
      return;
    }

    if (!isValidJakartaDateTime(form.transactionDate)) {
      setErrorMessage("Tanggal dan waktu transaksi tidak valid.");
      return;
    }

    if (form.description.length > 500) {
      setErrorMessage("Deskripsi maksimal 500 karakter.");
      return;
    }

    if (
      form.categoryId &&
      !availableCategories.some((category) => category.id === form.categoryId)
    ) {
      setErrorMessage(
        "Kategori yang dipilih tidak sesuai dengan jenis transaksi.",
      );
      return;
    }

    const originalAmount = Number(transaction.amount);

    const payload: {
      accountId?: string;
      categoryId?: string;
      amount?: number;
      description?: string;
      transactionDate?: string;
    } = {};

    if (form.accountId !== transaction.accountId) {
      payload.accountId = form.accountId;
    }

    if (form.categoryId !== (transaction.categoryId ?? "")) {
      if (form.categoryId) {
        payload.categoryId = form.categoryId;
      } else if (transaction.categoryId) {
        // Backend DTO does not explicitly support clearing categoryId
        // with null. Do not send null because the API expects a UUID.
        setErrorMessage(
          "Backend saat ini belum mendukung penghapusan kategori dari transaksi melalui formulir edit.",
        );
        return;
      }
    }

    if (amount !== originalAmount) {
      payload.amount = amount;
    }

    if (form.description !== (transaction.description ?? "")) {
      payload.description = form.description;
    }

    const nextDate = toJakartaIsoDateTime(form.transactionDate);
    const currentDate = new Date(transaction.transactionDate).getTime();
    const nextDateMs = new Date(nextDate).getTime();

    if (!Number.isFinite(nextDateMs)) {
      setErrorMessage("Tanggal transaksi tidak valid.");
      return;
    }

    if (Math.abs(nextDateMs - currentDate) > 1000) {
      payload.transactionDate = nextDate;
    }

    if (Object.keys(payload).length === 0) {
      setSuccessMessage("Tidak ada perubahan yang perlu disimpan.");
      return;
    }

    saveLock.current = true;
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await apiClient.patch<Transaction>(
        `/transactions/${encodeURIComponent(id)}`,
        payload,
      );

      setSuccessMessage("Transaksi berhasil diperbarui.");

      window.setTimeout(() => {
        navigate(`/transactions/${id}`, {
          replace: true,
          state: { transactionUpdated: true },
        });
      }, 500);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      saveLock.current = false;
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section className="edit-transaction-page">
        <Link
          to={`/transactions/${id}`}
          className="transaction-back-icon-button transaction-back-icon-button--spaced"
          aria-label="Kembali ke daftar transaksi"
          title="Kembali ke daftar transaksi"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        <div className="edit-transaction-loading" role="status">
          <LoaderCircle className="edit-transaction-spinner" size={22} />
          <span>Memuat data transaksi...</span>
        </div>
      </section>
    );
  }

  if (errorMessage && !transaction) {
    return (
      <section className="edit-transaction-page">
        <div
          className="edit-transaction-alert edit-transaction-alert--error"
          role="alert"
        >
          <strong>Transaksi tidak dapat dimuat</strong>
          <p>{errorMessage}</p>
          <button
            type="button"
            className="edit-transaction-button edit-transaction-button--secondary"
            onClick={() => setLoadKey((current) => current + 1)}
          >
            Coba lagi
          </button>
          <Link
            to={`/transactions/${id}`}
            className="transaction-back-icon-button transaction-back-icon-button--spaced"
            aria-label="Kembali ke daftar transaksi"
            title="Kembali ke daftar transaksi"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
        </div>
      </section>
    );
  }

  if (!transaction) {
    return null;
  }

  if (transaction.type === "TRANSFER") {
    return (
      <section className="edit-transaction-page">
        <Link
          to={`/transactions/${transaction.id}`}
          className="transaction-back-icon-button transaction-back-icon-button--spaced"
          aria-label="Kembali ke daftar transaksi"
          title="Kembali ke daftar transaksi"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        <div className="edit-transaction-alert edit-transaction-alert--warning">
          <strong>Transfer tidak dapat diedit melalui formulir ini</strong>
          <p>
            Transfer memiliki dua catatan transaksi yang saling terhubung. Fitur
            pengubahan transfer perlu ditangani secara khusus agar kedua sisi
            tetap konsisten.
          </p>
        </div>
      </section>
    );
  }

  if (transaction.status !== "ACTIVE") {
    return (
      <section className="edit-transaction-page">
        <Link
          to={`/transactions/${transaction.id}`}
          className="transaction-back-icon-button transaction-back-icon-button--spaced"
          aria-label="Kembali ke daftar transaksi"
          title="Kembali ke daftar transaksi"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        <div className="edit-transaction-alert edit-transaction-alert--warning">
          <strong>Transaksi sudah dibatalkan</strong>
          <p>Transaksi yang dibatalkan tidak dapat diubah.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="edit-transaction-page">
      <Link
        to={`/transactions/${transaction.id}`}
        className="transaction-back-icon-button transaction-back-icon-button--spaced"
        aria-label="Kembali ke daftar transaksi"
        title="Kembali ke daftar transaksi"
      >
        <ArrowLeft size={20} aria-hidden="true" />
      </Link>

      <div className="edit-transaction-layout">
        <form
          className="edit-transaction-card"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className="edit-transaction-card-heading">
            <div>
              <h2>Informasi transaksi</h2>
              <p>
                Jenis transaksi:{" "}
                <strong>{getTypeLabel(transaction.type)}</strong>
              </p>
            </div>
            <span
              className={`edit-transaction-type-badge edit-transaction-type-badge--${transaction.type.toLowerCase()}`}
            >
              {getTypeLabel(transaction.type)}
            </span>
          </div>

          {errorMessage && (
            <div
              className="edit-transaction-alert edit-transaction-alert--error"
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div
              className="edit-transaction-alert edit-transaction-alert--success"
              role="status"
            >
              <CheckCircle2 size={18} />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="edit-transaction-field">
            <label htmlFor="edit-transaction-account">Rekening</label>
            <select
              id="edit-transaction-account"
              value={form.accountId}
              onChange={(event) => updateField("accountId", event.target.value)}
              disabled={isSaving}
              required
            >
              <option value="">Pilih rekening</option>
              {accounts
                .filter(
                  (account) =>
                    account.isActive || account.id === transaction.accountId,
                )
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                    {account.currency !== "IDR" ? ` (${account.currency})` : ""}
                  </option>
                ))}
            </select>
            <small>
              Rekening tujuan harus aktif dan menggunakan mata uang IDR.
            </small>
          </div>

          <div className="transaction-form-amount-panel">
            <label htmlFor="edit-transaction-amount">Nominal transaksi</label>
            <div className="transaction-form-amount-input">
              <span>Rp</span>
              <input
                id="edit-transaction-amount"
                name="amount"
                type="number"
                inputMode="decimal"
                min="0.0001"
                max="999999999999999.9999"
                step="0.0001"
                placeholder="0"
                value={form.amount}
                onChange={(event) => updateField("amount", event.target.value)}
                disabled={isSaving}
                required
                aria-describedby="edit-transaction-amount-hint"
              />
            </div>
            <small id="edit-transaction-amount-hint">
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

          <div className="edit-transaction-field">
            <label htmlFor="edit-transaction-category">
              Kategori <span>(opsional)</span>
            </label>
            <select
              id="edit-transaction-category"
              value={form.categoryId}
              onChange={(event) =>
                updateField("categoryId", event.target.value)
              }
              disabled={isSaving}
            >
              <option value={transaction.categoryId ?? ""}>
                {transaction.categoryId
                  ? "Pertahankan kategori saat ini"
                  : "Tanpa kategori"}
              </option>
              {availableCategories
                .filter((category) => category.id !== transaction.categoryId)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
            <small>
              Pilih kategori aktif yang sesuai. Kategori transaksi yang sudah
              ada dipertahankan jika tidak diganti; penghapusan kategori belum
              didukung oleh kontrak PATCH backend saat ini.
            </small>
          </div>

          <div className="edit-transaction-field">
            <label htmlFor="edit-transaction-date">Tanggal dan waktu</label>
            <input
              id="edit-transaction-date"
              type="datetime-local"
              value={form.transactionDate}
              onChange={(event) =>
                updateField("transactionDate", event.target.value)
              }
              disabled={isSaving}
              required
            />
            <small>Waktu transaksi menggunakan zona waktu Asia/Jakarta.</small>
          </div>

          <div className="edit-transaction-field">
            <label htmlFor="edit-transaction-description">
              Deskripsi <span>(opsional)</span>
            </label>
            <textarea
              id="edit-transaction-description"
              value={form.description}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              placeholder="Contoh: Belanja kebutuhan bulanan"
              maxLength={500}
              rows={4}
            />
            <div className="edit-transaction-character-count">
              {form.description.length}/500 karakter
            </div>
          </div>

          <div className="edit-transaction-form-actions">
            <Link
              to={`/transactions/${transaction.id}`}
              className="edit-transaction-button edit-transaction-button--secondary"
              aria-disabled={isSaving}
              onClick={(event) => {
                if (isSaving) event.preventDefault();
              }}
            >
              Batal
            </Link>
            <button
              type="submit"
              className="edit-transaction-button edit-transaction-button--primary"
              disabled={isSaving || !selectedAccount}
            >
              {isSaving ? (
                <>
                  <LoaderCircle
                    className="edit-transaction-spinner"
                    size={17}
                  />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save size={17} />
                  Simpan perubahan
                </>
              )}
            </button>
          </div>
        </form>

        <aside className="edit-transaction-summary">
          <span className="edit-transaction-summary-label">
            RINGKASAN PERUBAHAN
          </span>
          <h2>{getTypeLabel(transaction.type)}</h2>
          <strong className="edit-transaction-summary-amount">
            {formatCurrency(form.amount || transaction.amount)}
          </strong>
          <div className="edit-transaction-summary-row">
            <span>Rekening</span>
            <strong>{selectedAccount?.name ?? "Pilih rekening"}</strong>
          </div>
          <div className="edit-transaction-summary-row">
            <span>Kategori</span>
            <strong>
              {availableCategories.find(
                (category) => category.id === form.categoryId,
              )?.name ?? "Tidak dipilih"}
            </strong>
          </div>
          <p>
            Perubahan akan disimpan ke backend dan ditampilkan pada detail
            transaksi setelah berhasil.
          </p>
        </aside>
      </div>
    </section>
  );
}

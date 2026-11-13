import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { ApiRequestError, apiClient } from "../lib/api-client";
import "./TransactionDetailPage.css";

type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";
type TransactionStatus = "ACTIVE" | "VOIDED";

interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string | null;
  type: TransactionType;
  amount: string;
  currency: "IDR";
  description: string | null;
  transactionDate: string;
  source: string;
  status: TransactionStatus;
  transferGroupId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Account {
  id: string;
  name: string;
  currency?: string;
  isActive?: boolean;
}

interface Category {
  id: string;
  name: string;
  type: string;
  isActive?: boolean;
  deletedAt?: string | null;
}

interface AccountsResponse {
  data?: Account[];
}

interface CategoriesResponse {
  data?: Category[];
}

interface EditForm {
  accountId: string;
  categoryId: string;
  amount: string;
  description: string;
  transactionDate: string;
}

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function formatCurrency(amount: string | number): string {
  const parsed = Number(amount);
  return Number.isFinite(parsed) ? currencyFormatter.format(parsed) : "—";
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const jakarta = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return jakarta.toISOString().slice(0, 16);
}

function toJakartaIso(value: string): string {
  return `${value}:00+07:00`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan. Silakan coba kembali.";
}

function getTypeLabel(type: TransactionType): string {
  if (type === "INCOME") return "Pemasukan";
  if (type === "EXPENSE") return "Pengeluaran";
  return "Transfer";
}

function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    MANUAL: "Manual",
    TELEGRAM: "Telegram",
    AI: "Asisten AI",
    IMPORT: "Impor",
    SYSTEM: "Sistem",
    RECURRING: "Berulang",
    TRANSFER: "Transfer",
  };

  return labels[source.toUpperCase()] ?? source;
}

export function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<EditForm>({
    accountId: "",
    categoryId: "",
    amount: "",
    description: "",
    transactionDate: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const eligibleCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.type === transaction?.type &&
          category.isActive !== false &&
          !category.deletedAt,
      ),
    [categories, transaction?.type],
  );

  const loadTransaction = useCallback(async () => {
    await Promise.resolve();

    if (!id) {
      setError("ID transaksi tidak ditemukan pada URL.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [transactionResult, accountResult, categoryResult] =
        await Promise.all([
          apiClient.get<Transaction>(`transactions/${encodeURIComponent(id)}`),
          apiClient.get<Account[] | AccountsResponse>("accounts"),
          apiClient.get<Category[] | CategoriesResponse>("categories"),
        ]);

      const accountList = Array.isArray(accountResult)
        ? accountResult
        : (accountResult.data ?? []);

      const categoryList = Array.isArray(categoryResult)
        ? categoryResult
        : (categoryResult.data ?? []);

      setTransaction(transactionResult);
      setAccounts(accountList);
      setCategories(categoryList);
      setForm({
        accountId: transactionResult.accountId,
        categoryId: transactionResult.categoryId ?? "",
        amount: transactionResult.amount,
        description: transactionResult.description ?? "",
        transactionDate: toDateTimeLocal(transactionResult.transactionDate),
      });
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(loadTransaction);
  }, [loadTransaction, reloadKey]);

  const accountName = useMemo(
    () =>
      accounts.find((account) => account.id === transaction?.accountId)?.name ??
      "Akun tidak ditemukan",
    [accounts, transaction?.accountId],
  );

  const categoryName = useMemo(
    () =>
      categories.find((category) => category.id === transaction?.categoryId)
        ?.name ??
      (transaction?.categoryId ? "Kategori tidak ditemukan" : "Tanpa kategori"),
    [categories, transaction?.categoryId],
  );

  function updateField<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transaction || transaction.status !== "ACTIVE") return;

    setError("");
    setNotice("");

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Nominal harus berupa angka yang lebih besar dari nol.");
      return;
    }

    if (!/^\d+(\.\d{1,4})?$/.test(form.amount.trim())) {
      setError("Nominal hanya boleh memiliki maksimal 4 angka desimal.");
      return;
    }

    if (form.description.length > 500) {
      setError("Deskripsi maksimal 500 karakter.");
      return;
    }

    if (!form.transactionDate) {
      setError("Tanggal transaksi wajib diisi.");
      return;
    }

    const transactionDate = new Date(toJakartaIso(form.transactionDate));
    if (Number.isNaN(transactionDate.getTime())) {
      setError("Tanggal dan waktu transaksi tidak valid.");
      return;
    }

    // Backend saat ini belum mendukung penghapusan categoryId melalui null.
    if (transaction.categoryId && !form.categoryId) {
      setError(
        "Backend saat ini belum mendukung penghapusan kategori dari transaksi. Pilih kategori lain atau pertahankan kategori saat ini.",
      );
      return;
    }

    if (!form.accountId) {
      setError("Pilih akun untuk transaksi ini.");
      return;
    }

    if (
      form.categoryId &&
      !eligibleCategories.some((category) => category.id === form.categoryId)
    ) {
      setError("Kategori tidak sesuai dengan jenis transaksi.");
      return;
    }

    const payload = {
      accountId: form.accountId,
      amount,
      description: form.description.trim(),
      transactionDate: toJakartaIso(form.transactionDate),
      ...(transaction.type !== "TRANSFER" && form.categoryId
        ? { categoryId: form.categoryId }
        : {}),
    };

    setSaving(true);

    try {
      const updated = await apiClient.patch<Transaction>(
        `transactions/${encodeURIComponent(transaction.id)}`,
        payload,
      );

      setTransaction(updated);
      setForm({
        accountId: updated.accountId,
        categoryId: updated.categoryId ?? "",
        amount: updated.amount,
        description: updated.description ?? "",
        transactionDate: toDateTimeLocal(updated.transactionDate),
      });
      setIsEditing(false);
      setNotice("Perubahan transaksi berhasil disimpan.");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleVoid() {
    // Transfer memiliki dua catatan yang saling terhubung.
    if (
      !transaction ||
      transaction.status !== "ACTIVE" ||
      transaction.type === "TRANSFER"
    ) {
      return;
    }

    setVoiding(true);
    setError("");
    setNotice("");

    try {
      await apiClient.delete<{ message: string }>(
        `transactions/${encodeURIComponent(transaction.id)}`,
      );
      setConfirmVoid(false);
      setNotice("Transaksi berhasil di-void.");
      setReloadKey((current) => current + 1);
    } catch (voidError) {
      setError(getErrorMessage(voidError));
    } finally {
      setVoiding(false);
    }
  }

  function cancelEditing() {
    if (!transaction) return;

    setForm({
      accountId: transaction.accountId,
      categoryId: transaction.categoryId ?? "",
      amount: transaction.amount,
      description: transaction.description ?? "",
      transactionDate: toDateTimeLocal(transaction.transactionDate),
    });
    setIsEditing(false);
    setError("");
  }

  if (loading) {
    return (
      <section className="transaction-detail-page">
        <button
          className="transaction-back-icon-button"
          type="button"
          onClick={() => navigate("/transactions")}
          aria-label="Kembali ke daftar transaksi"
          title="Kembali ke daftar transaksi"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>

        <div className="transaction-detail-state">
          <span className="transaction-spinner" />
          <strong>Memuat detail transaksi…</strong>
          <p>Data sedang diambil dari server.</p>
        </div>
      </section>
    );
  }

  if (!transaction) {
    return (
      <section className="transaction-detail-page">
        <button
          className="transaction-back-icon-button"
          type="button"
          onClick={() => navigate("/transactions")}
          aria-label="Kembali ke daftar transaksi"
          title="Kembali ke daftar transaksi"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>

        <div className="transaction-detail-state transaction-detail-state-error">
          <strong>Detail transaksi tidak dapat ditampilkan</strong>
          <p>{error || "Transaksi tidak ditemukan."}</p>
          <button
            className="transaction-button transaction-button-primary"
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
          >
            Coba lagi
          </button>
        </div>
      </section>
    );
  }

  const isActive = transaction.status === "ACTIVE";

  return (
    <section className="transaction-detail-page">
      <div className="transaction-detail-heading transaction-detail-toolbar">
        <button
          className="transaction-back-icon-button"
          type="button"
          onClick={() => navigate("/transactions")}
          aria-label="Kembali ke daftar transaksi"
          title="Kembali ke daftar transaksi"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>

        <span
          className={`transaction-status-pill ${
            isActive ? "transaction-status-active" : "transaction-status-voided"
          }`}
        >
          {isActive ? "Aktif" : "Dibatalkan"}
        </span>
      </div>

      {error && (
        <div
          className="transaction-feedback transaction-feedback-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          className="transaction-feedback transaction-feedback-success"
          role="status"
        >
          {notice}
        </div>
      )}

      <div className="transaction-detail-amount-card">
        <span>{getTypeLabel(transaction.type)}</span>
        <strong
          className={`transaction-amount-${transaction.type.toLowerCase()}`}
        >
          {transaction.type === "EXPENSE"
            ? "−"
            : transaction.type === "INCOME"
              ? "+"
              : ""}
          {formatCurrency(transaction.amount)}
        </strong>
        <span>{formatDate(transaction.transactionDate)}</span>
      </div>

      <div className="transaction-detail-grid">
        <section className="transaction-detail-card">
          <div className="transaction-detail-card-heading">
            <div>
              <h3>Informasi transaksi</h3>
              <p>Rincian transaksi yang tersimpan di akun Anda.</p>
            </div>

            {!isEditing && isActive && transaction.type !== "TRANSFER" && (
              <div className="transaction-detail-heading-actions">
                <button
                  className="transaction-button transaction-button-secondary"
                  type="button"
                  onClick={() =>
                    navigate(
                      `/transactions/${encodeURIComponent(transaction.id)}/edit`,
                    )
                  }
                >
                  Edit
                </button>
                <button
                  className="transaction-button transaction-button-danger"
                  type="button"
                  onClick={() => setConfirmVoid(true)}
                >
                  Batalkan
                </button>
              </div>
            )}
          </div>

          {isEditing ? (
            <form className="transaction-edit-form" onSubmit={handleSave}>
              <label className="transaction-form-field">
                <span>Akun</span>
                <select
                  required
                  value={form.accountId}
                  onChange={(event) =>
                    updateField("accountId", event.target.value)
                  }
                >
                  <option value="">Pilih akun</option>
                  {accounts
                    .filter((account) => account.isActive !== false)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                </select>
              </label>

              {transaction.type !== "TRANSFER" && (
                <label className="transaction-form-field">
                  <span>Kategori</span>
                  <select
                    value={form.categoryId}
                    onChange={(event) =>
                      updateField("categoryId", event.target.value)
                    }
                  >
                    <option value="">Tanpa kategori</option>
                    {eligibleCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="transaction-form-field">
                <span>Nominal (IDR)</span>
                <input
                  type="number"
                  min="0.0001"
                  max="999999999999999.9999"
                  step="0.0001"
                  required
                  value={form.amount}
                  onChange={(event) =>
                    updateField("amount", event.target.value)
                  }
                />
              </label>

              <label className="transaction-form-field">
                <span>Tanggal dan waktu (WIB)</span>
                <input
                  type="datetime-local"
                  required
                  value={form.transactionDate}
                  onChange={(event) =>
                    updateField("transactionDate", event.target.value)
                  }
                />
              </label>

              <label className="transaction-form-field transaction-form-field-full">
                <span>Deskripsi</span>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={form.description}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                  placeholder="Tambahkan keterangan transaksi"
                />
                <small>{form.description.length}/500 karakter</small>
              </label>

              <div className="transaction-form-actions">
                <button
                  className="transaction-button transaction-button-secondary"
                  type="button"
                  disabled={saving}
                  onClick={cancelEditing}
                >
                  Batal
                </button>
                <button
                  className="transaction-button transaction-button-primary"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Menyimpan…" : "Simpan perubahan"}
                </button>
              </div>
            </form>
          ) : (
            <dl className="transaction-detail-list">
              <div>
                <dt>Jenis</dt>
                <dd>{getTypeLabel(transaction.type)}</dd>
              </div>
              <div>
                <dt>Akun</dt>
                <dd>{accountName}</dd>
              </div>
              <div>
                <dt>Kategori</dt>
                <dd>
                  {transaction.type === "TRANSFER"
                    ? "Tidak berlaku"
                    : categoryName}
                </dd>
              </div>
              <div>
                <dt>Deskripsi</dt>
                <dd>{transaction.description || "Tidak ada deskripsi"}</dd>
              </div>
              <div>
                <dt>Sumber</dt>
                <dd>{getSourceLabel(transaction.source)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{isActive ? "Aktif" : "Dibatalkan"}</dd>
              </div>
            </dl>
          )}

          {isActive && transaction.type === "TRANSFER" && (
            <div
              className="transaction-feedback transaction-feedback-success"
              role="note"
            >
              <h4>Transfer terlindungi</h4>
              <p>
                Transfer terdiri dari dua catatan yang saling terhubung. Edit
                dan void transfer dinonaktifkan agar kedua sisi tidak berbeda.
              </p>
            </div>
          )}
        </section>
      </div>

      {confirmVoid && isActive && transaction.type !== "TRANSFER" && (
        <div
          className="transaction-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !voiding) {
              setConfirmVoid(false);
            }
          }}
        >
          <section
            className="transaction-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="void-transaction-title"
          >
            <div className="transaction-modal-icon">!</div>
            <h3 id="void-transaction-title">Batalkan transaksi ini?</h3>
            <p>
              Transaksi senilai{" "}
              <strong>{formatCurrency(transaction.amount)}</strong> akan
              ditandai dibatalkan dan tetap tersimpan di riwayat. Tindakan ini
              tidak dapat dibatalkan.
            </p>
            <div className="transaction-modal-actions">
              <button
                className="transaction-button transaction-button-secondary"
                type="button"
                disabled={voiding}
                onClick={() => setConfirmVoid(false)}
              >
                Batal
              </button>
              <button
                className="transaction-button transaction-button-danger"
                type="button"
                disabled={voiding}
                onClick={() => void handleVoid()}
              >
                {voiding ? "Memproses…" : "Ya, batalkan"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
